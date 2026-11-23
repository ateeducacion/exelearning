import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Folded, fold, foldModel, quantize, readWeights, serialize } from './build-learningml-mobilenet';

const tensor = (shape: number[], f: (i: number) => number) => ({
    shape,
    data: Float32Array.from({ length: shape.reduce((a, b) => a * b, 1) }, (_, i) => f(i)),
});
const bn = (c: number) => ({
    gamma: tensor([c], i => 1 + i),
    beta: tensor([c], i => i / 10),
    moving_mean: tensor([c], i => i / 5),
    moving_variance: tensor([c], () => 4 - 0.001),
});

/** The MobileNet v1 0.25 tensor names and shapes, filled with a deterministic pattern. */
function syntheticModel() {
    const tensors = new Map<string, ReturnType<typeof tensor>>();
    const add = (name: string, shape: number[]) =>
        tensors.set(
            name,
            tensor(shape, i => Math.sin(i + shape.length)),
        );
    const addBn = (name: string, c: number) => {
        for (const [k, v] of Object.entries(bn(c))) tensors.set(`${name}/${k}`, v);
    };
    const outs = [16, 32, 32, 64, 64, 128, 128, 128, 128, 128, 128, 256, 256];
    add('conv1/kernel', [3, 3, 3, 8]);
    addBn('conv1_bn', 8);
    let channels = 8;
    outs.forEach((out, n) => {
        add(`conv_dw_${n + 1}/depthwise_kernel`, [3, 3, channels, 1]);
        addBn(`conv_dw_${n + 1}_bn`, channels);
        add(`conv_pw_${n + 1}/kernel`, [1, 1, channels, out]);
        addBn(`conv_pw_${n + 1}_bn`, out);
        channels = out;
    });
    return tensors;
}

describe('LearningML MobileNet conversion', () => {
    it('folds batch normalization into per-output-channel weights and biases', () => {
        // Keras [ky][kx][in][out] with in = 2, out = 2; BN scale = gamma / 2.
        const kernel = tensor([3, 3, 2, 2], i => i);
        const folded = fold(kernel, bn(2), [0, 2, 2, 2]);
        expect(folded.bias[1]).toBeCloseTo(0.1 - 0.2 * 1, 6);
        // out 1, ky 2, kx 1, in 0 → Keras index ((2*3+1)*2+0)*2+1 = 29, scaled by gamma 2 / 2.
        expect(folded.weights[1 * 18 + (2 * 3 + 1) * 2 + 0]).toBeCloseTo(29, 4);
        const depthwise = fold(
            tensor([3, 3, 2, 1], i => i),
            bn(2),
            [1, 1, 2, 2],
        );
        // channel 1, ky 0, kx 2 → Keras index (0*3+2)*2+1 = 5.
        expect(depthwise.weights[9 + 2]).toBeCloseTo(5, 4);
        const pointwise = fold(
            tensor([1, 1, 2, 2], i => i),
            bn(2),
            [2, 1, 2, 2],
        );
        expect(Array.from(pointwise.weights)).toEqual([0, 1, 1, 3].map(v => expect.closeTo(v, 4)));
    });

    it('quantizes to int8 per channel within half a step', () => {
        const layer: Folded = {
            spec: [2, 1, 3, 2],
            weights: Float32Array.of(0.5, -1, 0.25, 0, 0, 0),
            bias: new Float32Array(2),
        };
        const { q, scales } = quantize(layer);
        expect(Array.from(q.slice(0, 3))).toEqual([64, -127, 32]);
        expect(scales[1]).toBe(1);
        layer.weights
            .slice(0, 3)
            .forEach((w, i) => expect(Math.abs(q[i] * scales[0] - w)).toBeLessThanOrEqual(scales[0] / 2));
    });

    it('reads sharded weights, keeps the 27 feature layers and round-trips through the iDevice decoder', () => {
        const tensors = syntheticModel();
        const dir = mkdtempSync(join(tmpdir(), 'learningml-mobilenet-'));
        try {
            const weights = [...tensors].map(([name, t]) => ({ name, shape: t.shape, dtype: 'float32' }));
            const bytes = Buffer.concat([...tensors.values()].map(t => Buffer.from(t.data.buffer)));
            const half = Math.floor(bytes.length / 8) * 4;
            writeFileSync(join(dir, 'a'), bytes.subarray(0, half));
            writeFileSync(join(dir, 'b'), bytes.subarray(half));
            writeFileSync(
                join(dir, 'model.json'),
                JSON.stringify({ weightsManifest: [{ paths: ['a', 'b'], weights }] }),
            );
            const read = readWeights(dir);
            expect(read.get('conv_pw_13/kernel')!.data).toEqual(tensors.get('conv_pw_13/kernel')!.data);

            const layers = foldModel(read);
            expect(layers.map(l => l.spec[1]).filter(s => s === 2)).toHaveLength(5);
            expect(layers.at(-1)!.spec).toEqual([2, 1, 256, 256]);

            const script = serialize(layers);
            const sandbox = { window: {} as any, atob };
            new Function('window', 'atob', `${script}\nwindow.$learningmlMobilenet = $learningmlMobilenet;`)(
                sandbox.window,
                atob,
            );
            new Function(
                'window',
                readFileSync('public/files/perm/idevices/base/learningml/export/learningml.js', 'utf8') +
                    '\nwindow.$learningml = $learningml;',
            )(sandbox.window);
            const decoded = sandbox.window.$learningml.image.load.call({
                ...sandbox.window.$learningml.image,
                layers: null,
            });
            decoded.forEach((d: any, i: number) => {
                expect(Array.from(d.bias)).toEqual(Array.from(layers[i].bias));
                const step = Math.max(...layers[i].weights.map(Math.abs)) / 127;
                d.w.forEach((w: number, k: number) =>
                    expect(Math.abs(w - layers[i].weights[k])).toBeLessThanOrEqual(step),
                );
            });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('rejects weights it does not know how to read', () => {
        const dir = mkdtempSync(join(tmpdir(), 'learningml-mobilenet-'));
        try {
            writeFileSync(join(dir, 's'), Buffer.alloc(4));
            writeFileSync(
                join(dir, 'model.json'),
                JSON.stringify({
                    weightsManifest: [{ paths: ['s'], weights: [{ name: 'x', shape: [1], dtype: 'int32' }] }],
                }),
            );
            expect(() => readWeights(dir)).toThrow('Unexpected dtype');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

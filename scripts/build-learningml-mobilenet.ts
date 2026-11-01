/**
 * Convert the official TensorFlow.js MobileNet v1 0.25/224 Keras model into the
 * compact image feature extractor shipped by the LearningML iDevice.
 *
 *   bun scripts/build-learningml-mobilenet.ts <model-dir>
 *
 * <model-dir> holds model.json and its shards from
 * https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/ (Apache-2.0).
 * The ImageNet head is dropped, batch normalization is folded into the
 * convolutions and weights are quantized to int8 per output channel. The
 * output is a classic script so packages work offline and from file://.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Tensor = { shape: number[]; data: Float32Array };
/** [kind, stride, inputChannels, outputChannels]; kind 0 = 3×3 conv, 1 = 3×3 depthwise, 2 = 1×1 pointwise. */
export type LayerSpec = [number, number, number, number];
export type Folded = { spec: LayerSpec; weights: Float32Array; bias: Float32Array };

const OUTPUT = resolve(import.meta.dir, '../public/files/perm/idevices/base/learningml/export/learningml-mobilenet.js');
const EPSILON = 0.001;

/** Read every float32 weight named in the manifest, in manifest order. */
export function readWeights(dir: string): Map<string, Tensor> {
    const model = JSON.parse(readFileSync(join(dir, 'model.json'), 'utf8'));
    const tensors = new Map<string, Tensor>();
    for (const group of model.weightsManifest) {
        const bytes = Buffer.concat(group.paths.map((p: string) => readFileSync(join(dir, p))));
        const floats = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
        let offset = 0;
        for (const w of group.weights) {
            if (w.dtype !== 'float32') throw new Error(`Unexpected dtype ${w.dtype} for ${w.name}`);
            const size = w.shape.reduce((a: number, b: number) => a * b, 1);
            tensors.set(w.name, { shape: w.shape, data: floats.slice(offset, offset + size) });
            offset += size;
        }
    }
    return tensors;
}

/**
 * Fold a Keras convolution and its BatchNormalization into weights laid out
 * per output channel ([out][ky][kx][in] for conv, [c][ky][kx] for depthwise,
 * [out][in] for pointwise) plus a bias.
 */
export function fold(
    kernel: Tensor,
    bn: Record<'gamma' | 'beta' | 'moving_mean' | 'moving_variance', Tensor>,
    spec: LayerSpec,
): Folded {
    const [kind, , cin, cout] = spec;
    const k = kind === 2 ? 1 : 3;
    const scale = Float32Array.from(bn.gamma.data, (g, c) => g / Math.sqrt(bn.moving_variance.data[c] + EPSILON));
    const bias = Float32Array.from(bn.beta.data, (b, c) => b - bn.moving_mean.data[c] * scale[c]);
    const perChannel = kind === 1 ? k * k : k * k * cin;
    const weights = new Float32Array(cout * perChannel);
    // Keras kernels are [ky][kx][in][out], depthwise [ky][kx][c][1].
    for (let o = 0; o < cout; o++)
        for (let ky = 0; ky < k; ky++)
            for (let kx = 0; kx < k; kx++)
                if (kind === 1) weights[o * 9 + ky * 3 + kx] = kernel.data[(ky * 3 + kx) * cout + o] * scale[o];
                else
                    for (let i = 0; i < cin; i++)
                        weights[o * perChannel + (ky * k + kx) * cin + i] =
                            kernel.data[((ky * k + kx) * cin + i) * cout + o] * scale[o];
    return { spec, weights, bias };
}

/** Symmetric int8 per output channel: w ≈ q × scale. */
export function quantize(layer: Folded): { q: Int8Array; scales: Float32Array } {
    const cout = layer.spec[3];
    const per = layer.weights.length / cout;
    const q = new Int8Array(layer.weights.length);
    const scales = new Float32Array(cout);
    for (let o = 0; o < cout; o++) {
        let max = 0;
        for (let j = 0; j < per; j++) max = Math.max(max, Math.abs(layer.weights[o * per + j]));
        scales[o] = max / 127 || 1;
        for (let j = 0; j < per; j++) q[o * per + j] = Math.round(layer.weights[o * per + j] / scales[o]);
    }
    return { q, scales };
}

/** MobileNet v1 layers up to the 256-value global average pool. */
export function foldModel(tensors: Map<string, Tensor>): Folded[] {
    const bn = (name: string) => ({
        gamma: tensors.get(`${name}/gamma`)!,
        beta: tensors.get(`${name}/beta`)!,
        moving_mean: tensors.get(`${name}/moving_mean`)!,
        moving_variance: tensors.get(`${name}/moving_variance`)!,
    });
    const layers = [
        fold(tensors.get('conv1/kernel')!, bn('conv1_bn'), [0, 2, 3, tensors.get('conv1/kernel')!.shape[3]]),
    ];
    for (let i = 1; i <= 13; i++) {
        const dw = tensors.get(`conv_dw_${i}/depthwise_kernel`)!;
        const pw = tensors.get(`conv_pw_${i}/kernel`)!;
        const stride = [2, 4, 6, 12].includes(i) ? 2 : 1;
        layers.push(fold(dw, bn(`conv_dw_${i}_bn`), [1, stride, dw.shape[2], dw.shape[2]]));
        layers.push(fold(pw, bn(`conv_pw_${i}_bn`), [2, 1, pw.shape[2], pw.shape[3]]));
    }
    return layers;
}

/** The classic script: layer specs, float32 scales/biases and int8 weights as base64. */
export function serialize(layers: Folded[]): string {
    const quantized = layers.map(quantize);
    const floats = Float32Array.from(quantized.flatMap((q, i) => [...q.scales, ...layers[i].bias]));
    const ints = new Int8Array(quantized.reduce((n, q) => n + q.q.length, 0));
    let offset = 0;
    for (const { q } of quantized) {
        ints.set(q, offset);
        offset += q.length;
    }
    const base64 = (a: ArrayBufferView) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
    return `/*! MobileNet v1 0.25/224 image feature extractor for the LearningML iDevice.
 * Weights: TensorFlow.js models (https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/),
 * Apache-2.0, Copyright Google LLC. Head removed, batch normalization folded, int8 per channel.
 * Generated by scripts/build-learningml-mobilenet.ts; do not edit. */
var $learningmlMobilenet = {
    layers: ${JSON.stringify(layers.map(l => l.spec))},
    floats: '${base64(floats)}',
    ints: '${base64(ints)}',
};
`;
}

if (import.meta.main) {
    const dir = process.argv[2];
    if (!dir) throw new Error('Usage: bun scripts/build-learningml-mobilenet.ts <model-dir>');
    const script = serialize(foldModel(readWeights(dir)));
    writeFileSync(OUTPUT, script);
    console.log(`LearningML MobileNet: ${Buffer.byteLength(script)} bytes`);
}

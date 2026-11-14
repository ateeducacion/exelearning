import { afterEach, describe, expect, it } from 'vitest';
import { createStubInstance, createWrapper, resetDom } from '../test/helpers';
import { createRegistry } from './instance-registry';

afterEach(resetDom);

describe('createRegistry', () => {
    it('stores, reports and returns instances by wrapper', () => {
        const registry = createRegistry();
        const wrapper = createWrapper('one');
        const instance = createStubInstance(wrapper);
        expect(registry.has(wrapper)).toBe(false);
        registry.set(wrapper, instance);
        expect(registry.get(wrapper)).toBe(instance);
        expect(registry.has(wrapper)).toBe(true);
        expect(registry.wrappers()).toEqual([wrapper]);
    });

    it('destroy tears the instance down and drops it', () => {
        const registry = createRegistry();
        const wrapper = createWrapper('one');
        const instance = createStubInstance(wrapper);
        registry.set(wrapper, instance);
        registry.destroy(wrapper);
        expect(registry.get(wrapper)).toBeUndefined();
        expect(instance.stopped).toBe(true);
    });

    it('destroy on an unregistered wrapper is a safe no-op', () => {
        const registry = createRegistry();
        expect(() => registry.destroy(createWrapper('ghost'))).not.toThrow();
    });

    it('destroying one instance leaves the others intact', () => {
        const registry = createRegistry();
        const first = createWrapper('one');
        const second = createWrapper('two');
        const firstInstance = createStubInstance(first);
        const secondInstance = createStubInstance(second);
        registry.set(first, firstInstance);
        registry.set(second, secondInstance);
        registry.destroy(first);
        expect(registry.get(second)).toBe(secondInstance);
        expect(secondInstance.stopped).toBe(false);
    });

    it('destroyAll tears every instance down, most recent first', () => {
        const registry = createRegistry();
        const order: string[] = [];
        for (const id of ['one', 'two', 'three']) {
            const wrapper = createWrapper(id);
            const instance = createStubInstance(wrapper);
            instance.interaction = {
                destroy: () => order.push(id),
            } as unknown as typeof instance.interaction;
            registry.set(wrapper, instance);
        }
        registry.destroyAll();
        expect(order).toEqual(['three', 'two', 'one']);
        expect(registry.wrappers()).toEqual([]);
    });

    it('does not recurse when a disposer re-enters destroy for the same wrapper', () => {
        const registry = createRegistry();
        const wrapper = createWrapper('one');
        const instance = createStubInstance(wrapper);
        let calls = 0;
        instance.interaction = {
            destroy: () => {
                calls += 1;
                registry.destroy(wrapper);
            },
        } as unknown as typeof instance.interaction;
        registry.set(wrapper, instance);
        registry.destroy(wrapper);
        expect(calls).toBe(1);
    });
});

import { assert } from 'vitest';
import { runInNewContext } from 'node:vm';
import { clonePlainData } from '../../src/utils/clonePlainData.js';

// Builds a value in another realm. Its objects carry that realm's prototypes, so neither
// `instanceof` nor an `Object.prototype` identity check recognises them from here.
const foreign = <T>(source: string): T => runInNewContext(`(${source})`) as T;

const options = (bytes = false) => ({
    root: 'input',
    bytes,
    invalid: (reason: string, path: string) => new Error(`Invalid input: ${reason} at ${path}`),
});

describe('#TronWeb.utils.clonePlainData', function () {
    describe('values from another realm', function () {
        it('clones plain objects and arrays into objects and arrays of this realm', function () {
            const input = foreign<{ a: number; list: unknown[]; nested: { c: string } }>(
                '{ a: 1, list: [1, { b: 2n }], nested: { c: "x" } }'
            );
            assert.notStrictEqual(Object.getPrototypeOf(input), Object.prototype);
            assert.isFalse(input.list instanceof Array);

            const out = clonePlainData(input, options());

            assert.deepEqual(out, { a: 1, list: [1, { b: 2n }], nested: { c: 'x' } });
            assert.strictEqual(Object.getPrototypeOf(out), Object.prototype);
            assert.strictEqual(Object.getPrototypeOf(out.nested), Object.prototype);
            assert.strictEqual(Object.getPrototypeOf(out.list[1]), Object.prototype);
            assert.isTrue(out.list instanceof Array);
        });

        it('copies a Uint8Array into a Uint8Array of this realm when bytes is set', function () {
            const input = foreign<Uint8Array>('new Uint8Array([1, 2, 3])');
            assert.isFalse(input instanceof Uint8Array);

            const out = clonePlainData(input, options(true));

            assert.isTrue(out instanceof Uint8Array);
            assert.notStrictEqual(out, input);
            assert.deepEqual(Array.from(out), [1, 2, 3]);
        });

        it('rejects class instances, naming the path', function () {
            const input = foreign<{ x: object }>('{ x: new (class Fancy { a = 1 })() }');

            assert.throws(() => clonePlainData(input, options()), 'Invalid input: not a plain object at input.x');
        });
    });
});

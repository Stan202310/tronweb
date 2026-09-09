import { assert } from 'vitest';
import { runInNewContext } from 'node:vm';
import { clonePlainData } from '../../src/utils/clone.js';

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

    describe('nesting depth', function () {
        // `levels` nested objects, the root counting as one: nest(1) is {}, nest(2) is { a: {} }, ...
        const nestObjects = (levels: number): Record<string, unknown> => {
            let value: Record<string, unknown> = {};
            for (let i = 1; i < levels; i++) value = { a: value };
            return value;
        };
        const nestArrays = (levels: number): unknown[] => {
            let value: unknown[] = [];
            for (let i = 1; i < levels; i++) value = [value];
            return value;
        };

        it('copies objects nested up to 64 levels deep', function () {
            const out = clonePlainData(nestObjects(64), options());

            assert.deepEqual(out, nestObjects(64));
        });

        it('rejects objects nested deeper than 64 levels, naming the path', function () {
            assert.throws(
                () => clonePlainData(nestObjects(65), options()),
                `Invalid input: nesting deeper than 64 levels at input${'.a'.repeat(64)}`
            );
        });

        it('counts arrays as levels too', function () {
            assert.deepEqual(clonePlainData(nestArrays(64), options()), nestArrays(64));
            assert.throws(
                () => clonePlainData(nestArrays(65), options()),
                `Invalid input: nesting deeper than 64 levels at input${'[0]'.repeat(64)}`
            );
        });
    });
});

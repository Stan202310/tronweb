import { clonePlainData } from './clonePlainData.js';

/**
 * Deep-clones a transaction into fresh plain objects and arrays.
 *
 * Every property is read exactly once, so a `Proxy` or an accessor cannot hand one value
 * to validation and another to the signer. The copy holds plain data properties only and
 * has `Object.prototype` as its prototype, so nothing of the caller's object — traps,
 * getters, class prototypes — survives. Unlike a JSON round-trip it keeps `bigint` and
 * `undefined` values as they are.
 *
 * Transaction data is JSON-shaped plus `bigint`: primitives, arrays and plain objects.
 * Anything else (functions, symbols, `Date`, `Map`, typed arrays, ...) and circular
 * references are rejected with `Invalid transaction provided: <reason> at <path>`.
 */
export function cloneTransaction<T>(transaction: T): T {
    return clonePlainData(transaction, {
        root: 'transaction',
        invalid: (reason, path) => new Error(`Invalid transaction provided: ${reason} at ${path}`),
    });
}

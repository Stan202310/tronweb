import { clonePlainData } from './clonePlainData.js';

/**
 * Deep-clones a transaction into fresh plain objects and arrays. Unlike a JSON round-trip
 * it keeps `bigint` and `undefined` values as they are.
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

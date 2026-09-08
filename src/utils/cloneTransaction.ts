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
    return clone(transaction, 'transaction', new Set()) as T;
}

function clone(value: unknown, path: string, ancestors: Set<object>): unknown {
    switch (typeof value) {
        case 'string':
        case 'number':
        case 'boolean':
        case 'bigint':
        case 'undefined':
            return value;
        case 'object':
            if (value === null) return null;
            break;
        default:
            // function, symbol
            throw invalid(`unsupported ${typeof value}`, path);
    }

    const isArray = Array.isArray(value);
    if (!isArray) {
        const tag = Object.prototype.toString.call(value);
        if (tag !== '[object Object]') {
            throw invalid(`unsupported ${tag.slice(8, -1)}`, path);
        }
    }

    if (ancestors.has(value)) {
        throw invalid('circular reference', path);
    }
    ancestors.add(value);

    let copy: unknown;
    if (isArray) {
        const source = value as unknown[];
        const out: unknown[] = [];
        for (let i = 0, length = source.length; i < length; i++) {
            out.push(clone(source[i], `${path}[${i}]`, ancestors));
        }
        copy = out;
    } else {
        const source = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(source)) {
            // Assigning an own `__proto__` key would re-target the copy's prototype
            // instead of adding a data property.
            if (key === '__proto__') continue;
            out[key] = clone(source[key], `${path}.${key}`, ancestors);
        }
        copy = out;
    }

    ancestors.delete(value);
    return copy;
}

function invalid(reason: string, path: string): Error {
    return new Error(`Invalid transaction provided: ${reason} at ${path}`);
}

export interface ClonePlainDataOptions {
    /** Name of the root value; error paths start with it (`transaction.raw_data.contract[0]`). */
    root: string;
    /** Builds the error thrown for a value that cannot be cloned. */
    invalid: (reason: string, path: string) => Error;
    /** Copy `Uint8Array` values into fresh `Uint8Array`s instead of rejecting them. */
    bytes?: boolean;
}

/**
 * Deep-clones JSON-shaped data — primitives, `bigint`, arrays and plain objects, plus
 * `Uint8Array` when `bytes` is set — into fresh plain objects and arrays.
 *
 * Every property is read exactly once, so a `Proxy` or an accessor cannot hand one value
 * to validation and another to whatever reads the copy afterwards. The copy holds plain data
 * properties only and has `Object.prototype` as its prototype, so nothing of the caller's
 * object — traps, getters, class prototypes — survives. Unlike a JSON round-trip it keeps
 * `bigint` and `undefined` values as they are.
 *
 * Anything else (functions, symbols, `Date`, `Map`, ...) and circular references are
 * rejected with the error built by `options.invalid(reason, path)`.
 */
export function clonePlainData<T>(value: T, options: ClonePlainDataOptions): T {
    return clone(value, options.root, new Set(), options) as T;
}

function clone(value: unknown, path: string, ancestors: Set<object>, options: ClonePlainDataOptions): unknown {
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
            throw options.invalid(`unsupported ${typeof value}`, path);
    }

    if (options.bytes && value instanceof Uint8Array) {
        // A fresh, plain Uint8Array: reads each byte once and drops subclasses (Buffer) and traps.
        return new Uint8Array(value);
    }

    const isArray = Array.isArray(value);
    if (!isArray) {
        const tag = Object.prototype.toString.call(value);
        if (tag !== '[object Object]') {
            throw options.invalid(`unsupported ${tag.slice(8, -1)}`, path);
        }
    }

    if (ancestors.has(value)) {
        throw options.invalid('circular reference', path);
    }
    ancestors.add(value);

    let copy: unknown;
    if (isArray) {
        const source = value as unknown[];
        const out: unknown[] = [];
        for (let i = 0, length = source.length; i < length; i++) {
            out.push(clone(source[i], `${path}[${i}]`, ancestors, options));
        }
        copy = out;
    } else {
        const source = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(source)) {
            // Assigning an own `__proto__` key would re-target the copy's prototype
            // instead of adding a data property.
            if (key === '__proto__') continue;
            out[key] = clone(source[key], `${path}.${key}`, ancestors, options);
        }
        copy = out;
    }

    ancestors.delete(value);
    return copy;
}

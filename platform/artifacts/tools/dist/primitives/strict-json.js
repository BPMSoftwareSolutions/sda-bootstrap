function byteOffset(source, characterOffset) {
    return new TextEncoder().encode(source.slice(0, characterOffset)).byteLength;
}
export class StrictJsonError extends Error {
    code;
    characterOffset;
    byteOffset;
    constructor(code, message, source, characterOffset) {
        super(message);
        this.name = "StrictJsonError";
        this.code = code;
        this.characterOffset = characterOffset;
        this.byteOffset = byteOffset(source, characterOffset);
    }
}
function containsLoneSurrogate(value) {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff))
                return true;
            index += 1;
            continue;
        }
        if (code >= 0xdc00 && code <= 0xdfff)
            return true;
    }
    return false;
}
class StrictJsonParser {
    source;
    maximumDepth;
    index = 0;
    constructor(source, maximumDepth) {
        this.source = source;
        this.maximumDepth = maximumDepth;
    }
    parse() {
        this.whitespace();
        const value = this.value(0);
        this.whitespace();
        if (this.index !== this.source.length)
            this.fail("JSON_PARSE_ERROR", "Unexpected token", this.index);
        return value;
    }
    fail(code, message, characterOffset) {
        const offset = byteOffset(this.source, characterOffset);
        throw new StrictJsonError(code, `${message} at byte ${offset}.`, this.source, characterOffset);
    }
    value(depth) {
        if (depth > this.maximumDepth) {
            this.fail("JSON_PARSE_ERROR", `JSON nesting exceeds ${this.maximumDepth}`, this.index);
        }
        this.whitespace();
        const token = this.source[this.index];
        if (token === "{")
            return this.object(depth + 1);
        if (token === "[")
            return this.array(depth + 1);
        if (token === "\"")
            return this.string();
        if (token === "t" && this.source.slice(this.index, this.index + 4) === "true") {
            this.index += 4;
            return true;
        }
        if (token === "f" && this.source.slice(this.index, this.index + 5) === "false") {
            this.index += 5;
            return false;
        }
        if (token === "n" && this.source.slice(this.index, this.index + 4) === "null") {
            this.index += 4;
            return null;
        }
        if (token === "-" || (token !== undefined && token >= "0" && token <= "9"))
            return this.number();
        return this.fail("JSON_PARSE_ERROR", "Expected a JSON value", this.index);
    }
    object(depth) {
        this.index += 1;
        this.whitespace();
        const result = {};
        const keys = new Set();
        if (this.source[this.index] === "}") {
            this.index += 1;
            return result;
        }
        while (true) {
            if (this.source[this.index] !== "\"")
                this.fail("JSON_PARSE_ERROR", "Expected an object property", this.index);
            const keyOffset = this.index;
            const key = this.string();
            if (keys.has(key)) {
                this.fail("JSON_DUPLICATE_KEY", `Duplicate object property '${key}' is not admitted`, keyOffset);
            }
            keys.add(key);
            this.whitespace();
            if (this.source[this.index] !== ":")
                this.fail("JSON_PARSE_ERROR", "Expected ':'", this.index);
            this.index += 1;
            Object.defineProperty(result, key, {
                value: this.value(depth),
                enumerable: true,
                configurable: true,
                writable: true
            });
            this.whitespace();
            const delimiter = this.source[this.index];
            if (delimiter === "}") {
                this.index += 1;
                return result;
            }
            if (delimiter !== ",")
                this.fail("JSON_PARSE_ERROR", "Expected ',' or '}'", this.index);
            this.index += 1;
            this.whitespace();
        }
    }
    array(depth) {
        this.index += 1;
        this.whitespace();
        const result = [];
        if (this.source[this.index] === "]") {
            this.index += 1;
            return result;
        }
        while (true) {
            result.push(this.value(depth));
            this.whitespace();
            const delimiter = this.source[this.index];
            if (delimiter === "]") {
                this.index += 1;
                return result;
            }
            if (delimiter !== ",")
                this.fail("JSON_PARSE_ERROR", "Expected ',' or ']'", this.index);
            this.index += 1;
            this.whitespace();
        }
    }
    string() {
        const start = this.index;
        this.index += 1;
        while (this.index < this.source.length) {
            const code = this.source.charCodeAt(this.index);
            if (code === 0x22) {
                this.index += 1;
                let value;
                try {
                    value = JSON.parse(this.source.slice(start, this.index));
                }
                catch {
                    return this.fail("JSON_PARSE_ERROR", "Invalid JSON string", start);
                }
                if (containsLoneSurrogate(value)) {
                    return this.fail("JSON_PARSE_ERROR", "Lone Unicode surrogate is not admitted", start);
                }
                return value;
            }
            if (code < 0x20)
                this.fail("JSON_PARSE_ERROR", "Unescaped control character", this.index);
            if (code === 0x5c) {
                this.index += 1;
                const escape = this.source[this.index];
                if (escape === "u") {
                    const hex = this.source.slice(this.index + 1, this.index + 5);
                    if (!/^[0-9a-fA-F]{4}$/.test(hex))
                        this.fail("JSON_PARSE_ERROR", "Invalid Unicode escape", this.index);
                    this.index += 5;
                    continue;
                }
                if (!escape || !'"\\/bfnrt'.includes(escape))
                    this.fail("JSON_PARSE_ERROR", "Invalid escape", this.index);
            }
            this.index += 1;
        }
        return this.fail("JSON_PARSE_ERROR", "Unterminated JSON string", start);
    }
    number() {
        const start = this.index;
        const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(this.source.slice(this.index));
        if (!match)
            return this.fail("JSON_PARSE_ERROR", "Invalid JSON number", start);
        this.index += match[0].length;
        const value = Number(match[0]);
        if (!Number.isFinite(value))
            return this.fail("JSON_PARSE_ERROR", "Non-finite JSON number", start);
        if (/^-?(?:0|[1-9][0-9]*)$/.test(match[0]) && !Number.isSafeInteger(value)) {
            return this.fail("JSON_PARSE_ERROR", "Unsafe integer cannot retain its exact value", start);
        }
        if (Object.is(value, -0))
            return this.fail("JSON_PARSE_ERROR", "Negative zero is not admitted", start);
        return value;
    }
    whitespace() {
        while (this.index < this.source.length && /[\u0009\u000a\u000d\u0020]/.test(this.source[this.index] ?? "")) {
            this.index += 1;
        }
    }
}
export function parseStrictJson(source, maximumDepth) {
    if (!Number.isSafeInteger(maximumDepth) || maximumDepth < 1) {
        throw new Error("maximumDepth must be a positive safe integer.");
    }
    return new StrictJsonParser(source, maximumDepth).parse();
}

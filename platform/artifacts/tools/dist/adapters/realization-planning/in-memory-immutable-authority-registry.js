const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
function freezeDeep(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value))
        return value;
    for (const member of Object.values(value))
        freezeDeep(member);
    return Object.freeze(value);
}
function key(authorityId, selector) {
    return `${authorityId}\u0000${selector}`;
}
export class InMemoryImmutableAuthorityRegistry {
    valuesByDigest = new Map();
    digestByAlias = new Map();
    constructor(entries, verify) {
        for (const entry of entries) {
            if (entry.authorityId.length === 0)
                throw new Error("Authority identity must not be empty.");
            if (!DIGEST_PATTERN.test(entry.digest))
                throw new Error(`Authority '${entry.authorityId}' has an invalid digest.`);
            if (!verify(entry.value, entry.digest, entry.authorityId)) {
                throw new Error(`Authority '${entry.authorityId}' failed digest verification.`);
            }
            const digestKey = key(entry.authorityId, entry.digest);
            if (this.valuesByDigest.has(digestKey)) {
                throw new Error(`Authority '${entry.authorityId}' declares digest '${entry.digest}' more than once.`);
            }
            this.valuesByDigest.set(digestKey, freezeDeep(structuredClone(entry.value)));
            for (const alias of entry.aliases) {
                if (alias.length === 0 || DIGEST_PATTERN.test(alias)) {
                    throw new Error(`Authority '${entry.authorityId}' has invalid alias '${alias}'.`);
                }
                const aliasKey = key(entry.authorityId, alias);
                if (this.digestByAlias.has(aliasKey)) {
                    throw new Error(`Authority alias '${entry.authorityId}:${alias}' is ambiguous.`);
                }
                this.digestByAlias.set(aliasKey, entry.digest);
            }
        }
    }
    resolve(authorityId, selector) {
        const exact = this.valuesByDigest.get(key(authorityId, selector));
        if (exact) {
            return Object.freeze({ authorityId, selector, digest: selector, resolvedBy: "DIGEST", value: exact });
        }
        const digest = this.digestByAlias.get(key(authorityId, selector));
        if (!digest)
            return null;
        const value = this.valuesByDigest.get(key(authorityId, digest));
        if (!value)
            throw new Error(`Authority alias '${authorityId}:${selector}' has no immutable value.`);
        return Object.freeze({ authorityId, selector, digest, resolvedBy: "ALIAS", value });
    }
}

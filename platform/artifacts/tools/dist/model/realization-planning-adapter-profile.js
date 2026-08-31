import { sha256Digest } from "../enterprise/control-plane/canonical-json.js";
export function digestAdapterProfile(profile) {
    const digestable = { ...profile };
    delete digestable["profileDigest"];
    return sha256Digest(digestable);
}
export function cloneFrozenProfile(value) {
    const cloned = structuredClone(value);
    const freeze = (candidate) => {
        if (!candidate || typeof candidate !== "object" || Object.isFrozen(candidate))
            return;
        for (const member of Object.values(candidate))
            freeze(member);
        Object.freeze(candidate);
    };
    freeze(cloned);
    return cloned;
}

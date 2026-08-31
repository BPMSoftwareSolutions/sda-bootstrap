import crypto from "node:crypto";

export function valueAt(source, dottedPath = "") {
  return dottedPath.split(".").filter(Boolean).reduce((value, segment) => value?.[segment], source);
}

export function canonicalizeValue(value) {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalizeValue(value[key])]));
  }
  return value;
}

export function canonicalDigest(value) {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonicalizeValue(value))).digest("hex")}`;
}

export function createGovernedEffectContext(overrides = {}) {
  return {
    credentialBindings: new Map(),
    credentialReader: overrides.credentialReader ?? ((referenceName) => process.env[referenceName]),
    randomId: overrides.randomId ?? (() => crypto.randomUUID()),
    now: overrides.now ?? (() => new Date()),
    fetch: overrides.fetch ?? globalThis.fetch,
    allowLoopbackHttpForConformance: overrides.allowLoopbackHttpForConformance === true
  };
}

export function effectNow(effectContext) {
  const value = effectContext.now();
  return value instanceof Date ? value : new Date(value);
}

export function bindValueAt(source, dottedPath, value) {
  const segments = dottedPath.split(".").filter(Boolean);
  if (segments.length === 0) throw new Error("PROJECTED_CAPABILITY_RESULT_PATH_MISSING");
  if (segments.some((segment) => ["__proto__", "prototype", "constructor"].includes(segment))) {
    throw new Error(`PROJECTED_CAPABILITY_RESULT_PATH_INVALID: '${dottedPath}'`);
  }
  const result = structuredClone(source);
  let target = result;
  for (const segment of segments.slice(0, -1)) {
    const current = target[segment];
    if (current === undefined || current === null) target[segment] = {};
    else if (typeof current !== "object" || Array.isArray(current)) {
      throw new Error(`PROJECTED_CAPABILITY_RESULT_PATH_INVALID: '${dottedPath}'`);
    }
    target = target[segment];
  }
  target[segments.at(-1)] = structuredClone(value);
  return result;
}

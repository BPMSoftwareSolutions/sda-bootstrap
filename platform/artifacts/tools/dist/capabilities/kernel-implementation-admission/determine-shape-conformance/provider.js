function scopedErrors(input) { return (input.manifestValidation?.value.errors ?? []).filter((error) => error.instancePath === "/semanticObjects" || error.instancePath.startsWith("/semanticObjects/")); }
function declaredObjectIds(manifest) { const objects = Array.isArray(manifest["semanticObjects"]) ? manifest["semanticObjects"] : []; return new Set(objects.flatMap((entry) => entry && typeof entry === "object" && typeof entry["objectId"] === "string" ? [entry["objectId"]] : [])); }
export class ShapeConformanceProvider {
    responsibilityId = "compare-declared-embodiments-with-required-semantic-objects";
    async execute(input) {
        const canonical = input.canonicalObjectIds.value;
        if (!input.manifest)
            return { language: input.language, manifestPath: input.manifestPath, manifestFound: false, manifestValid: false, errors: [`conformance manifest not found at ${input.manifestPath}`], objects: canonical.map((objectId) => ({ objectId, status: "MISSING" })), conforming: false };
        const errors = scopedErrors(input);
        const declared = declaredObjectIds(input.manifest.value);
        const objects = canonical.map((objectId) => ({ objectId, status: declared.has(objectId) ? "PASS" : "MISSING" }));
        const manifestValid = errors.length === 0;
        return { language: input.language, manifestPath: input.manifestPath, manifestFound: true, manifestValid, errors: manifestValid ? [] : errors.map((error) => `${error.instancePath} ${error.message}`), objects, conforming: manifestValid && objects.every((entry) => entry.status === "PASS") };
    }
}

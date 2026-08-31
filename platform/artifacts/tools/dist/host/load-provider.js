import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
export async function loadBoundProvider(repositoryRoot, groupId, legacyProvider) {
    const responsibilityId = legacyProvider.responsibilityId;
    const bindingPath = path.join(repositoryRoot, "capabilities", "sda-tooling", groupId, "provider-bindings.json");
    if (!fs.existsSync(bindingPath)) {
        throw new Error(`Provider binding authority is missing: ${bindingPath}`);
    }
    const authority = JSON.parse(fs.readFileSync(bindingPath, "utf8"));
    const matches = authority.bindings?.filter((candidate) => candidate.responsibilityId === responsibilityId) ?? [];
    if (matches.length !== 1) {
        throw new Error(`Responsibility '${responsibilityId}' must have exactly one provider binding; found ${matches.length}.`);
    }
    const binding = matches[0];
    if (!binding?.implementationRef) {
        throw new Error(`Provider binding for '${responsibilityId}' has no implementationRef.`);
    }
    const protocol = binding.protocol ?? "responsibility-provider-v1";
    if (protocol === "responsibility-provider-v1") {
        return legacyProvider;
    }
    if (protocol !== "projected-consumer-runtime-v2") {
        throw new Error(`Provider binding for '${responsibilityId}' uses unsupported protocol '${protocol}'.`);
    }
    const implementationPath = path.resolve(repositoryRoot, binding.implementationRef);
    const relativeImplementationPath = path.relative(path.resolve(repositoryRoot), implementationPath);
    if (relativeImplementationPath.startsWith("..") || path.isAbsolute(relativeImplementationPath)) {
        throw new Error(`Projected provider escapes repository: ${binding.implementationRef}`);
    }
    const projected = (await import(pathToFileURL(implementationPath).href));
    if (typeof projected.executeCapability !== "function") {
        throw new Error(`Projected provider '${binding.implementationRef}' has no executeCapability export.`);
    }
    return {
        responsibilityId,
        async execute(input) {
            const result = await projected.executeCapability(structuredClone(input));
            if (result.disposition !== "terminated" && result.disposition !== "completed") {
                throw new Error(`Projected capability '${responsibilityId}' returned disposition '${result.disposition}'.`);
            }
            if (result.outcome === null || result.outcome === undefined) {
                throw new Error(`Projected capability '${responsibilityId}' returned no outcome.`);
            }
            return result.outcome;
        }
    };
}

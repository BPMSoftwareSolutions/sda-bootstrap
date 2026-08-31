import { NodeLanguageTargetRegistry } from "../../adapters/projection/node-language-target-registry.js";
export function discoverProjectionTargets(repositoryRoot) {
    return new NodeLanguageTargetRegistry(repositoryRoot).targets();
}
/** Compatibility surface for repository-local commands; the values are registry-derived. */
export const projectionTargets = discoverProjectionTargets(process.cwd());

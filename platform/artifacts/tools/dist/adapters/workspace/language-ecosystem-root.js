import path from "node:path";
const IMPLEMENTATION_ECOSYSTEMS = Object.freeze({
    node: "typescript"
});
export function languageEcosystemId(languageOrTarget) {
    return IMPLEMENTATION_ECOSYSTEMS[languageOrTarget] ?? languageOrTarget;
}
export function languageEcosystemRoot(repositoryRoot, languageOrTarget) {
    return path.join(repositoryRoot, "languages", languageEcosystemId(languageOrTarget));
}

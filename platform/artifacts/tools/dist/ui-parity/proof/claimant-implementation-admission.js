import fs from "node:fs";
import path from "node:path";
export function admitUiClaimantImplementation(repositoryRoot, implementationRef, target, objectModel) {
    const manifestPath = path.join(repositoryRoot, implementationRef);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const findings = [];
    if (manifest.embodimentTarget !== target)
        findings.push(`Static implementation target '${manifest.embodimentTarget}' does not match '${target}'.`);
    const required = new Set(objectModel.concepts.map((concept) => concept.conceptId));
    const claims = manifest.conceptGroups.flatMap((group) => group.conceptIds.map((conceptId) => ({ conceptId, group })));
    const counts = new Map();
    for (const claim of claims)
        counts.set(claim.conceptId, (counts.get(claim.conceptId) ?? 0) + 1);
    findings.push(...[...required].filter((conceptId) => !counts.has(conceptId)).map((conceptId) => `${target} does not statically implement ${conceptId}.`));
    findings.push(...[...counts].filter(([, count]) => count !== 1).map(([conceptId, count]) => `${target} claims ${conceptId} ${count} times.`));
    findings.push(...[...counts.keys()].filter((conceptId) => !required.has(conceptId)).map((conceptId) => `${target} claims undeclared semantic concept ${conceptId}.`));
    for (const group of manifest.conceptGroups) {
        const sourcePath = path.join(repositoryRoot, group.implementationRef);
        if (!fs.existsSync(sourcePath)) {
            findings.push(`${target} implementation source '${group.implementationRef}' does not exist.`);
            continue;
        }
        const source = fs.readFileSync(sourcePath, "utf8");
        findings.push(...group.conceptIds.filter((conceptId) => !new RegExp(`\\b${conceptId}\\b`).test(source))
            .map((conceptId) => `${target} source '${group.implementationRef}' does not contain native representation ${conceptId}.`));
    }
    return Object.freeze({ target, claimedConceptCount: claims.length, requiredConceptCount: required.size,
        findings: Object.freeze(findings), disposition: findings.length === 0 ? "PASS" : "FAIL" });
}

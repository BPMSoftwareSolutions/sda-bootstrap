import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const excluded = new Set([".git", ".venv", "bin", "dist", "node_modules", "obj", "target", "__pycache__"]);
function walk(resolvedPath, files) {
    if (!fs.existsSync(resolvedPath))
        return;
    const stat = fs.statSync(resolvedPath);
    if (stat.isFile()) {
        files.add(path.resolve(resolvedPath));
        return;
    }
    if (!stat.isDirectory() || excluded.has(path.basename(resolvedPath)))
        return;
    for (const entry of fs.readdirSync(resolvedPath, { withFileTypes: true })) {
        if (entry.isDirectory() && excluded.has(entry.name))
            continue;
        walk(path.join(resolvedPath, entry.name), files);
    }
}
export function consumerPlatformInputDigest(repositoryRoot, language, catalog) {
    const files = new Set();
    for (const common of [
        "package.json",
        "kernel/semantic-authority/consumer",
        "kernel/schemas/sda-language-mechanic-profile-resolution.schema.json",
        "kernel/schemas/sda-platform-capability-catalog.schema.json",
        "kernel/schemas/sda-platform-mechanic-parity.schema.json",
        "capabilities/sda-tooling/consumer-capability-compilation",
        "capabilities/sda-tooling/consumer-assurance",
        "tools/src/consumer-projection",
        "tools/src/capabilities/consumer-capability-compilation",
        "tools/src/capabilities/consumer-assurance",
        "tools/src/interfaces/consumer-projection",
        "tools/tests/consumer-projection"
    ])
        walk(path.join(repositoryRoot, common), files);
    for (const capability of catalog.capabilities.filter((item) => item.projectionTarget === language)) {
        walk(path.join(repositoryRoot, capability.implementationRef), files);
        walk(path.join(repositoryRoot, capability.conformanceRef), files);
    }
    const hash = createHash("sha256");
    for (const file of [...files].sort()) {
        const relative = path.relative(repositoryRoot, file).split(path.sep).join("/");
        const content = fs.readFileSync(file);
        hash.update(`file:${relative}:${content.length}\0`);
        hash.update(content);
        hash.update("\0");
    }
    hash.update(`catalog:${JSON.stringify(catalog)}\0`);
    hash.update(`language:${language}\0`);
    return `sha256:${hash.digest("hex")}`;
}
export function consumerProofIsCurrent(repositoryRoot, language, observation, catalog) {
    return Boolean(observation?.conforming && observation.proofInputDigest === consumerPlatformInputDigest(repositoryRoot, language, catalog));
}

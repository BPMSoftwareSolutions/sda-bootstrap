"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const excluded = new Set([".git", ".mypy_cache", ".pytest_cache", ".venv", "__pycache__", "bin", "dist", "node_modules", "obj", "target"]);
function stable(value) { if (Array.isArray(value))
    return value.map(stable); if (value && typeof value === "object") {
    const record = value;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stable(record[key])]));
} return value; }
function walk(resolvedPath, files) { if (!fs.existsSync(resolvedPath))
    return; const stat = fs.statSync(resolvedPath); if (stat.isFile()) {
    files.add(path.resolve(resolvedPath));
    return;
} if (!stat.isDirectory() || excluded.has(path.basename(resolvedPath)))
    return; for (const entry of fs.readdirSync(resolvedPath, { withFileTypes: true })) {
    if (entry.isDirectory() && excluded.has(entry.name))
        continue;
    walk(path.join(resolvedPath, entry.name), files);
} }
function observedBehavior(repositoryRoot, language) { const observationPath = path.join(repositoryRoot, "artifacts", "conformance", "behavioral-observations.json"); if (!fs.existsSync(observationPath))
    return { missing: true }; const document = JSON.parse(fs.readFileSync(observationPath, "utf8")); return document.results?.[language] ?? { missing: true }; }
function computeAdmissionInputDigest(repositoryRoot, obligation) { const { language, binding } = obligation; const ecosystem = language === "node" ? "typescript" : language; const languageRoot = path.join(repositoryRoot, "languages", ecosystem); const bindingPath = obligation.bindingPath ?? path.join(languageRoot, "binding", `scenario-kernel-${language}.binding.json`); const files = new Set(); for (const common of ["package.json", "capabilities/sda-tooling/catalog.json", "capabilities/sda-tooling/workspace-governance", "capabilities/sda-tooling/kernel-implementation-admission", "capabilities/sda-tooling/conformance-evidence-publication", "governance/workspace/governance-rules.json", "kernel/contracts", "kernel/schemas", "kernel/specification", "conformance", "tools/src/conformance", "tools/src/capabilities/workspace-governance", "tools/src/capabilities/kernel-implementation-admission", "tools/src/capabilities/conformance-evidence-publication", "tools/src/adapters/conformance", "tools/src/interfaces/conformance", "tools/tests/conformance"])
    walk(path.join(repositoryRoot, common), files); walk(bindingPath, files); walk(path.join(languageRoot, "conformance", `${binding.implementationId}.conformance.json`), files); const references = binding["projectReferences"]; if (references && typeof references === "object")
    for (const relative of Object.values(references))
        if (typeof relative === "string")
            walk(path.join(languageRoot, relative), files); const hash = crypto.createHash("sha256"); for (const file of [...files].sort()) {
    const relative = path.relative(repositoryRoot, file).split(path.sep).join("/");
    const content = fs.readFileSync(file);
    hash.update(`file:${relative}:${content.length}\0`);
    hash.update(content);
    hash.update("\0");
} hash.update(`binding:${JSON.stringify(stable(binding))}\0`); hash.update(`behavioral:${JSON.stringify(stable(observedBehavior(repositoryRoot, language)))}\0`); return `sha256:${hash.digest("hex")}`; }
function admissionArtifactIsCurrent(repositoryRoot, obligation, artifact) { return Boolean(artifact && typeof artifact.proofInputDigest === "string" && artifact.proofInputDigest === computeAdmissionInputDigest(repositoryRoot, obligation)); }
module.exports = { computeAdmissionInputDigest, admissionArtifactIsCurrent, stable };

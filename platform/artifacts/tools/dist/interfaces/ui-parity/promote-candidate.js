#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AjvSchemaAdmission } from "../../adapters/contracts/ajv-schema-admission.cjs";
import { evaluateUiCandidate } from "./evaluate-candidate.js";
function repositoryRoot() { return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../.."); }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function target(value) {
    if (!/^[a-z][a-z0-9-]*$/u.test(value))
        throw new Error(`Invalid UI claimant target '${value}'.`);
    return value;
}
function validate(admission, value, schema) {
    const result = admission.validate(value, schema);
    if (!result.valid)
        throw new Error(`${schema}: ${result.errors.map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
}
export function promoteUiCandidate(workspaceRoot, requestedTarget) {
    const root = path.resolve(workspaceRoot);
    const evidenceRoot = path.join(root, "projected", "ui-parity");
    const candidateRoot = path.join(evidenceRoot, "candidates", requestedTarget);
    const registry = read(path.join(evidenceRoot, "targets.json"));
    if (!registry.admittedTargets.includes(requestedTarget))
        throw new Error(`UI claimant '${requestedTarget}' is not catalog-admitted; candidate evidence cannot be promoted.`);
    const admission = new AjvSchemaAdmission(path.join(repositoryRoot(), "kernel", "schemas"));
    const admissionEvidence = evaluateUiCandidate(root, requestedTarget);
    validate(admission, admissionEvidence, "consumer-ui-claimant-native-admission-evidence.schema.json");
    if (admissionEvidence.claimantTarget !== requestedTarget || admissionEvidence.disposition !== "READY_FOR_ADMISSION" ||
        admissionEvidence.crossApplyProof.experienceParity !== "PASS" || !admissionEvidence.crossApplyProof.targets.includes(requestedTarget)) {
        throw new Error(`UI claimant '${requestedTarget}' has no admissible native proof.`);
    }
    const artifacts = [
        ["testimony", "consumer-ui-testimony.schema.json"],
        ["presentation-testimony", "consumer-ui-presentation-testimony.schema.json"],
        ["wiring", "consumer-ui-wiring-conformance.schema.json"],
        ["structural-testimony", "consumer-ui-structural-testimony.schema.json"]
    ];
    const promoted = [];
    for (const [suffix, schema] of artifacts) {
        const source = path.join(candidateRoot, `${requestedTarget}-${suffix}.json`);
        const destination = path.join(evidenceRoot, `${requestedTarget}-${suffix}.json`);
        validate(admission, read(source), schema);
        fs.copyFileSync(source, destination);
        promoted.push(path.relative(root, destination).replaceAll(path.sep, "/"));
    }
    return { claimantTarget: requestedTarget, disposition: "PROMOTED_ADMITTED_EVIDENCE", promoted };
}
async function main() {
    const workspace = process.argv[2];
    const requestedTarget = process.argv[3];
    if (!workspace || !requestedTarget)
        throw new Error("Usage: promote-ui-candidate <consumer-workspace> <target>");
    process.stdout.write(`${JSON.stringify(promoteUiCandidate(workspace, target(requestedTarget)))}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}

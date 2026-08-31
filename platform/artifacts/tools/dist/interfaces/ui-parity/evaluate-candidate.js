#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AjvSchemaAdmission } from "../../adapters/contracts/ajv-schema-admission.cjs";
import { loadUiParityWorkspace } from "../../ui-parity/proof/canonical-ui-authority.js";
import { UiParityEvaluator } from "../../ui-parity/proof/ui-parity-evaluator.js";
function repositoryRoot() { return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../.."); }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function validate(admission, value, schema) {
    const result = admission.validate(value, schema);
    if (!result.valid)
        throw new Error(`${schema}: ${result.errors.map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
}
function target(value) {
    if (!/^[a-z][a-z0-9-]*$/u.test(value))
        throw new Error(`Invalid UI claimant target '${value}'.`);
    return value;
}
function admittedClaimant(evidenceRoot, claimantTarget) {
    return {
        target: claimantTarget,
        testimony: read(path.join(evidenceRoot, `${claimantTarget}-testimony.json`)),
        presentation: read(path.join(evidenceRoot, `${claimantTarget}-presentation-testimony.json`)),
        wiring: read(path.join(evidenceRoot, `${claimantTarget}-wiring.json`)),
        structure: read(path.join(evidenceRoot, `${claimantTarget}-structural-testimony.json`))
    };
}
function candidateClaimant(candidateRoot, claimantTarget) {
    return {
        target: claimantTarget,
        testimony: read(path.join(candidateRoot, `${claimantTarget}-testimony.json`)),
        presentation: read(path.join(candidateRoot, `${claimantTarget}-presentation-testimony.json`)),
        wiring: read(path.join(candidateRoot, `${claimantTarget}-wiring.json`)),
        structure: read(path.join(candidateRoot, `${claimantTarget}-structural-testimony.json`))
    };
}
function validateClaimant(admission, claimant) {
    validate(admission, claimant.testimony, "consumer-ui-testimony.schema.json");
    validate(admission, claimant.presentation, "consumer-ui-presentation-testimony.schema.json");
    validate(admission, claimant.wiring, "consumer-ui-wiring-conformance.schema.json");
    validate(admission, claimant.structure, "consumer-ui-structural-testimony.schema.json");
}
export function evaluateUiCandidate(workspaceRoot, requestedTarget) {
    const root = path.resolve(workspaceRoot);
    const evidenceRoot = path.join(root, "projected", "ui-parity");
    const candidateRoot = path.join(evidenceRoot, "candidates", requestedTarget);
    const documents = loadUiParityWorkspace(root);
    const registry = read(path.join(evidenceRoot, "targets.json"));
    const registryClaim = registry.claimants.find((claimant) => claimant.target === requestedTarget);
    if (!registryClaim)
        throw new Error(`UI claimant '${requestedTarget}' is not registered.`);
    const staticDisposition = registryClaim.implementationDisposition === "NATIVE_PROOF_ADMITTED"
        ? "PASS" : registryClaim.staticImplementation?.disposition ?? "FAIL";
    const objectModel = read(path.join(evidenceRoot, "object-model.json"));
    const admission = new AjvSchemaAdmission(path.join(repositoryRoot(), "kernel", "schemas"));
    validate(admission, documents.identity, "consumer-ui-authority-identity.schema.json");
    validate(admission, documents.vectors, "consumer-ui-vector.schema.json");
    validate(admission, objectModel, "consumer-ui-object-model.schema.json");
    const baselineTargets = registry.admittedTargets.filter((claimantTarget) => claimantTarget !== requestedTarget);
    const admitted = baselineTargets.map((claimantTarget) => admittedClaimant(evidenceRoot, claimantTarget));
    const candidate = candidateClaimant(candidateRoot, requestedTarget);
    admitted.forEach((claimant) => validateClaimant(admission, claimant));
    validateClaimant(admission, candidate);
    const proof = new UiParityEvaluator().evaluate({
        identity: documents.identity, objectModel, vectors: documents.vectors, coverage: documents.coverage,
        claimants: [...admitted, candidate]
    });
    validate(admission, proof, "consumer-ui-parity-evidence.schema.json");
    const findings = [
        ...(staticDisposition === "PASS" ? [] : [`${requestedTarget} static semantic implementation admission is not PASS.`]),
        ...Object.entries(proof.gates).filter(([, gate]) => gate.disposition === "FAIL")
            .flatMap(([id, gate]) => gate.findings.length > 0 ? gate.findings : [`${id} failed.`]),
        ...Object.entries(proof.targetGates[requestedTarget] ?? {}).filter(([, gate]) => gate.disposition === "FAIL")
            .flatMap(([id, gate]) => gate.findings.length > 0 ? gate.findings : [`${requestedTarget}:${id} failed.`])
    ];
    const disposition = findings.length === 0 && proof.experienceParity === "PASS" ? "READY_FOR_ADMISSION" : "REJECTED";
    const evidence = {
        admissionEvidenceType: "consumer-ui-claimant-native-admission-evidence.v1",
        applicationId: documents.identity.applicationId,
        claimantTarget: requestedTarget,
        baselineTargets,
        candidateEvidenceRoot: path.relative(root, candidateRoot).replaceAll(path.sep, "/"),
        schemaAdmission: { testimony: "PASS", presentation: "PASS", wiring: "PASS", structure: "PASS" },
        staticImplementationDisposition: staticDisposition,
        crossApplyProof: proof,
        findings,
        disposition
    };
    validate(admission, evidence, "consumer-ui-claimant-native-admission-evidence.schema.json");
    fs.writeFileSync(path.join(candidateRoot, `${requestedTarget}-native-admission-evidence.json`), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    return evidence;
}
async function main() {
    const workspace = process.argv[2];
    const requestedTarget = process.argv[3];
    if (!workspace || !requestedTarget)
        throw new Error("Usage: evaluate-ui-candidate <consumer-workspace> <target>");
    const evidence = evaluateUiCandidate(workspace, target(requestedTarget));
    process.stdout.write(`${JSON.stringify({
        claimantTarget: evidence.claimantTarget, baselineTargets: evidence.baselineTargets,
        proofCellCount: evidence.crossApplyProof.proofCellCount, experienceParity: evidence.crossApplyProof.experienceParity,
        disposition: evidence.disposition, findings: evidence.findings
    })}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}

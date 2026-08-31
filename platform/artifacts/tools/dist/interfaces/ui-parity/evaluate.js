#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AjvSchemaAdmission } from "../../adapters/contracts/ajv-schema-admission.cjs";
import { ConsumerAssuranceService } from "../../consumer-projection/application/consumer-assurance-service.js";
import { loadUiParityWorkspace } from "../../ui-parity/proof/canonical-ui-authority.js";
function repositoryRoot() { return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../.."); }
function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function validate(admission, value, schema) {
    const result = admission.validate(value, schema);
    if (!result.valid)
        throw new Error(`${schema}: ${result.errors.map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
}
export async function evaluateUiParity(workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    const documents = loadUiParityWorkspace(root);
    const evidenceRoot = path.join(root, "projected", "ui-parity");
    const registry = read(path.join(evidenceRoot, "targets.json"));
    const objectModel = read(path.join(evidenceRoot, "object-model.json"));
    const admission = new AjvSchemaAdmission(path.join(repositoryRoot(), "kernel", "schemas"));
    validate(admission, documents.identity, "consumer-ui-authority-identity.schema.json");
    validate(admission, documents.vectors, "consumer-ui-vector.schema.json");
    validate(admission, objectModel, "consumer-ui-object-model.schema.json");
    for (const target of registry.declaredTargets) {
        const unadmittedEvidence = ["testimony", "presentation-testimony", "wiring", "structural-testimony"]
            .map((suffix) => path.join(evidenceRoot, `${target}-${suffix}.json`)).filter((file) => fs.existsSync(file));
        if (unadmittedEvidence.length > 0)
            throw new Error(`UNADMITTED_UI_CLAIMANT_EVIDENCE: '${target}' cannot enter parity evaluation while catalog status is DECLARED.`);
    }
    const claimants = registry.admittedTargets.map((target) => {
        const testimony = read(path.join(evidenceRoot, `${target}-testimony.json`));
        const presentation = read(path.join(evidenceRoot, `${target}-presentation-testimony.json`));
        const wiring = read(path.join(evidenceRoot, `${target}-wiring.json`));
        const structure = read(path.join(evidenceRoot, `${target}-structural-testimony.json`));
        validate(admission, testimony, "consumer-ui-testimony.schema.json");
        validate(admission, presentation, "consumer-ui-presentation-testimony.schema.json");
        validate(admission, wiring, "consumer-ui-wiring-conformance.schema.json");
        validate(admission, structure, "consumer-ui-structural-testimony.schema.json");
        return { target, testimony, presentation, wiring, structure };
    });
    const assurance = await new ConsumerAssuranceService(repositoryRoot()).proveCrossApplyUiParity(root, {
        identity: documents.identity, objectModel, vectors: documents.vectors, coverage: documents.coverage, claimants
    });
    const evidence = assurance.closure.evidence;
    if (!evidence || assurance.closure.obligationDisposition.kind !== "SATISFIED") {
        throw new Error(`Cross-apply UI parity did not close: kernel=${assurance.closure.kernelDisposition} obligation=${assurance.closure.obligationDisposition.kind}`);
    }
    validate(admission, evidence, "consumer-ui-parity-evidence.schema.json");
    return evidence;
}
async function main() {
    const workspace = process.argv[2];
    if (!workspace)
        throw new Error("Usage: evaluate-ui-parity <consumer-workspace>");
    const evidence = await evaluateUiParity(path.resolve(workspace));
    process.stdout.write(`${JSON.stringify({
        targets: evidence.targets, proofCellCount: evidence.proofCellCount,
        crossApplyDisposition: evidence.crossApplyDisposition, experienceParity: evidence.experienceParity,
        gates: Object.fromEntries(Object.entries(evidence.gates).map(([id, value]) => [id, value.disposition])),
        targetGates: Object.fromEntries(Object.entries(evidence.targetGates).map(([target, gates]) => [target, Object.fromEntries(Object.entries(gates ?? {}).map(([id, value]) => [id, value.disposition]))]))
    })}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}

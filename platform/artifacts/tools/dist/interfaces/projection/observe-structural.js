import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { NodeProjectionRepository } from "../../adapters/projection/node-projection-repository.js";
import { NodeTargetToolchain } from "../../adapters/projection/node-target-toolchain.js";
import { TransactionalProjectionMaterializer } from "../../adapters/projection/transactional-projection-materializer.js";
import { generateStructuralModel } from "../structural-model-projection/generate-structural-model.js";
import { projectedShapeObserver } from "../../projection/proof/projected-shape-observer-registry.js";
import { discoverProjectionTargets } from "../../projection/proof/projection-observation.js";
import { NodeLanguageTargetRegistry } from "../../adapters/projection/node-language-target-registry.js";
export const STRUCTURAL_OBSERVATION_PATH = path.join("artifacts", "projection", "projection-observations.json");
function unavailable(target) {
    return Object.freeze({
        command: `${target} structural projection compiler`,
        ran: false,
        exitCode: null,
        conforming: false,
        reason: "required toolchain is not available"
    });
}
export function observeStructuralProjection(repositoryRoot, target) {
    const clock = new SystemClock();
    const repository = new NodeProjectionRepository(repositoryRoot, clock);
    const build = generateStructuralModel(repositoryRoot, target);
    const evidence = projectedShapeObserver(target, repositoryRoot).observe(repository.loadAdmittedSource(target).value, build.plan);
    const mismatched = evidence.results
        .filter((item) => item.status === "MISMATCH")
        .map((item) => ({ typeName: item.typeName, detail: item.detail ?? "" }));
    const handWrittenOnly = evidence.results.filter((item) => item.status === "HAND_WRITTEN_ONLY").map((item) => item.typeName);
    const generatedOnly = evidence.results.filter((item) => item.status === "GENERATED_ONLY").map((item) => item.typeName);
    const shapeConforming = mismatched.length === 0 && handWrittenOnly.length === 0 && generatedOnly.length === 0;
    const registry = new NodeLanguageTargetRegistry(repositoryRoot);
    const registration = registry.registration(target);
    const toolchain = new NodeTargetToolchain(repositoryRoot, target);
    const available = toolchain.available();
    let toolchainValidation = unavailable(target);
    if (available) {
        const transaction = new TransactionalProjectionMaterializer(repositoryRoot).stage(build.plan, {
            preserveExistingFiles: true,
            managedFileExtensions: registration.promotion.managedExtensions
        });
        try {
            transaction.activate();
            toolchainValidation = toolchain.compileStructural();
            if (toolchainValidation.conforming && shapeConforming)
                transaction.commit();
            else
                transaction.rollback();
        }
        catch (error) {
            transaction.rollback();
            toolchainValidation = Object.freeze({
                command: `${target} structural projection transaction`,
                ran: true,
                exitCode: 1,
                conforming: false,
                reason: error instanceof Error ? error.message : String(error)
            });
        }
    }
    const conforming = available && toolchainValidation.conforming && shapeConforming;
    const targetRoot = path.relative(repositoryRoot, registry.targetRoot(target));
    return Object.freeze({
        projectionConformanceType: "scenario-kernel-projection-conformance.v1",
        language: target,
        implementationId: build.profile.implementationId,
        observedAt: clock.now(),
        profilePath: path.join(targetRoot, registration.projectionProfileRef),
        disposition: !available ? "NOT_OBSERVABLE" : conforming ? "SATISFIED" : "NOT_SATISFIED",
        generation: { typesGenerated: build.targetGraph.definitions.length, outputDirectory: path.join(targetRoot, build.plan.outputDirectory) },
        toolchainValidation,
        structuralComparison: {
            totalTypes: evidence.totalCount,
            matched: evidence.matchCount,
            mismatched,
            handWrittenOnly,
            generatedOnly
        },
        conforming
    });
}
export function recordStructuralProjectionObservations(repositoryRoot) {
    const results = {};
    for (const target of discoverProjectionTargets(repositoryRoot)) {
        process.stdout.write(`\n--- observing structural projection: ${target} ---\n`);
        results[target] = observeStructuralProjection(repositoryRoot, target);
        process.stdout.write(`  [${target}] structural=${results[target].structuralComparison.matched}/${results[target].structuralComparison.totalTypes} toolchain=${results[target].toolchainValidation.conforming}\n`);
    }
    const observationPath = path.join(repositoryRoot, STRUCTURAL_OBSERVATION_PATH);
    fs.mkdirSync(path.dirname(observationPath), { recursive: true });
    fs.writeFileSync(observationPath, `${JSON.stringify({ observedAt: new SystemClock().now(), results }, null, 2)}\n`, "utf8");
    return Object.freeze(results);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    recordStructuralProjectionObservations(process.cwd());
}

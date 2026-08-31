import fs from "node:fs";
import path from "node:path";
import { TransactionalProjectionMaterializer } from "../../adapters/projection/transactional-projection-materializer.js";
import { NodeTargetToolchain } from "../../adapters/projection/node-target-toolchain.js";
import { PromoteProvenImplementationObligation } from "../../capabilities/projected-implementation-promotion/promote-proven-implementation/obligation.js";
import { PromoteProvenImplementationProvider } from "../../capabilities/projected-implementation-promotion/promote-proven-implementation/provider.js";
import { generateExecutionVector } from "../execution-vector-projection/generate-execution-vector.js";
import { evaluateExecutionProjection, evaluateStructuralProjection } from "../projection/evaluate-observation.js";
import { generateStructuralModel } from "../structural-model-projection/generate-structural-model.js";
import { NodeLanguageTargetRegistry } from "../../adapters/projection/node-language-target-registry.js";
import { loadBoundProvider } from "../../host/load-provider.js";
export async function promoteProvenProjection(options) {
    const evaluation = options.plane === "structural"
        ? evaluateStructuralProjection(options.repositoryRoot, options.target)
        : evaluateExecutionProjection(options.repositoryRoot, options.target);
    if (!evaluation.observed || !evaluation.conforming) {
        throw new Error(`Cannot promote ${options.target} ${options.plane} projection without current conforming evidence.`);
    }
    const registration = new NodeLanguageTargetRegistry(options.repositoryRoot).registration(options.target);
    const structuralPromotionOverrides = registration.promotion.structuralProfileOverrides ?? {
        outputDirectory: registration.promotion.structuralOutputDirectory
    };
    const plan = options.plane === "structural"
        ? generateStructuralModel(options.repositoryRoot, options.target, structuralPromotionOverrides).plan
        : generateExecutionVector(options.repositoryRoot, options.target).plan;
    const preserveExistingFiles = options.plane === "structural" && registration.promotion.preserveExistingStructuralFiles;
    const transaction = new TransactionalProjectionMaterializer(options.repositoryRoot).stage(plan, {
        preserveExistingFiles,
        managedFileExtensions: registration.promotion.managedExtensions
    });
    try {
        transaction.activate();
        const toolchain = new NodeTargetToolchain(options.repositoryRoot, options.target);
        if (!toolchain.available())
            throw new Error(`Required '${options.target}' toolchain became unavailable before promotion.`);
        const compile = options.plane === "structural" ? toolchain.compileStructural() : toolchain.compileExecution();
        const behavior = options.plane === "execution" && compile.conforming ? toolchain.proveExecutionBehavior() : undefined;
        if (!compile.conforming || (behavior && !behavior.conforming)) {
            throw new Error(`Promoted candidate failed fresh ${options.plane} proof: ${compile.reason ?? compile.stderr ?? behavior?.reason ?? behavior?.stderr ?? "toolchain rejected candidate"}`);
        }
        transaction.commit();
    }
    catch (error) {
        transaction.rollback();
        throw error;
    }
    const manifestPath = path.join(transaction.destination, ".sda-projection-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const legacyProvider = new PromoteProvenImplementationProvider();
    const provider = await loadBoundProvider(options.repositoryRoot, "projected-implementation-promotion", legacyProvider);
    const evidence = await provider.execute({
        proofConforming: true,
        committed: true,
        planDigests: plan.files.map((file) => file.digest),
        manifestDigests: manifest.files.map((file) => file.digest)
    });
    return { evidence, disposition: new PromoteProvenImplementationObligation().evaluate(evidence) };
}

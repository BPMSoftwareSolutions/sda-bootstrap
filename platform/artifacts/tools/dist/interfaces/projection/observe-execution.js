import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SystemClock } from "../../adapters/clock/system-clock.js";
import { NodeProjectionRepository } from "../../adapters/projection/node-projection-repository.js";
import { NodeTargetToolchain } from "../../adapters/projection/node-target-toolchain.js";
import { TransactionalProjectionMaterializer } from "../../adapters/projection/transactional-projection-materializer.js";
import { generateExecutionVector } from "../execution-vector-projection/generate-execution-vector.js";
import { discoverProjectionTargets } from "../../projection/proof/projection-observation.js";
export const EXECUTION_OBSERVATION_PATH = path.join("artifacts", "projection", "execution-vector-observations.json");
function unavailable(target, plane) {
    return Object.freeze({ command: `${target} ${plane}`, ran: false, exitCode: null, conforming: false, reason: "required toolchain is not available" });
}
export function observeExecutionProjection(repositoryRoot, target) {
    const clock = new SystemClock();
    const repository = new NodeProjectionRepository(repositoryRoot, clock);
    const build = generateExecutionVector(repositoryRoot, target);
    const toolchain = new NodeTargetToolchain(repositoryRoot, target);
    const available = toolchain.available();
    let toolchainValidation = unavailable(target, "execution projection compiler");
    let behavioralValidation = unavailable(target, "execution projection behavioral proof");
    if (available) {
        const transaction = new TransactionalProjectionMaterializer(repositoryRoot).stage(build.plan);
        try {
            transaction.activate();
            toolchainValidation = toolchain.compileExecution();
            behavioralValidation = toolchainValidation.conforming
                ? toolchain.proveExecutionBehavior()
                : Object.freeze({ command: `${target} execution projection behavioral proof`, ran: false, exitCode: null, conforming: false, reason: "compiler proof failed" });
            if (toolchainValidation.conforming && behavioralValidation.conforming)
                transaction.commit();
            else
                transaction.rollback();
        }
        catch (error) {
            transaction.rollback();
            toolchainValidation = Object.freeze({
                command: `${target} execution projection transaction`, ran: true, exitCode: 1, conforming: false,
                reason: error instanceof Error ? error.message : String(error)
            });
            behavioralValidation = Object.freeze({ command: `${target} execution projection behavioral proof`, ran: false, exitCode: null, conforming: false, reason: "publication transaction failed" });
        }
    }
    const conforming = available && toolchainValidation.conforming && behavioralValidation.conforming;
    return Object.freeze({
        executionVectorProjectionConformanceType: "scenario-kernel-execution-vector-projection-conformance.v1",
        language: target,
        observedAt: clock.now(),
        disposition: !available ? "NOT_OBSERVABLE" : conforming ? "SATISFIED" : "NOT_SATISFIED",
        toolchainValidation,
        behavioralValidation: { ...behavioralValidation, totalFixtures: repository.fixtureCount() },
        conforming
    });
}
export function recordExecutionProjectionObservations(repositoryRoot) {
    const results = {};
    for (const target of discoverProjectionTargets(repositoryRoot)) {
        process.stdout.write(`\n--- observing execution projection: ${target} ---\n`);
        results[target] = observeExecutionProjection(repositoryRoot, target);
        process.stdout.write(`  [${target}] toolchain=${results[target].toolchainValidation.conforming} behavioral=${results[target].behavioralValidation.conforming}\n`);
    }
    const observationPath = path.join(repositoryRoot, EXECUTION_OBSERVATION_PATH);
    fs.mkdirSync(path.dirname(observationPath), { recursive: true });
    fs.writeFileSync(observationPath, `${JSON.stringify({ observedAt: new SystemClock().now(), results }, null, 2)}\n`, "utf8");
    return Object.freeze(results);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    recordExecutionProjectionObservations(process.cwd());
}

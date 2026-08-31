import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ScenarioKernel as GeneratedScenarioKernel } from "../../src/generated-execution/scenario-kernel-execution.js";
import { ScenarioKernel as HandwrittenScenarioKernel } from "../../src/kernel/scenario-kernel.js";
import { FixtureDrivenContractValidator } from "../conformance/fixture-driven-contract-validator.js";
import { FixtureDrivenSemanticExecutor } from "../conformance/fixture-driven-semantic-executor.js";
import { PassthroughExecutionAuthorityResolver } from "../conformance/passthrough-execution-authority-resolver.js";
import { InMemoryExecutionObserver } from "../conformance/in-memory-execution-observer.js";
import { resolveExpectation } from "../conformance/expectation-catalog.js";
import { corpusExecutionDirectory } from "../conformance/repository-paths.js";
/**
 * Runs the exact same shared fixtures used to prove the hand-written
 * kernel (test/conformance/execution-vector.test.ts) through the
 * PROJECTED kernel instead — tools/projection/projects-node-execution-
 * vector.js's output. The existing fixture-driven test doubles are reused
 * completely unmodified: TypeScript's structural typing means a class
 * satisfying the hand-written ContractValidator/SemanticExecutor/
 * ExecutionAuthorityResolver/ExecutionObserver interfaces also satisfies
 * the generated ones, as long as the shapes genuinely match — which is
 * itself a small additional confirmation that the generated port shapes
 * are correct, not just that the kernel body compiles.
 *
 * Lives in test/projection/, not test/conformance/, specifically so
 * `npm test` (which globs dist/test/conformance/ only — see
 * package.json) never picks this up. Projection conformance is a
 * separate, non-admission-gating proof plane — see
 * tools/projection/observes-execution-vector-projection.js.
 */
const fixtureFiles = fs
    .readdirSync(corpusExecutionDirectory)
    .filter((file) => file.endsWith(".json"))
    .sort();
for (const file of fixtureFiles) {
    test(`generated kernel: fixture ${file} produces the expected disposition`, async () => {
        const fixturePath = path.join(corpusExecutionDirectory, file);
        const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
        const expectation = resolveExpectation(fixture.expectationId);
        assert.equal(fixture.fixtureId, expectation.fixtureId);
        const admissionBehaviors = [fixture.admitInput];
        if (fixture.admitOutcome) {
            admissionBehaviors.push(fixture.admitOutcome);
        }
        const executionId = `${fixture.fixtureId}.execution`;
        const execute = async (generated) => {
            const observer = new InMemoryExecutionObserver();
            const contracts = new FixtureDrivenContractValidator([...admissionBehaviors]);
            const authority = new PassthroughExecutionAuthorityResolver();
            const executor = new FixtureDrivenSemanticExecutor(fixture.executeEventAuthority ?? { outcome: "succeed" });
            const dispositions = { resolve: () => fixture.scenario.outcome.terminal ? "terminated" : "completed" };
            const clock = { now: () => "2026-08-10T00:00:00.000Z" };
            const kernel = generated
                ? new GeneratedScenarioKernel(contracts, authority, executor, dispositions, observer, clock)
                : new HandwrittenScenarioKernel(contracts, authority, executor, dispositions, observer, clock);
            const result = await kernel.execute(fixture.scenario, {
                executionId,
                rootExecutionId: executionId,
                input: fixture.input
            });
            return { result, observations: observer.observations };
        };
        const generated = await execute(true);
        const handwritten = await execute(false);
        assert.equal(generated.result.disposition, expectation.expected.disposition);
        assert.ok(generated.observations.length > 0, "the generated kernel must emit execution-vector observations just like the hand-written one");
        assert.deepEqual(generated.result, handwritten.result);
        assert.deepEqual(generated.observations, handwritten.observations);
    });
}

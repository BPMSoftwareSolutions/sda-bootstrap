import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ScenarioKernel, DispositionResolver } from "../../src/kernel/index.js";
import { FixtureDrivenContractValidator } from "./fixture-driven-contract-validator.js";
import { FixtureDrivenSemanticExecutor } from "./fixture-driven-semantic-executor.js";
import { PassthroughExecutionAuthorityResolver } from "./passthrough-execution-authority-resolver.js";
import { InMemoryExecutionObserver } from "./in-memory-execution-observer.js";
import { resolveExpectation } from "./expectation-catalog.js";
import { corpusExecutionDirectory } from "./repository-paths.js";
/**
 * The canonical execution-vector step order — mirrors
 * kernel/contracts/execution/scenario-kernel-execution-vector.json. Kept
 * as a local literal rather than read from disk: this file already proves
 * kernel BEHAVIOR against that same canonical instance via the fixture
 * corpus, so re-deriving step order here is a second, independent check
 * that the emitted trace agrees with what the fixture corpus already
 * proved about disposition.
 */
const CANONICAL_STEP_ORDER = [
    "admit-input",
    "resolve-event-authority",
    "execute-event-authority",
    "admit-outcome",
    "resolve-disposition"
];
/**
 * Runs every canonical fixture under conformance/corpus/execution/ through
 * the real ScenarioKernel and the real DispositionResolver — only the
 * three adapter-variable steps (admit-input, execute-event-authority,
 * admit-outcome) are test doubles, driven strictly by what each fixture
 * prescribes. This is the same shared corpus the C# embodiment consumes;
 * nothing here is Node-specific except the harness running it.
 */
const fixtureFiles = fs
    .readdirSync(corpusExecutionDirectory)
    .filter((file) => file.endsWith(".json"))
    .sort();
for (const file of fixtureFiles) {
    test(`fixture ${file} produces the expected disposition`, async () => {
        const fixturePath = path.join(corpusExecutionDirectory, file);
        const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
        const expectation = resolveExpectation(fixture.expectationId);
        assert.equal(fixture.fixtureId, expectation.fixtureId);
        const admissionBehaviors = [fixture.admitInput];
        if (fixture.admitOutcome) {
            admissionBehaviors.push(fixture.admitOutcome);
        }
        const observer = new InMemoryExecutionObserver();
        const kernel = new ScenarioKernel(new FixtureDrivenContractValidator(admissionBehaviors), new PassthroughExecutionAuthorityResolver(), new FixtureDrivenSemanticExecutor(fixture.executeEventAuthority ?? { outcome: "succeed" }), new DispositionResolver(), observer, { now: () => "2026-08-10T00:00:00.000Z" });
        const executionId = `${fixture.fixtureId}.execution`;
        const result = await kernel.execute(fixture.scenario, {
            executionId,
            rootExecutionId: executionId,
            input: fixture.input
        });
        assert.equal(result.disposition, expectation.expected.disposition);
        // Execution closure: the observed trace must be an exact, gap-free
        // prefix of the canonical vector, in canonical order, with every
        // observation sharing this execution's lineage. See governance rules
        // K011-K013 and kernel/schemas/scenario-execution-observation.schema.json.
        const observedStepIds = observer.observations.map((o) => o.stepId);
        const expectedStepIds = CANONICAL_STEP_ORDER.slice(0, observedStepIds.length);
        assert.deepEqual(observedStepIds, expectedStepIds, `observed steps ${JSON.stringify(observedStepIds)} are not a canonical-order prefix of ${JSON.stringify(CANONICAL_STEP_ORDER)}`);
        assert.ok(observedStepIds.length > 0, "no execution-vector step produced any observation");
        for (const [index, observation] of observer.observations.entries()) {
            assert.equal(observation.executionId, executionId);
            assert.equal(observation.rootExecutionId, executionId);
            assert.equal(observation.scenarioId, fixture.scenario.scenarioId);
            assert.equal(observation.sequence, index);
            const isFinalObservation = index === observer.observations.length - 1;
            if (isFinalObservation && observedStepIds.length < CANONICAL_STEP_ORDER.length) {
                assert.notEqual(observation.status, "observed", "the step where execution stopped must record why it stopped");
            }
            else {
                assert.equal(observation.status, "observed");
            }
        }
    });
}

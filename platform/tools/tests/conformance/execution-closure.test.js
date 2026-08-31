"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const EXECUTION_ID = "conformance.closure-mechanics.execution";
const SCENARIO_ID = "conformance.closure-mechanics.scenario";

function observation(stepId, sequence, status, overrides = {}) {
  return {
    executionId: EXECUTION_ID,
    rootExecutionId: EXECUTION_ID,
    parentExecutionId: null,
    scenarioId: SCENARIO_ID,
    stepId,
    sequence,
    status,
    ...overrides
  };
}

async function mechanics() {
  return import(pathToFileURL(path.join(
    REPO_ROOT,
    "artifacts",
    "tools",
    "dist",
    "conformance",
    "proof",
    "execution-closure-mechanics.js"
  )).href);
}

function canonicalSteps() {
  const vector = JSON.parse(fs.readFileSync(path.join(
    REPO_ROOT,
    "kernel",
    "contracts",
    "execution",
    "scenario-kernel-execution-vector.json"
  ), "utf8"));
  return vector.steps.map((step) => step.stepId);
}

test("the canonical execution order comes from the admitted vector", () => {
  assert.deepEqual(canonicalSteps(), [
    "admit-input",
    "resolve-event-authority",
    "execute-event-authority",
    "admit-outcome",
    "resolve-disposition"
  ]);
});

test("complete and expected terminal-prefix traces close", async () => {
  const { evaluateExecutionClosureTrace } = await mechanics();
  const steps = canonicalSteps();
  const happy = steps.map((stepId, sequence) => observation(stepId, sequence, "observed"));
  assert.equal(evaluateExecutionClosureTrace(happy, steps).conforming, true);
  assert.equal(evaluateExecutionClosureTrace([
    observation("admit-input", 0, "admission-rejected")
  ], steps).conforming, true);
  assert.equal(evaluateExecutionClosureTrace([
    observation("admit-input", 0, "observed"),
    observation("resolve-event-authority", 1, "observed"),
    observation("execute-event-authority", 2, "execution-failed")
  ], steps).conforming, true);
  assert.equal(evaluateExecutionClosureTrace([
    observation("admit-input", 0, "observed"),
    observation("resolve-event-authority", 1, "observed"),
    observation("execute-event-authority", 2, "observed"),
    observation("admit-outcome", 3, "admission-rejected")
  ], steps).conforming, true);
});

test("closure mechanics diagnose every lineage defect precisely", async () => {
  const { evaluateExecutionClosureTrace } = await mechanics();
  const steps = canonicalSteps();
  const cases = [
    {
      reason: /^EXECUTION_LINEAGE_GAP/,
      trace: [observation("admit-input", 0, "observed"), observation("resolve-event-authority", 1, "observed")]
    },
    {
      reason: /^UNEXPECTED_STEP_ORDER/,
      trace: [observation("admit-input", 0, "observed"), observation("execute-event-authority", 1, "observed")]
    },
    {
      reason: /^DUPLICATE_STEP_OBSERVATION/,
      trace: [observation("admit-input", 0, "observed"), observation("admit-input", 1, "observed")]
    },
    {
      reason: /^LINEAGE_MISMATCH/,
      trace: [observation("admit-input", 0, "observed"), observation("resolve-event-authority", 1, "observed", { executionId: "other" })]
    },
    {
      reason: /^EXECUTION_LINEAGE_GAP/,
      trace: [observation("admit-input", 0, "admission-rejected"), observation("resolve-event-authority", 1, "observed")]
    },
    {
      reason: /^UNEXPECTED_STEP_ORDER/,
      trace: [observation("admit-input", 0, "observed"), observation("resolve-event-authority", 5, "observed")]
    }
  ];
  for (const example of cases) {
    const verdict = evaluateExecutionClosureTrace(example.trace, steps);
    assert.equal(verdict.conforming, false);
    assert.match(verdict.reason, example.reason);
  }
  assert.throws(() => evaluateExecutionClosureTrace([], steps), /at least one observation/);
});

test("the dynamically imported Node kernel receives its execution clock", async () => {
  const { NodeLanguageToolchains } = require(path.join(
    REPO_ROOT,
    "artifacts",
    "tools",
    "dist",
    "adapters",
    "conformance",
    "language-toolchains.cjs"
  ));
  const result = await new NodeLanguageToolchains(REPO_ROOT).observeExecutionClosure("node");
  assert.equal(result.ran, true);
  assert.equal(result.conforming, true, JSON.stringify(result, null, 2));
  assert.ok(result.fixtures.length > 0);
  assert.ok(result.fixtures.every((fixture) => fixture.conforming === true));
});

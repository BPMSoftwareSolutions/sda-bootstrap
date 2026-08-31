"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const REPO_ROOT = path.resolve(__dirname, "../..");

const DIST_ROOT = path.join(REPO_ROOT, "artifacts", "tools", "dist");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

async function modules() {
  const [run, obligation] = await Promise.all([
    importDist("interfaces", "structural-model-projection", "run.js"),
    importDist(
      "capabilities",
      "structural-model-projection",
      "determine-projected-shape-equivalence",
      "obligation.js"
    )
  ]);
  return { ...run, ...obligation };
}

test("Node structural projection reproduces the admitted hand-written shape member-for-member", async () => {
  const { runStructuralModelProjection } = await modules();
  const result = await runStructuralModelProjection({
    repositoryRoot: REPO_ROOT,
    executionId: "structural-model-projection-shape"
  });

  assert.equal(result.reproduction.obligationDisposition.kind, "SATISFIED");
  assert.equal(result.reproduction.experienceDisposition, "REALIZED");
  assert.ok(result.reproduction.evidence.files.length > 0);

  assert.equal(result.equivalence.obligationDisposition.kind, "SATISFIED");
  assert.equal(result.equivalence.experienceDisposition, "REALIZED");
  assert.equal(result.equivalence.evidence.matchCount, result.equivalence.evidence.totalCount);
});

test("running the reproduction twice produces byte-identical plans (deterministic regeneration)", async () => {
  const { runStructuralModelProjection } = await modules();
  const first = await runStructuralModelProjection({ repositoryRoot: REPO_ROOT, executionId: "determinism-1" });
  const second = await runStructuralModelProjection({ repositoryRoot: REPO_ROOT, executionId: "determinism-2" });
  assert.deepEqual(first.reproduction.evidence.files, second.reproduction.evidence.files);
});

test("shape equivalence obligation flags mismatches and dangling-only types", async () => {
  const { DetermineProjectedShapeEquivalenceObligation } = await modules();
  const obligation = new DetermineProjectedShapeEquivalenceObligation();

  const allMatch = obligation.evaluate({
    results: [{ typeName: "A", status: "MATCH" }],
    matchCount: 1,
    totalCount: 1
  });
  assert.equal(allMatch.kind, "SATISFIED");

  const withMismatch = obligation.evaluate({
    results: [
      { typeName: "A", status: "MATCH" },
      { typeName: "B", status: "MISMATCH", detail: "x" },
      { typeName: "C", status: "GENERATED_ONLY" }
    ],
    matchCount: 1,
    totalCount: 3
  });
  assert.equal(withMismatch.kind, "NOT_SATISFIED");
});

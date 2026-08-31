import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { invokeGovernedFileSystemShaping } from "./node-mechanic-registry-loader.mjs";

const bindingUrl = pathToFileURL(path.join(process.cwd(), "fixture", "binding.json"));

function shape(mapping) {
  return {
    shapeId: "governed-shape",
    authorities: { sourceWorkspace: "source", targetWorkspace: "target" },
    policy: {
      missingSource: "reject",
      existingTarget: "reject",
      unmappedTargetBody: "preserve",
      sourceAfterCopy: "preserve",
      sourceAfterMove: "remove",
      pathTraversal: "reject",
      symbolicLinks: "reject"
    },
    proof: { requireSourceHash: true, requireTargetHash: true },
    mappings: [mapping]
  };
}

function request(source, target, declaredShape) {
  return {
    contractId: "governed-file-system-shape-request.v1",
    payload: {
      requestId: "request-1",
      sourceRootRef: pathToFileURL(`${source}${path.sep}`).href,
      targetRootRef: pathToFileURL(`${target}${path.sep}`).href,
      shape: declaredShape
    }
  };
}

function configuration(mode) {
  return {
    mode,
    shapePath: "payload.shape",
    sourceRootPath: "payload.sourceRootRef",
    targetRootPath: "payload.targetRootRef",
    lineageMode: "retain-effect-lineage",
    lineage: ["consumer"]
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function addressedPlan(core) {
  return {
    ...core,
    planId: `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonicalize(core))).digest("hex")}`
  };
}

test("the governed shaper replaces the legacy provider-workspace registration", async () => {
  const repositoryRoot = new URL("../../../../", import.meta.url);
  const registry = JSON.parse(await readFile(new URL(
    "kernel/semantic-authority/consumer/node-mechanic-registry.authority.v1.json",
    repositoryRoot
  ), "utf8"));
  const catalog = JSON.parse(await readFile(new URL(
    "kernel/semantic-authority/consumer/sda-platform-capabilities.semantic-authority.json",
    repositoryRoot
  ), "utf8"));

  assert.equal(registry.eventPorts.some(({ platformCapabilityId }) => platformCapabilityId === "sda-batch-filesystem-shaper-port.v1"), false);
  assert.equal(catalog.capabilities.some(({ capabilityId }) => capabilityId === "sda-batch-filesystem-shaper-port.v1"), false);
  assert.equal(registry.eventPorts.filter(({ platformCapabilityId }) => platformCapabilityId === "sda-governed-file-system-shaping-port.v2").length, 1);
  assert.equal(catalog.capabilities.filter(({ capabilityId }) => capabilityId === "sda-governed-file-system-shaping-port.v2").length, 1);
  assert.equal(JSON.stringify({ registry, catalog }).includes("fsShaperRootRef"), false);
});

test("governed file-system shaping resolves bounded paths and rejects traversal as testimony", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sda-governed-fs-paths-"));
  try {
    const source = path.join(base, "source");
    const target = path.join(base, "target");
    await mkdir(source); await mkdir(target);
    const admitted = await invokeGovernedFileSystemShaping(configuration("resolve-bounded-paths"), request(source, target, shape({
      mappingId: "candidate",
      source: { authority: "source", path: "candidate.txt" },
      target: { authority: "target", path: "delivery/candidate.txt" },
      transformation: { operation: "copy" }
    })), { rootExecutionId: "root" }, bindingUrl);
    assert.equal(admitted.outcomeVariant, "ADMISSIBLE");
    assert.deepEqual(admitted.payload.pathResolution.mappings.map(({ sourcePath, targetPath }) => ({ sourcePath, targetPath })), [
      { sourcePath: "candidate.txt", targetPath: "delivery/candidate.txt" }
    ]);
    assert.deepEqual(admitted.effectLineage, ["consumer", "root"]);

    const rejected = await invokeGovernedFileSystemShaping(configuration("resolve-bounded-paths"), request(source, target, shape({
      mappingId: "escape",
      source: { authority: "source", path: "../secret.txt" },
      target: { authority: "target", path: "delivery/secret.txt" },
      transformation: { operation: "copy" }
    })), { rootExecutionId: "root" }, bindingUrl);
    assert.equal(rejected.outcomeVariant, "NON_ADMISSIBLE");
    assert.equal(rejected.payload.pathResolution.findings[0].rule, "PATH_TRAVERSAL_REJECTED");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("governed file-system shaping observes primitive mapping facts without authorizing a plan", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sda-governed-fs-observe-"));
  try {
    const source = path.join(base, "source");
    const target = path.join(base, "target");
    await mkdir(source); await mkdir(target); await writeFile(path.join(source, "candidate.txt"), "candidate");
    const input = request(source, target, shape({
      mappingId: "candidate",
      source: { authority: "source", path: "candidate.txt" },
      target: { authority: "target", path: "delivery/candidate.txt" },
      transformation: { operation: "copy" },
      expectedSourceHash: `sha256:${"a".repeat(64)}`
    }));
    const observed = await invokeGovernedFileSystemShaping(configuration("observe-bounded-mappings"), input, { rootExecutionId: "observe" }, bindingUrl);
    assert.equal(observed.outcomeVariant, "OBSERVED");
    assert.equal(observed.payload.observation.facts[0].source.kind, "file");
    assert.match(observed.payload.observation.facts[0].source.contentHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(observed.payload.observation.facts[0].target.exists, false);
    assert.equal(observed.payload.observation.facts[0].expectedSourceHash, `sha256:${"a".repeat(64)}`);
    assert.equal(Object.hasOwn(observed.payload, "plan"), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("governed file-system shaping executes only an exact content-addressed authorized plan", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sda-governed-fs-execute-"));
  try {
    const source = path.join(base, "source");
    const target = path.join(base, "target");
    await mkdir(source); await mkdir(target); await writeFile(path.join(source, "candidate.txt"), "candidate");
    const sourceHash = `sha256:${crypto.createHash("sha256").update("candidate").digest("hex")}`;
    const plan = addressedPlan({
      shapeId: "governed-shape",
      disposition: "AUTHORIZED",
      operations: [{
        mappingId: "candidate",
        operation: "copy-file",
        sourcePath: "candidate.txt",
        targetPath: "delivery/candidate.txt",
        sourceHash,
        targetDisposition: "must-not-exist",
        targetAlreadySatisfied: false
      }],
      findings: []
    });
    const input = {
      contractId: "authorized-file-system-shape-plan.v1",
      plan,
      sourceRootRef: pathToFileURL(`${source}${path.sep}`).href,
      targetRootRef: pathToFileURL(`${target}${path.sep}`).href
    };
    const executed = await invokeGovernedFileSystemShaping({
      mode: "execute-authorized-plan",
      planPath: "plan",
      sourceRootPath: "sourceRootRef",
      targetRootPath: "targetRootRef",
      lineageMode: "retain-effect-lineage"
    }, input, { rootExecutionId: "execute" }, bindingUrl);
    assert.equal(executed.outcomeVariant, "EFFECT_OBSERVED");
    assert.equal(executed.effect.operations[0].result, "verified");
    assert.equal(await readFile(path.join(target, "delivery", "candidate.txt"), "utf8"), "candidate");
    assert.equal(await readFile(path.join(source, "candidate.txt"), "utf8"), "candidate");

    await assert.rejects(() => invokeGovernedFileSystemShaping({
      mode: "execute-authorized-plan",
      plan: { ...plan, shapeId: "tampered" },
      sourceRootRef: input.sourceRootRef,
      targetRootRef: input.targetRootRef,
      lineageMode: "retain-effect-lineage"
    }, {}, { rootExecutionId: "tampered" }, bindingUrl), /PLAN_DIGEST_MISMATCH/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

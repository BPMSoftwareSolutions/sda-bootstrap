import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createNodeMechanicRegistry } from "./node-mechanic-registry-loader.mjs";

function setup(authority, input) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sda-target-execution-"));
  const projected = path.join(directory, "projected");
  fs.mkdirSync(projected);
  fs.writeFileSync(path.join(projected, "generated.txt"), "stable\n");
  const port = createNodeMechanicRegistry({
    bindingUrl: pathToFileURL(path.join(projected, "application-binding.node.json")),
    invokeBinding: () => { throw new Error("Nested invocation is not used."); }
  }).eventPorts.get("sda-governed-target-execution-observation-port.v1");
  return { directory, port, binding: { bindingId: "port:observe", configuration: { executionAuthorityRef: "interfaces.authority.json#/target", executionAuthority: authority } }, input };
}

function authority(targets, extras = {}) {
  return { authorityType: "governed-target-execution-observation-authority.v1", generatedArtifactRelativePath: ".", timeoutMilliseconds: 1000, targets, ...extras };
}
function target(targetId, fixtures, extras = {}) {
  return { targetId, executable: "node", args: [], cwdRelativePath: ".", stableFixtureOrder: fixtures.map((fixture) => fixture.fixtureId), fixtures, ...extras };
}
function input(targetScope, fixtureScope = undefined) {
  return { carrierType: "bounded-projected-target-execution-context.v1", targetScope, fixtureScope, lineage: ["conformance"] };
}
async function observe(subject) {
  try { return await subject.port(subject.binding, subject.input, { rootExecutionId: "target-execution.conformance" }); }
  finally { fs.rmSync(subject.directory, { recursive: true, force: true }); }
}

test("governed target execution returns stable successful fixture receipts and unchanged manifest", async () => {
  const outcome = await observe(setup(authority([target("node", [{ fixtureId: "success", args: ["-p", "1"] }])]), input(["node"])));
  assert.equal(outcome.bounded, true);
  assert.equal(outcome.generatedArtifactUnchanged, true);
  assert.equal(outcome.targetObservations[0].fixtureObservations[0].disposition, "SUCCEEDED");
  assert.deepEqual(outcome.attributableRejections, []);
});

test("governed target execution rejects undeclared targets", async () => {
  const outcome = await observe(setup(authority([]), input(["unknown"])));
  assert.equal(outcome.bounded, false);
  assert.equal(outcome.attributableRejections[0].code, "UNDECLARED_TARGET");
});

test("governed target execution rejects undeclared fixtures", async () => {
  const outcome = await observe(setup(authority([target("node", [], { stableFixtureOrder: ["unknown"] })]), input(["node"], { node: ["unknown"] })));
  assert.equal(outcome.attributableRejections[0].code, "UNDECLARED_FIXTURE");
});

test("governed target execution rejects unsafe command configuration", async () => {
  const outcome = await observe(setup(authority([target("node", [], { executable: "cmd.exe" })]), input(["node"])));
  assert.equal(outcome.attributableRejections[0].code, "UNSAFE_TARGET_CONFIGURATION");
});

test("governed target execution reports unavailable runtimes", async () => {
  const outcome = await observe(setup(authority([target("offline", [{ fixtureId: "x", args: [] }], { executable: "definitely-not-an-runtime" })]), input(["offline"])));
  assert.equal(outcome.attributableRejections[0].code, "RUNTIME_UNAVAILABLE");
});

test("governed target execution reports nonzero exit and timeout", async () => {
  const nonzero = await observe(setup(authority([target("node", [{ fixtureId: "bad", args: ["--definitely-invalid-option"] }])]), input(["node"])));
  assert.equal(nonzero.attributableRejections[0].code, "NONZERO_EXIT");
  const timeout = await observe(setup(authority([target("node", [{ fixtureId: "slow", args: ["-e", "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10000)"] }], { timeoutMilliseconds: 20 })]), input(["node"])));
  assert.equal(timeout.attributableRejections[0].code, "TIMED_OUT");
});

test("governed target execution attributes generated artifact drift", async () => {
  const outcome = await observe(setup(authority([
    target("node", [{ fixtureId: "mutates", args: ["-e", "require('fs').writeFileSync('generated.txt','changed')"] }])
  ]), input(["node"])));
  assert.equal(outcome.generatedArtifactUnchanged, false);
  assert.ok(outcome.attributableRejections.some((finding) => finding.code === "GENERATED_ARTIFACT_DRIFT"));
});

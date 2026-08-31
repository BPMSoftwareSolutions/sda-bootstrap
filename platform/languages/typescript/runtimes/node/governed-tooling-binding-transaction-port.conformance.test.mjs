import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { transactGovernedToolingBinding } from "./node-mechanic-registry-loader.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-binding-"));
  const file = path.join(root, "bindings.json");
  const original = Buffer.from(JSON.stringify({ bindings: [{ responsibilityId: "one", providerId: "old" }, { responsibilityId: "two", providerId: "unchanged" }] }));
  fs.writeFileSync(file, original);
  return { root, file, original, configuration: { bindingFileRef: pathToFileURL(file).href, selectedResponsibilityId: "one", replacementProviderId: "new", lineageMode: "retain-effect-lineage" } };
}
const context = { rootExecutionId: "physical-proof" };
const digest = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;

test("stage exactly one binding and leave unrelated bindings unchanged", async () => {
  const f = fixture(); const result = await transactGovernedToolingBinding(f.configuration, { carrierType: "bounded-governed-tooling-binding-transaction-context.v1", priorBytes: f.original.toString("base64") }, context, pathToFileURL(f.root + path.sep));
  const actual = JSON.parse(fs.readFileSync(f.file)); assert.equal(actual.bindings[0].providerId, "new"); assert.equal(actual.bindings[1].providerId, "unchanged"); assert.equal(result.carrierType, "staged-governed-tooling-binding-observation.v1");
});
test("zero gate retains staged bytes", async () => {
  const f = fixture(); await transactGovernedToolingBinding(f.configuration, { carrierType: "bounded-governed-tooling-binding-transaction-context.v1", priorBytes: f.original.toString("base64") }, context, pathToFileURL(f.root + path.sep));
  const evidence = await transactGovernedToolingBinding(f.configuration, { carrierType: "governed-tooling-binding-gate-observation.v1", priorBytes: f.original.toString("base64"), gateExitCode: 0 }, context, pathToFileURL(f.root + path.sep)); assert.equal(evidence.disposition, "RETAINED");
});
test("nonzero gate restores exact prior bytes", async () => {
  const f = fixture(); await transactGovernedToolingBinding(f.configuration, { carrierType: "bounded-governed-tooling-binding-transaction-context.v1", priorBytes: f.original.toString("base64") }, context, pathToFileURL(f.root + path.sep));
  const evidence = await transactGovernedToolingBinding(f.configuration, { carrierType: "governed-tooling-binding-gate-observation.v1", priorBytes: f.original.toString("base64"), gateExitCode: 2 }, context, pathToFileURL(f.root + path.sep)); assert.equal(evidence.disposition, "RESTORED"); assert.deepEqual(fs.readFileSync(f.file), f.original);
});
test("prior-byte mismatch rejects before mutation", async () => {
  const f = fixture(); await assert.rejects(transactGovernedToolingBinding(f.configuration, { carrierType: "bounded-governed-tooling-binding-transaction-context.v1", priorBytes: Buffer.from("wrong").toString("base64") }, context, pathToFileURL(f.root + path.sep)), /PRIOR_BYTES_MISMATCH/); assert.deepEqual(fs.readFileSync(f.file), f.original);
});
test("selected binding mismatch rejects before mutation", async () => {
  const f = fixture(); f.configuration.selectedResponsibilityId = "absent"; await assert.rejects(transactGovernedToolingBinding(f.configuration, { carrierType: "bounded-governed-tooling-binding-transaction-context.v1", priorBytes: f.original.toString("base64") }, context, pathToFileURL(f.root + path.sep)), /SELECTED_BINDING_MISMATCH/); assert.deepEqual(fs.readFileSync(f.file), f.original);
});
test("closed configuration rejects before mutation", async () => {
  const f = fixture(); await assert.rejects(transactGovernedToolingBinding({}, { carrierType: "bounded-governed-tooling-binding-transaction-context.v1" }, context, pathToFileURL(f.root + path.sep)), /CONFIGURATION_MISSING/); assert.equal(digest(fs.readFileSync(f.file)), digest(f.original));
});

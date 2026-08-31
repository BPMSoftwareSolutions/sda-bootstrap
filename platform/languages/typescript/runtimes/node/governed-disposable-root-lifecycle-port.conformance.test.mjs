import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createNodeMechanicRegistry } from "./node-mechanic-registry-loader.mjs";

const platformCapabilityId = "sda-governed-disposable-root-lifecycle-port.v1";

function provider(host) {
  const registry = createNodeMechanicRegistry({
    bindingUrl: pathToFileURL(path.join(host, "projected", "application-binding.node.json")),
    invokeBinding: () => { throw new Error("Nested invocation is not used by disposable-root lifecycle."); }
  });
  return registry.eventPorts.get(platformCapabilityId);
}

const binding = (mode) => ({
  bindingId: `port:${mode}`,
  configuration: { mode, lineageMode: "retain-effect-lineage" }
});

const context = { rootExecutionId: "disposable-root.conformance" };

test("allocates and releases only the ownership-marked child of the caller-authorized parent", async (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sda-disposable-parent-"));
  const host = fs.mkdtempSync(path.join(os.tmpdir(), "sda-disposable-host-"));
  fs.mkdirSync(path.join(host, "projected"));
  t.after(() => { fs.rmSync(parent, { recursive: true, force: true }); fs.rmSync(host, { recursive: true, force: true }); });
  const invoke = provider(host);
  const parentRootRef = pathToFileURL(parent).href;
  const allocated = await invoke(binding("allocate-disposable-root"), {
    parentRootRef,
    prefix: "estate-proof",
    requestId: "allocation-001",
    requestLineage: ["allocation-request"]
  }, context);
  assert.equal(allocated.disposition, "ALLOCATED");
  assert.equal(allocated.rootPresent, true);
  const root = fileURLToPath(allocated.rootRef);
  fs.writeFileSync(path.join(root, "multibyte.txt"), "é\0proof", "utf8");
  const released = await invoke(binding("release-disposable-root"), {
    parentRootRef,
    rootRef: allocated.rootRef,
    marker: allocated.marker,
    requestLineage: ["release-request"]
  }, context);
  assert.equal(released.disposition, "RELEASED");
  assert.equal(released.rootPresent, false);
  assert.equal(fs.existsSync(root), false);
  assert.deepEqual(released.findingCodes, []);
});

test("rejects a divergent marker without deleting the root", async (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sda-disposable-parent-"));
  const host = fs.mkdtempSync(path.join(os.tmpdir(), "sda-disposable-host-"));
  fs.mkdirSync(path.join(host, "projected"));
  t.after(() => { fs.rmSync(parent, { recursive: true, force: true }); fs.rmSync(host, { recursive: true, force: true }); });
  const invoke = provider(host);
  const parentRootRef = pathToFileURL(parent).href;
  const allocated = await invoke(binding("allocate-disposable-root"), {
    parentRootRef,
    prefix: "estate-proof",
    requestId: "allocation-002"
  }, context);
  const rejected = await invoke(binding("release-disposable-root"), {
    parentRootRef,
    rootRef: allocated.rootRef,
    marker: "wrong-marker"
  }, context);
  assert.equal(rejected.disposition, "REQUEST_REJECTED");
  assert.deepEqual(rejected.findingCodes, ["DISPOSABLE_ROOT_MARKER_DIVERGED"]);
  assert.equal(fs.existsSync(new URL(allocated.rootRef)), true);
});

test("rejects a symbolic-link crossing without deleting either side", async (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sda-disposable-parent-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sda-disposable-outside-"));
  const host = fs.mkdtempSync(path.join(os.tmpdir(), "sda-disposable-host-"));
  fs.mkdirSync(path.join(host, "projected"));
  t.after(() => {
    fs.rmSync(parent, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
    fs.rmSync(host, { recursive: true, force: true });
  });
  fs.writeFileSync(path.join(outside, "survives.txt"), "outside", "utf8");
  const invoke = provider(host);
  const parentRootRef = pathToFileURL(parent).href;
  const allocated = await invoke(binding("allocate-disposable-root"), {
    parentRootRef,
    prefix: "estate-proof",
    requestId: "allocation-003"
  }, context);
  const root = path.resolve(fileURLToPath(allocated.rootRef));
  fs.symlinkSync(outside, path.join(root, "outside-link"), "junction");
  const rejected = await invoke(binding("release-disposable-root"), {
    parentRootRef,
    rootRef: allocated.rootRef,
    marker: allocated.marker
  }, context);
  assert.equal(rejected.disposition, "REQUEST_REJECTED");
  assert.deepEqual(rejected.findingCodes, ["DISPOSABLE_ROOT_SYMBOLIC_LINK_REJECTED"]);
  assert.equal(fs.existsSync(path.join(outside, "survives.txt")), true);
  assert.equal(fs.existsSync(root), true);
});

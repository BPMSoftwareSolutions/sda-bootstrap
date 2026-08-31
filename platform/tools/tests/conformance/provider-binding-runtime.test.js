const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

async function loader() {
  return import("../../../artifacts/tools/dist/host/load-provider.js");
}

function workspace(bindings, runtimeSource) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-provider-binding-"));
  const authorityRoot = path.join(root, "capabilities", "sda-tooling", "test-group");
  const runtimePath = path.join(authorityRoot, "runtime.mjs");
  fs.mkdirSync(authorityRoot, { recursive: true });
  fs.writeFileSync(path.join(authorityRoot, "provider-bindings.json"), JSON.stringify({ bindings }));
  if (runtimeSource) fs.writeFileSync(runtimePath, runtimeSource);
  return { root, runtimeRef: "capabilities/sda-tooling/test-group/runtime.mjs" };
}

function legacyProvider(execute = async (input) => ({ source: "legacy", input })) {
  return { responsibilityId: "test-responsibility", execute };
}

test("responsibility-provider-v1 returns the injected legacy provider", async (t) => {
  const { loadBoundProvider } = await loader();
  const { root } = workspace([{
    responsibilityId: "test-responsibility",
    implementationRef: "tools/src/capabilities/test/provider.ts"
  }]);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const legacy = legacyProvider();
  assert.equal(await loadBoundProvider(root, "test-group", legacy), legacy);
});

test("projected-consumer-runtime-v2 executes the admitted runtime", async (t) => {
  const { loadBoundProvider } = await loader();
  const runtimeSource = "export async function executeCapability(input) { return { disposition: 'completed', outcome: { source: 'projected', input } }; }";
  const configured = workspace([{
    responsibilityId: "test-responsibility",
    implementationRef: "capabilities/sda-tooling/test-group/runtime.mjs",
    protocol: "projected-consumer-runtime-v2"
  }], runtimeSource);
  t.after(() => fs.rmSync(configured.root, { recursive: true, force: true }));
  const bound = await loadBoundProvider(configured.root, "test-group", legacyProvider());
  assert.deepEqual(await bound.execute({ value: 7 }), { source: "projected", input: { value: 7 } });
});

test("projected execution failures never fall back to legacy behavior", async (t) => {
  const { loadBoundProvider } = await loader();
  const configured = workspace([{
    responsibilityId: "test-responsibility",
    implementationRef: "capabilities/sda-tooling/test-group/runtime.mjs",
    protocol: "projected-consumer-runtime-v2"
  }], "export async function executeCapability() { throw new Error('projected failure'); }");
  t.after(() => fs.rmSync(configured.root, { recursive: true, force: true }));
  let legacyExecutions = 0;
  const bound = await loadBoundProvider(configured.root, "test-group", legacyProvider(async () => {
    legacyExecutions += 1;
    return { source: "legacy" };
  }));
  await assert.rejects(() => bound.execute({}), /projected failure/);
  assert.equal(legacyExecutions, 0);
});

test("ambiguous, unsupported, and escaping bindings are rejected", async (t) => {
  const { loadBoundProvider } = await loader();
  const ambiguous = workspace([]);
  const unsupported = workspace([{
    responsibilityId: "test-responsibility",
    implementationRef: "unused.mjs",
    protocol: "unknown-runtime-v9"
  }]);
  const escaping = workspace([{
    responsibilityId: "test-responsibility",
    implementationRef: "../outside.mjs",
    protocol: "projected-consumer-runtime-v2"
  }]);
  t.after(() => {
    fs.rmSync(ambiguous.root, { recursive: true, force: true });
    fs.rmSync(unsupported.root, { recursive: true, force: true });
    fs.rmSync(escaping.root, { recursive: true, force: true });
  });
  const legacy = legacyProvider();
  await assert.rejects(() => loadBoundProvider(ambiguous.root, "test-group", legacy), /exactly one/);
  await assert.rejects(() => loadBoundProvider(unsupported.root, "test-group", legacy), /unsupported protocol/);
  await assert.rejects(() => loadBoundProvider(escaping.root, "test-group", legacy), /escapes repository/);
});

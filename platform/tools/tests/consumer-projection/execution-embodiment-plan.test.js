"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const Ajv2020 = require("ajv/dist/2020").default;

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPOSITORY_ROOT, ...relativePath.split("/")), "utf8"));
}

test("Node execution embodiment is deterministic, closed, and schema-admitted", async () => {
  const modulePath = path.join(
    REPOSITORY_ROOT,
    "artifacts/tools/dist/consumer-projection/application/consumer-execution-embodiment-compiler.js"
  );
  const { ConsumerExecutionEmbodimentCompiler } = await import(pathToFileURL(modulePath).href);
  const query = readJson("examples/generic-capability/projected/query/conformance-query.node.json");
  const capability = readJson("examples/generic-capability/projected/capability.json");
  const compiler = new ConsumerExecutionEmbodimentCompiler();
  const first = compiler.compile(query, "node", capability);
  const second = compiler.compile(query, "node", capability);
  assert.deepEqual(first, second);

  const schema = readJson(
    "capabilities/sda-platform/consumer-execution-embodiment/contracts/consumer-execution-embodiment-plan.v1.schema.json"
  );
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(first), true, JSON.stringify(validate.errors));

  const encoded = JSON.stringify(first);
  for (const interpreterInput of [
    "authorityGraph",
    "executionAuthorities",
    "projectionAuthorities",
    "interfaceAuthority",
    "requiredClosures"
  ]) assert.equal(encoded.includes(`\"${interpreterInput}\"`), false, interpreterInput);
});

test("Node runtime rejects legacy authority-interpreting application bindings", async () => {
  const runtimePath = path.join(
    REPOSITORY_ROOT,
    "languages/typescript/runtimes/node/admitted-consumer-platform.mjs"
  );
  const { default: bind } = await import(pathToFileURL(runtimePath).href);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-legacy-node-binding-"));
  try {
    const bindingPath = path.join(root, "application-binding.json");
    fs.writeFileSync(bindingPath, JSON.stringify({
      bindingType: "projected-consumer-application-binding.v1",
      capability: "capability.json",
      query: "query.json",
      fixtures: "fixtures.json",
      mechanicalSterility: "projection-conformance.json"
    }));
    assert.throws(
      () => bind(pathToFileURL(path.join(root, "application.generated.mjs")).href, "./application-binding.json"),
      /CONSUMER_EXECUTION_PLAN_REQUIRED/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Node runtime source contains no application-authority interpretation surface", () => {
  const source = fs.readFileSync(path.join(
    REPOSITORY_ROOT,
    "languages/typescript/runtimes/node/admitted-consumer-platform.mjs"
  ), "utf8");
  assert.doesNotMatch(source, /authorityGraph|executionAuthorities|projectionAuthorities|interfaceAuthority|requiredClosures|resumeArtifact|closureChecks/);
  assert.match(source, /consumer-execution-embodiment-plan\.v1/);
});

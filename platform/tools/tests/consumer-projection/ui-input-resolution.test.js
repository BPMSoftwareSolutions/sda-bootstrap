"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("the admitted transformation provider derives a consumer read model entirely from digest-bound authority", async (context) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sda-input-resolution-"));
  context.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const { resolveConsumerInput } = await import("../../../artifacts/tools/dist/ui-parity/application/ui-input-resolution.js");
  const { canonicalDigest } = await import("../../../artifacts/tools/dist/ui-parity/proof/canonical-ui-authority.js");
  const { NodeAuthorityTransformationSemanticReadModelProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-authority-transformation-semantic-read-model-provider.js"
  );
  const { NodeTextSourceObservationProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-text-source-observation-provider.js"
  );
  const authority = {
    authorityType: "semantic-transformation-authority.v1",
    transformations: [{
      id: "import-catalog-source",
      expression: {
        op: "object",
        fields: {
          "review-model": {
            op: "object",
            fields: {
              recordId: { op: "literal", value: "record-001" },
              displayName: { op: "path", from: "root", path: "sources.source-description" },
              sourceText: { op: "path", from: "root", path: "observations.selected-document.text" },
              sourceDigest: { op: "path", from: "root", path: "observations.selected-document.contentDigest" },
              items: { op: "array", items: [{ op: "literal", value: "alpha" }, { op: "literal", value: "beta" }] }
            }
          }
        }
      }
    }]
  };
  fs.writeFileSync(path.join(workspace, "input-resolution.authority.json"), `${JSON.stringify(authority, null, 2)}\n`, "utf8");
  const operation = {
    authorityRef: "input-resolution.authority.json",
    authorityDigest: canonicalDigest(authority),
    recipeId: "import-catalog-source",
    sourceBindings: [
      { role: "selected-document", stateId: "selected-document-state" },
      { role: "source-description", stateId: "source-description-state" }
    ]
  };
  const encodedDocument = JSON.stringify({
    fileName: "catalog.txt",
    mediaType: "text/plain",
    contentBase64: Buffer.from("alpha\nbeta", "utf8").toString("base64")
  });
  const provider = new NodeAuthorityTransformationSemanticReadModelProvider(
    path.resolve(__dirname, "../../.."),
    [new NodeTextSourceObservationProvider()]
  );
  const result = await resolveConsumerInput(workspace, operation, {
    "selected-document-state": encodedDocument,
    "source-description-state": "Catalog source"
  }, provider);

  assert.equal(result.disposition, "ADMITTED");
  assert.equal(result.providerId, provider.providerId);
  assert.equal(result.outputs["review-model"].displayName, "Catalog source");
  assert.equal(result.outputs["review-model"].sourceText, "alpha\nbeta");
  assert.match(result.outputs["review-model"].sourceDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(result.outputs["review-model"].items, ["alpha", "beta"]);
  assert.equal(result.evidence.authorityDigest, operation.authorityDigest);
  assert.equal(result.evidence.transformationId, operation.recipeId);
  assert.deepEqual(result.evidence.outputRoles, ["review-model"]);
  assert.equal(result.evidence.sourceObservations.length, 1);
  assert.equal(result.evidence.sourceObservations[0].providerId, "sda-node-text-source-observation.v1");
  assert.equal(result.evidence.sourceObservations[0].sourceRole, "selected-document");
});

test("source-observation-dependent authority fails admission when no observation provider is composed", async (context) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sda-source-observation-provider-"));
  context.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const { resolveConsumerInput } = await import("../../../artifacts/tools/dist/ui-parity/application/ui-input-resolution.js");
  const { canonicalDigest } = await import("../../../artifacts/tools/dist/ui-parity/proof/canonical-ui-authority.js");
  const { NodeAuthorityTransformationSemanticReadModelProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-authority-transformation-semantic-read-model-provider.js"
  );
  const authority = {
    authorityType: "semantic-transformation-authority.v1",
    transformations: [{
      id: "observe-source",
      expression: {
        op: "object",
        fields: { text: { op: "path", from: "root", path: "observations.source.text" } }
      }
    }]
  };
  fs.writeFileSync(path.join(workspace, "authority.json"), JSON.stringify(authority), "utf8");

  await assert.rejects(
    resolveConsumerInput(workspace, {
      authorityRef: "authority.json",
      authorityDigest: canonicalDigest(authority),
      recipeId: "observe-source",
      sourceBindings: [{ role: "source", stateId: "source-state" }]
    }, { "source-state": "plain value" }, new NodeAuthorityTransformationSemanticReadModelProvider(path.resolve(__dirname, "../../.."))),
    /CONSUMER_SEMANTIC_READ_MODEL_PROVIDER_REJECTED:.*SOURCE_OBSERVATION_PROVIDER_MISSING/
  );
});

test("the text observation provider rejects unsupported binary media without invoking consumer interpretation", async (context) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sda-source-observation-media-"));
  context.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const { resolveConsumerInput } = await import("../../../artifacts/tools/dist/ui-parity/application/ui-input-resolution.js");
  const { canonicalDigest } = await import("../../../artifacts/tools/dist/ui-parity/proof/canonical-ui-authority.js");
  const { NodeAuthorityTransformationSemanticReadModelProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-authority-transformation-semantic-read-model-provider.js"
  );
  const { NodeTextSourceObservationProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-text-source-observation-provider.js"
  );
  const authority = {
    authorityType: "semantic-transformation-authority.v1",
    transformations: [{
      id: "observe-source",
      expression: { op: "object", fields: { text: { op: "path", from: "root", path: "observations.source.text" } } }
    }]
  };
  fs.writeFileSync(path.join(workspace, "authority.json"), JSON.stringify(authority), "utf8");
  const binaryEnvelope = JSON.stringify({
    fileName: "source.bin",
    mediaType: "application/octet-stream",
    contentBase64: Buffer.from([0, 1, 2, 3]).toString("base64")
  });

  await assert.rejects(
    resolveConsumerInput(workspace, {
      authorityRef: "authority.json",
      authorityDigest: canonicalDigest(authority),
      recipeId: "observe-source",
      sourceBindings: [{ role: "source", stateId: "source-state" }]
    }, { "source-state": binaryEnvelope }, new NodeAuthorityTransformationSemanticReadModelProvider(
      path.resolve(__dirname, "../../.."),
      [new NodeTextSourceObservationProvider()]
    )),
    /CONSUMER_SEMANTIC_READ_MODEL_PROVIDER_REJECTED:.*SOURCE_OBSERVATION_MEDIA_TYPE_NOT_SUPPORTED/
  );
});

test("source observation fails closed when two providers admit the same source envelope", async (context) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sda-source-observation-ambiguous-"));
  context.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const { resolveConsumerInput } = await import("../../../artifacts/tools/dist/ui-parity/application/ui-input-resolution.js");
  const { canonicalDigest } = await import("../../../artifacts/tools/dist/ui-parity/proof/canonical-ui-authority.js");
  const { NodeAuthorityTransformationSemanticReadModelProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-authority-transformation-semantic-read-model-provider.js"
  );
  const authority = {
    authorityType: "semantic-transformation-authority.v1",
    transformations: [{
      id: "observe-source",
      expression: { op: "object", fields: { text: { op: "path", from: "root", path: "observations.source.text" } } }
    }]
  };
  fs.writeFileSync(path.join(workspace, "authority.json"), JSON.stringify(authority), "utf8");
  const supportingProvider = (providerId) => ({
    providerId,
    admit() { return { disposition: "SUPPORTED", sourceType: "test-source.v1", mediaType: "text/plain" }; },
    async observe() { throw new Error("ambiguous providers must not be invoked"); }
  });

  await assert.rejects(
    resolveConsumerInput(workspace, {
      authorityRef: "authority.json",
      authorityDigest: canonicalDigest(authority),
      recipeId: "observe-source",
      sourceBindings: [{ role: "source", stateId: "source-state" }]
    }, { "source-state": "opaque source" }, new NodeAuthorityTransformationSemanticReadModelProvider(
      path.resolve(__dirname, "../../.."),
      [supportingProvider("observer-b.v1"), supportingProvider("observer-a.v1")]
    )),
    /CONSUMER_SEMANTIC_READ_MODEL_PROVIDER_REJECTED:.*SOURCE_OBSERVATION_PROVIDER_AMBIGUOUS:.*observer-a\.v1,observer-b\.v1/
  );
});

test("the transformation provider reports a stable rejection when consumer authority omits the requested recipe", async (context) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sda-input-resolution-recipe-"));
  context.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const { resolveConsumerInput } = await import("../../../artifacts/tools/dist/ui-parity/application/ui-input-resolution.js");
  const { canonicalDigest } = await import("../../../artifacts/tools/dist/ui-parity/proof/canonical-ui-authority.js");
  const { NodeAuthorityTransformationSemanticReadModelProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-authority-transformation-semantic-read-model-provider.js"
  );
  const authority = {
    authorityType: "semantic-transformation-authority.v1",
    transformations: [{ id: "another-recipe", expression: { op: "object", fields: {} } }]
  };
  fs.writeFileSync(path.join(workspace, "authority.json"), JSON.stringify(authority), "utf8");

  await assert.rejects(
    resolveConsumerInput(workspace, {
      authorityRef: "authority.json",
      authorityDigest: canonicalDigest(authority),
      recipeId: "requested-recipe",
      sourceBindings: []
    }, {}, new NodeAuthorityTransformationSemanticReadModelProvider(path.resolve(__dirname, "../../.."))),
    /CONSUMER_SEMANTIC_READ_MODEL_PROVIDER_REJECTED:.*SEMANTIC_READ_MODEL_RECIPE_NOT_FOUND/
  );
});

test("input resolution rejects authority drift before invoking a consumer provider", async (context) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sda-input-resolution-drift-"));
  context.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const { resolveConsumerInput } = await import("../../../artifacts/tools/dist/ui-parity/application/ui-input-resolution.js");
  const authority = { authorityType: "consumer-semantic-read-model-authority.v1", authorityId: "drift" };
  fs.writeFileSync(path.join(workspace, "authority.json"), JSON.stringify(authority), "utf8");
  let invoked = false;

  await assert.rejects(
    resolveConsumerInput(workspace, {
      authorityRef: "authority.json",
      authorityDigest: `sha256:${"0".repeat(64)}`,
      recipeId: "resolve-record",
      sourceBindings: []
    }, {}, {
      providerId: "must-not-run.v1",
      authorityTypes: [authority.authorityType],
      admit() { throw new Error("must not admit"); },
      async resolve() { invoked = true; return { disposition: "ADMITTED", outputs: {} }; }
    }),
    /INPUT_RESOLUTION_AUTHORITY_DIGEST_DIVERGENCE/
  );
  assert.equal(invoked, false);
});

test("input resolution fails closed when no consumer semantic read-model provider is admitted", async (context) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sda-input-resolution-provider-"));
  context.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const { resolveConsumerInput } = await import("../../../artifacts/tools/dist/ui-parity/application/ui-input-resolution.js");
  const { canonicalDigest } = await import("../../../artifacts/tools/dist/ui-parity/proof/canonical-ui-authority.js");
  const authority = { authorityType: "consumer-semantic-read-model-authority.v1", authorityId: "provider-required" };
  fs.writeFileSync(path.join(workspace, "authority.json"), JSON.stringify(authority), "utf8");

  await assert.rejects(
    resolveConsumerInput(workspace, {
      authorityRef: "authority.json",
      authorityDigest: canonicalDigest(authority),
      recipeId: "resolve-record",
      sourceBindings: [{ role: "source", stateId: "source-state" }]
    }, { "source-state": "opaque consumer source" }),
    /MISSING_CONSUMER_SEMANTIC_READ_MODEL_PROVIDER/
  );
});

test("the UI server rejects a projected source-resolution operation before runtime when its provider is missing", async (context) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sda-ui-server-provider-"));
  context.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const projected = path.join(workspace, "projected");
  fs.mkdirSync(path.join(projected, "ui-parity"), { recursive: true });
  fs.mkdirSync(path.join(projected, "react", "authority"), { recursive: true });
  fs.writeFileSync(path.join(projected, "ui-parity", "targets.json"), JSON.stringify({ admittedTargets: ["react"] }), "utf8");
  fs.writeFileSync(path.join(projected, "react", "index.generated.html"), "<!doctype html>", "utf8");
  fs.writeFileSync(path.join(projected, "react", "authority", "ui-authority.react.json"), JSON.stringify({
    interactionAuthority: { operations: [{ operationId: "resolve-source", kind: "resolve-input" }] }
  }), "utf8");
  const { startUiParityServer } = await import("../../../artifacts/tools/dist/ui-parity/application/ui-parity-server.js");

  await assert.rejects(
    startUiParityServer({ repositoryRoot: path.resolve(__dirname, "../../.."), workspaceRoot: workspace }),
    /MISSING_CONSUMER_SEMANTIC_READ_MODEL_PROVIDER/
  );
});

test("the UI server rejects a source-resolution authority type unsupported by its admitted provider before runtime", async (context) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sda-ui-server-authority-"));
  context.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const projected = path.join(workspace, "projected");
  fs.mkdirSync(path.join(projected, "ui-parity"), { recursive: true });
  fs.mkdirSync(path.join(projected, "react", "authority"), { recursive: true });
  const legacyAuthority = { authorityType: "legacy-consumer-input-authority.v1", recipes: [] };
  fs.writeFileSync(path.join(workspace, "legacy-authority.json"), JSON.stringify(legacyAuthority), "utf8");
  fs.writeFileSync(path.join(projected, "ui-parity", "targets.json"), JSON.stringify({ admittedTargets: ["react"] }), "utf8");
  fs.writeFileSync(path.join(projected, "react", "index.generated.html"), "<!doctype html>", "utf8");
  const { canonicalDigest } = await import("../../../artifacts/tools/dist/ui-parity/proof/canonical-ui-authority.js");
  fs.writeFileSync(path.join(projected, "react", "authority", "ui-authority.react.json"), JSON.stringify({
    interactionAuthority: {
      operations: [{
        operationId: "resolve-source",
        kind: "resolve-input",
        authorityRef: "legacy-authority.json",
        authorityDigest: canonicalDigest(legacyAuthority),
        recipeId: "legacy-recipe",
        sourceBindings: []
      }]
    }
  }), "utf8");
  const { startUiParityServer } = await import("../../../artifacts/tools/dist/ui-parity/application/ui-parity-server.js");

  await assert.rejects(
    startUiParityServer({
      repositoryRoot: path.resolve(__dirname, "../../.."),
      workspaceRoot: workspace,
      consumerSemanticReadModelProvider: {
        providerId: "semantic-transformations-only.v1",
        authorityTypes: ["semantic-transformation-authority.v1"],
        admit() {},
        async resolve() { return { disposition: "ADMITTED", outputs: {} }; }
      }
    }),
    /CONSUMER_SEMANTIC_READ_MODEL_AUTHORITY_NOT_SUPPORTED/
  );
});

test("the UI server rejects a missing authority recipe before runtime", async (context) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sda-ui-server-recipe-"));
  context.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const projected = path.join(workspace, "projected");
  fs.mkdirSync(path.join(projected, "ui-parity"), { recursive: true });
  fs.mkdirSync(path.join(projected, "react", "authority"), { recursive: true });
  const authority = {
    authorityType: "semantic-transformation-authority.v1",
    transformations: [{ id: "available-recipe", expression: { op: "object", fields: {} } }]
  };
  fs.writeFileSync(path.join(workspace, "authority.json"), JSON.stringify(authority), "utf8");
  fs.writeFileSync(path.join(projected, "ui-parity", "targets.json"), JSON.stringify({ admittedTargets: ["react"] }), "utf8");
  fs.writeFileSync(path.join(projected, "react", "index.generated.html"), "<!doctype html>", "utf8");
  const { canonicalDigest } = await import("../../../artifacts/tools/dist/ui-parity/proof/canonical-ui-authority.js");
  fs.writeFileSync(path.join(projected, "react", "authority", "ui-authority.react.json"), JSON.stringify({
    interactionAuthority: {
      operations: [{
        operationId: "resolve-source",
        kind: "resolve-input",
        authorityRef: "authority.json",
        authorityDigest: canonicalDigest(authority),
        recipeId: "missing-recipe",
        sourceBindings: []
      }]
    }
  }), "utf8");
  const { NodeAuthorityTransformationSemanticReadModelProvider } = await import(
    "../../../artifacts/tools/dist/adapters/consumer-projection/node-authority-transformation-semantic-read-model-provider.js"
  );
  const { startUiParityServer } = await import("../../../artifacts/tools/dist/ui-parity/application/ui-parity-server.js");
  const repositoryRoot = path.resolve(__dirname, "../../..");

  await assert.rejects(
    startUiParityServer({
      repositoryRoot,
      workspaceRoot: workspace,
      consumerSemanticReadModelProvider: new NodeAuthorityTransformationSemanticReadModelProvider(repositoryRoot)
    }),
    /CONSUMER_SEMANTIC_READ_MODEL_PROVIDER_REJECTED:.*SEMANTIC_READ_MODEL_RECIPE_NOT_FOUND/
  );
});

test("a committed file value overrides stale render state during automatic input resolution", async (context) => {
  const { createUiOperationExecutor } = await import("../../../languages/typescript/runtimes/browser/runtime/ui-operation-executor.mjs");
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  let request;
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return new Response(JSON.stringify({ outputs: { "review-model": { displayName: "Imported record", items: [] } } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  let model = { inputs: { "selected-document-state": "" }, busy: false, status: "Ready", error: "", validation: {} };
  const updateModel = (update) => { model = update(model); };
  const state = { inputs: model.inputs };
  const interaction = {
    validation: [],
    applyStatePatch(operationId, inputs, sources) {
      assert.equal(operationId, "resolve-source");
      return { ...inputs, "import-review-state": JSON.stringify(sources["semantic-output-role"]["review-model"], null, 2) };
    }
  };
  const executor = createUiOperationExecutor({ interaction, state, updateModel, activeRequest: { current: null } });
  const committedDocument = JSON.stringify({ fileName: "catalog.txt", mediaType: "application/test", contentBase64: "AQ==" });

  await executor.execute({
    operationId: "resolve-source",
    kind: "resolve-input",
    arguments: {
      authorityRef: "input-resolution.authority.json",
      authorityDigest: `sha256:${"1".repeat(64)}`,
      recipeId: "import-selected-document",
      sourceBindings: [{ role: "selected-document", stateId: "selected-document-state" }],
      targetBindings: [{ role: "review-model", stateId: "import-review-state" }]
    }
  }, { "selected-document-state": committedDocument });

  assert.equal(request.sources["selected-document-state"], committedDocument);
  assert.match(model.inputs["import-review-state"], /Imported record/);
  assert.equal(model.status, "Sources admitted");
});

test("capability outcome bindings replace an imported document in the same preview state", async (context) => {
  const { createUiOperationExecutor } = await import("../../../languages/typescript/runtimes/browser/runtime/ui-operation-executor.mjs");
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => new Response(JSON.stringify({
    disposition: "ADMITTED",
    outcome: {
      resultModel: {
        document: { documentType: "semantic-document.v1", title: "Final document", blocks: [] }
      }
    }
  }), { status: 200, headers: { "content-type": "application/json" } });
  let model = {
    inputs: {
      "canonical-input": JSON.stringify({ source: {}, target: {} }),
      "document-preview-state": JSON.stringify({ documentType: "semantic-document.v1", title: "Imported document", blocks: [] })
    },
    busy: false, status: "Ready", error: "", validation: {}, result: null, queryResult: null, outcome: null
  };
  const updateModel = (update) => { model = update(model); };
  const state = { inputs: model.inputs };
  const interaction = {
    validation: [],
    applyStatePatch(operationId, inputs, sources) {
      assert.equal(operationId, "execute-capability");
      return { ...inputs, "document-preview-state": JSON.stringify(sources["outcome-path"].resultModel.document, null, 2) };
    }
  };
  const executor = createUiOperationExecutor({ interaction, state, updateModel, activeRequest: { current: null } });

  await executor.execute({
    operationId: "execute-capability",
    kind: "execute-capability",
    arguments: {
      inputStateId: "canonical-input",
      targetBindings: [{ path: "resultModel.document", stateId: "document-preview-state" }]
    }
  });

  assert.match(model.inputs["document-preview-state"], /Final document/);
  assert.doesNotMatch(model.inputs["document-preview-state"], /Imported document/);
  assert.equal(model.status, "Completed");
});

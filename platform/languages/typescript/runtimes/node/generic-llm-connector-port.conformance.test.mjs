import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { invokeGenericLlmConnector } from "./node-mechanic-registry-loader.mjs";
import { resolveGenericConnectorRoot } from "./generic-llm-connector-provider.mjs";

const bindingUrl = pathToFileURL(path.join(process.cwd(), "fixture", "projected", "application-binding.node.json"));

const configuration = Object.freeze({
  connectorAuthorityRef: "../../../../generic-llm-connector/config/provider-authority.json",
  requestPath: "modelRequest",
  lineageMode: "retain-external-execution",
  credentialsMode: "external-reference-only"
});

const carrier = Object.freeze({
  carrierType: "governed-model-invocation-request.v1",
  requestId: "request-1",
  requestHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  modelRequest: Object.freeze({ requestId: "request-1" }),
  requestLineage: Object.freeze(["caller", "obtain-governed-model-response"])
});

test("generic LLM connector implementation resolves from provider schema authority rather than authority placement", () => {
  const authorityUrl = pathToFileURL(path.join(process.cwd(), "temporary-workbench", "model-provider.authority.json"));
  const connectorRoot = resolveGenericConnectorRoot(authorityUrl, {
    $schema: "../../generic-llm-connector/authority/provider-authority.schema.v1.json"
  });
  assert.equal(connectorRoot, path.join(path.dirname(process.cwd()), "generic-llm-connector"));
});

test("generic LLM port returns a closed attributed evidence carrier", async () => {
  let observedRequest;
  let observedAuthority;
  const result = await invokeGenericLlmConnector(configuration, carrier, {
    rootExecutionId: "root-execution"
  }, bindingUrl, async (request, providerAuthorityUrl) => {
    observedRequest = request;
    observedAuthority = providerAuthorityUrl;
    return {
      requestId: "request-1",
      invocationId: "invocation-1",
      disposition: "MODEL_RESPONSE_OBTAINED",
      resolvedAuthority: {
        providerKind: "gemini",
        resolvedModel: "gemini-flash-latest"
      },
      result: { format: "json", structuredValue: { testimony: true } },
      proof: {
        requestHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        responseHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        attemptCount: 1,
        startedAt: "2026-08-12T20:00:00.000Z",
        completedAt: "2026-08-12T20:00:00.025Z",
        durationMilliseconds: 25
      }
    };
  });

  assert.equal(observedRequest, carrier.modelRequest);
  assert.equal(observedAuthority.protocol, "file:");
  assert.deepEqual(result, {
    carrierType: "governed-model-response-evidence.v1",
    requestId: "request-1",
    disposition: "MODEL_RESPONSE_OBTAINED",
    resolvedProvider: "gemini",
    resolvedModel: "gemini-flash-latest",
    attemptCount: 1,
    timing: {
      startedAt: "2026-08-12T20:00:00.000Z",
      completedAt: "2026-08-12T20:00:00.025Z",
      durationMilliseconds: 25
    },
    requestHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    responseHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    normalizedResponse: { format: "json", structuredValue: { testimony: true } },
    acceptanceClaimed: false,
    effectLineage: ["caller", "obtain-governed-model-response", "root-execution", "invocation-1"]
  });
});

test("generic LLM port can retain its attributed evidence inside the parent carrier", async () => {
  const parent = { ...carrier, canonicalFeature: { sourceRef: "features/proof.feature" } };
  const result = await invokeGenericLlmConnector({ ...configuration, resultPath: "modelEvidence" }, parent, {
    rootExecutionId: "proof.execution"
  }, bindingUrl, async () => ({
    requestId: "proof-request",
    disposition: "MODEL_RESPONSE_OBTAINED",
    resolvedAuthority: { providerKind: "gemini", resolvedModel: "gemini-test" },
    proof: {
      attemptCount: 1,
      startedAt: "2026-08-13T00:00:00.000Z",
      completedAt: "2026-08-13T00:00:01.000Z",
      durationMilliseconds: 1000,
      requestHash: `sha256:${"a".repeat(64)}`,
      responseHash: `sha256:${"b".repeat(64)}`
    },
    result: { candidateType: "declarative-capability-ontology-candidate.v1" },
    invocationId: "invocation-proof"
  }));
  assert.deepEqual(result.canonicalFeature, parent.canonicalFeature);
  assert.equal(result.modelEvidence.resolvedProvider, "gemini");
  assert.equal(result.modelEvidence.resolvedModel, "gemini-test");
  assert.equal(result.modelEvidence.attemptCount, 1);
  assert.deepEqual(parent.modelEvidence, undefined);
});

test("generic LLM port preserves an exact pre-invocation failure without inventing evidence", async () => {
  const result = await invokeGenericLlmConnector(configuration, carrier, {
    rootExecutionId: "root-execution"
  }, bindingUrl, async () => ({
    requestId: "request-1",
    disposition: "MODEL_REQUEST_REJECTED",
    proof: {
      attemptCount: 0,
      startedAt: "2026-08-12T20:00:00.000Z",
      completedAt: "2026-08-12T20:00:00.001Z",
      durationMilliseconds: 1
    }
  }));

  assert.equal(result.disposition, "MODEL_REQUEST_REJECTED");
  assert.equal(result.resolvedProvider, null);
  assert.equal(result.resolvedModel, null);
  assert.equal(result.attemptCount, 0);
  assert.equal(result.timing.durationMilliseconds, 1);
  assert.equal(result.requestHash, carrier.requestHash);
  assert.equal(result.responseHash, null);
  assert.equal(result.normalizedResponse, null);
  assert.equal(result.acceptanceClaimed, false);
});

test("generic LLM port rejects embedded credential authority", async () => {
  await assert.rejects(
    () => invokeGenericLlmConnector({ ...configuration, credentialsMode: "embedded" }, carrier, {
      rootExecutionId: "root-execution"
    }, bindingUrl, async () => { throw new Error("must not invoke"); }),
    /GENERIC_LLM_CONNECTOR_CREDENTIALS_MODE_UNSUPPORTED/
  );
});

test("generic LLM port rejects a missing governed request", async () => {
  await assert.rejects(
    () => invokeGenericLlmConnector(configuration, { ...carrier, modelRequest: undefined }, {
      rootExecutionId: "root-execution"
    }, bindingUrl, async () => { throw new Error("must not invoke"); }),
    /GENERIC_LLM_CONNECTOR_REQUEST_MISSING/
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  bindExternalCredentialReference,
  createNodeMechanicRegistry,
  createGovernedEffectContext,
  observeGovernedHttpExchange
} from "./node-mechanic-registry-loader.mjs";

const ENDPOINT_DIGEST = `sha256:${"a".repeat(64)}`;
const SECRET = "governed-test-secret-never-testimony";
const ROOT_CONTEXT = Object.freeze({ rootExecutionId: "governed-http-proof.execution" });

function credentialConfiguration() {
  return {
    credentialAuthorities: [{
      referenceName: "TEST_GOVERNED_MODEL_KEY",
      source: "environment",
      requestingCapabilityIds: ["execute-governed-model-invocation"],
      endpointAuthorityDigests: [ENDPOINT_DIGEST],
      effectScopes: ["governed-model-invocation"],
      lifetimeMilliseconds: 60000,
      injectionRule: { id: "test-header-key.v1", headerName: "x-test-api-key" }
    }]
  };
}

function bindingRequest(referenceName = "TEST_GOVERNED_MODEL_KEY") {
  return {
    contractId: "bind-external-credential-reference-input.v1",
    payload: {
      scenarioMode: "bind-authorized",
      credentialReference: referenceName,
      invocationIdentity: "invocation-proof-1",
      requestingCapabilityId: "execute-governed-model-invocation",
      endpointAuthorityDigest: ENDPOINT_DIGEST,
      effectScope: "governed-model-invocation"
    }
  };
}

async function startScriptedServer() {
  const observations = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      observations.push({
        url: request.url,
        method: request.method,
        credential: request.headers["x-test-api-key"],
        body: Buffer.concat(chunks).toString("utf8")
      });
      response.setHeader("content-type", "application/json");
      response.setHeader("x-request-id", `request-${observations.length}`);
      response.setHeader("set-cookie", `credential=${SECRET}`);
      if (request.url === "/slow") {
        setTimeout(() => { if (!response.destroyed) response.end('{"slow":true}'); }, 250);
        return;
      }
      if (request.url === "/large") {
        response.end(JSON.stringify({ value: "x".repeat(2048) }));
        return;
      }
      if (request.url === "/malformed") {
        response.end("{not-json");
        return;
      }
      const status = Number(request.url?.split("/").at(-1));
      if (request.url?.startsWith("/status/") && Number.isInteger(status)) response.statusCode = status;
      response.end(JSON.stringify({ accepted: true, status: response.statusCode }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    observations,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

function httpConfiguration(baseUrl) {
  return {
    endpointAuthorities: [{
      endpointAuthorityDigest: ENDPOINT_DIGEST,
      urlPrefixes: [`${baseUrl}/`],
      methods: ["POST"],
      allowedRequestHeaders: ["content-type"],
      allowedResponseHeaders: ["content-type", "x-request-id"]
    }],
    credentialInjectionRules: [{ id: "test-header-key.v1", headerName: "x-test-api-key", valuePrefix: "Bearer " }]
  };
}

function exchangeRequest(baseUrl, binding, path = "/ok", overrides = {}) {
  return {
    contractId: "observe-governed-http-exchange-input.v1",
    payload: {
      exchangeKind: "success",
      invocationIdentity: "invocation-proof-1",
      effectIdentity: "effect-proof-1",
      endpointAuthorityDigest: ENDPOINT_DIGEST,
      requestUrl: `${baseUrl}${path}`,
      method: "POST",
      safeHeaders: { "content-type": "application/json" },
      requestBodyText: '{"prompt":"proof"}',
      opaqueCredentialBinding: {
        bindingId: binding.opaqueBindingId,
        credentialInjectionRuleId: binding.credentialInjectionRuleId
      },
      credentialInjectionRuleId: binding.credentialInjectionRuleId,
      timeoutMilliseconds: 1000,
      maxResponseBytes: 4096,
      redirectPolicy: "reject-all",
      allowedResponseHeaders: ["content-type", "x-request-id"],
      lineageId: "local-server-proof",
      ...overrides
    }
  };
}

function proofContext() {
  let sequence = 0;
  let reads = 0;
  const effectContext = createGovernedEffectContext({
    credentialReader(referenceName) {
      reads += 1;
      return referenceName === "TEST_GOVERNED_MODEL_KEY" ? SECRET : undefined;
    },
    randomId: () => `proof-${++sequence}`,
    allowLoopbackHttpForConformance: true
  });
  return { effectContext, reads: () => reads };
}

test("credential binding reads only one authorized external reference and emits no secret bytes", async () => {
  const proof = proofContext();
  const evidence = await bindExternalCredentialReference(credentialConfiguration(), bindingRequest(), ROOT_CONTEXT, proof.effectContext);
  assert.equal(evidence.disposition, "BOUND");
  assert.equal(proof.reads(), 1);
  assert.match(evidence.opaqueBindingId, /^opaque-credential-binding:proof-1$/u);
  assert.equal(JSON.stringify(evidence).includes(SECRET), false);

  const unauthorized = await bindExternalCredentialReference(credentialConfiguration(), bindingRequest("UNAUTHORIZED_KEY"), ROOT_CONTEXT, proof.effectContext);
  assert.equal(unauthorized.disposition, "UNAUTHORIZED_REFERENCE");
  assert.equal(proof.reads(), 1, "an unauthorized reference must not be read");
});

test("effect ports honor governed request and result paths without replacing the parent carrier", async () => {
  const proof = proofContext();
  const registry = createNodeMechanicRegistry({
    bindingUrl: new URL("./governed-http-effect-ports.conformance.test.mjs", import.meta.url),
    invokeBinding: async () => { throw new Error("nested invocation is not expected"); },
    nativeEffectContext: proof.effectContext
  });
  const port = registry.eventPorts.get("sda-external-credential-reference-binding-port.v1");
  const parent = {
    contractId: "speech-provider-effect-carrier.v1",
    payload: {
      request: bindingRequest(),
      retained: "parent-testimony"
    }
  };
  const outcome = await port({
    bindingId: "port:credential",
    configuration: {
      ...credentialConfiguration(),
      requestPath: "payload.request",
      resultPath: "payload.credentialEvidence"
    }
  }, parent, { ...ROOT_CONTEXT, executions: [], nestedExecutions: [] });

  assert.equal(outcome.payload.retained, "parent-testimony");
  assert.equal(outcome.payload.credentialEvidence.disposition, "BOUND");
  assert.equal(outcome.payload.credentialEvidence.nonDisclosureVerified, true);
  assert.equal(JSON.stringify(outcome).includes(SECRET), false);
});

test("governed HTTP port performs one bounded exchange and redacts injected credentials and disallowed headers", async (t) => {
  const scripted = await startScriptedServer();
  t.after(scripted.close);
  const proof = proofContext();
  const binding = await bindExternalCredentialReference(credentialConfiguration(), bindingRequest(), ROOT_CONTEXT, proof.effectContext);
  const evidence = await observeGovernedHttpExchange(httpConfiguration(scripted.baseUrl), exchangeRequest(scripted.baseUrl, binding), ROOT_CONTEXT, proof.effectContext);

  assert.equal(evidence.disposition, "completed");
  assert.equal(evidence.transportDisposition, "completed");
  assert.equal(evidence.httpStatus, 200);
  assert.equal(evidence.exchangeCount, 1);
  assert.equal(scripted.observations.length, 1);
  assert.equal(scripted.observations[0].credential, `Bearer ${SECRET}`);
  assert.equal(scripted.observations[0].body, '{"prompt":"proof"}');
  assert.deepEqual(Object.keys(evidence.allowedResponseHeaders).sort(), ["content-type", "x-request-id"]);
  assert.equal(JSON.stringify(evidence).includes(SECRET), false);
  assert.equal(Object.hasOwn(evidence.allowedResponseHeaders, "set-cookie"), false);
  assert.equal(Buffer.from(evidence.responseBodyBytes, "base64").toString("utf8"), '{"accepted":true,"status":200}');
});

test("HTTP status testimony retains 401, 429, and 5xx without provider classification or retry", async (t) => {
  const scripted = await startScriptedServer();
  t.after(scripted.close);
  const proof = proofContext();
  for (const status of [401, 429, 503]) {
    const binding = await bindExternalCredentialReference(credentialConfiguration(), bindingRequest(), ROOT_CONTEXT, proof.effectContext);
    const evidence = await observeGovernedHttpExchange(httpConfiguration(scripted.baseUrl), exchangeRequest(scripted.baseUrl, binding, `/status/${status}`, { exchangeKind: "non-success" }), ROOT_CONTEXT, proof.effectContext);
    assert.equal(evidence.disposition, "retained-non-success");
    assert.equal(evidence.httpStatus, status);
    assert.equal(evidence.exchangeCount, 1);
  }
  assert.equal(scripted.observations.length, 3, "the native port must never retry");
});

test("malformed JSON remains bounded uninterpreted transport testimony", async (t) => {
  const scripted = await startScriptedServer();
  t.after(scripted.close);
  const proof = proofContext();
  const binding = await bindExternalCredentialReference(credentialConfiguration(), bindingRequest(), ROOT_CONTEXT, proof.effectContext);
  const evidence = await observeGovernedHttpExchange(httpConfiguration(scripted.baseUrl), exchangeRequest(scripted.baseUrl, binding, "/malformed"), ROOT_CONTEXT, proof.effectContext);
  assert.equal(evidence.disposition, "completed");
  assert.equal(Buffer.from(evidence.responseBodyBytes, "base64").toString("utf8"), "{not-json");
});

test("timeout, cancellation, and response bounds close without retry", async (t) => {
  const scripted = await startScriptedServer();
  t.after(scripted.close);
  const proof = proofContext();

  const timeoutBinding = await bindExternalCredentialReference(credentialConfiguration(), bindingRequest(), ROOT_CONTEXT, proof.effectContext);
  const timedOut = await observeGovernedHttpExchange(httpConfiguration(scripted.baseUrl), exchangeRequest(scripted.baseUrl, timeoutBinding, "/slow", { timeoutMilliseconds: 25, exchangeKind: "timeout" }), ROOT_CONTEXT, proof.effectContext);
  assert.equal(timedOut.disposition, "timed-out");
  assert.equal(timedOut.transportDisposition, "timed-out");

  const cancellationBinding = await bindExternalCredentialReference(credentialConfiguration(), bindingRequest(), ROOT_CONTEXT, proof.effectContext);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 25);
  const cancelled = await observeGovernedHttpExchange(httpConfiguration(scripted.baseUrl), exchangeRequest(scripted.baseUrl, cancellationBinding, "/slow", { exchangeKind: "cancellation" }), { ...ROOT_CONTEXT, signal: controller.signal }, proof.effectContext);
  assert.equal(cancelled.disposition, "cancelled");
  assert.equal(cancelled.transportDisposition, "cancelled");

  const oversizedBinding = await bindExternalCredentialReference(credentialConfiguration(), bindingRequest(), ROOT_CONTEXT, proof.effectContext);
  const oversized = await observeGovernedHttpExchange(httpConfiguration(scripted.baseUrl), exchangeRequest(scripted.baseUrl, oversizedBinding, "/large", { maxResponseBytes: 32, exchangeKind: "oversized-response" }), ROOT_CONTEXT, proof.effectContext);
  assert.equal(oversized.disposition, "oversized-response-rejected");
  assert.equal(oversized.transportDisposition, "oversized");
  assert.equal(oversized.responseBodyBytes, null);
  assert.equal(scripted.observations.length, 3);
});

test("opaque credential handles are one-use and endpoint authority fails closed", async (t) => {
  const scripted = await startScriptedServer();
  t.after(scripted.close);
  const proof = proofContext();
  const binding = await bindExternalCredentialReference(credentialConfiguration(), bindingRequest(), ROOT_CONTEXT, proof.effectContext);
  const request = exchangeRequest(scripted.baseUrl, binding);
  const first = await observeGovernedHttpExchange(httpConfiguration(scripted.baseUrl), request, ROOT_CONTEXT, proof.effectContext);
  const replay = await observeGovernedHttpExchange(httpConfiguration(scripted.baseUrl), request, ROOT_CONTEXT, proof.effectContext);
  assert.equal(first.disposition, "completed");
  assert.equal(replay.disposition, "rejected-credential");
  assert.equal(replay.exchangeCount, 0);
  assert.equal(scripted.observations.length, 1);

  const secondBinding = await bindExternalCredentialReference(credentialConfiguration(), bindingRequest(), ROOT_CONTEXT, proof.effectContext);
  const denied = await observeGovernedHttpExchange(httpConfiguration(scripted.baseUrl), exchangeRequest("http://127.0.0.1:1", secondBinding), ROOT_CONTEXT, proof.effectContext);
  assert.equal(denied.disposition, "rejected-endpoint");
  assert.equal(denied.exchangeCount, 0);
});

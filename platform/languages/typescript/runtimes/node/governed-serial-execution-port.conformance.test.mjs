import test from "node:test";
import assert from "node:assert/strict";
import { createNodeMechanicRegistry, canonicalDigest } from "./node-mechanic-registry-loader.mjs";

const binding = { configuration: { transactionBindings: [] } };
const context = { rootExecutionId: "serial-proof", nestedExecutions: [] };
const invokeBinding = async () => { throw new Error("unexpected child invocation"); };
const port = () => createNodeMechanicRegistry({ bindingUrl: new URL(import.meta.url), invokeBinding })
  .eventPorts.get("sda-governed-serial-execution-port.v1");

function child(capabilityId, decision = "STOP") {
  const binding = { bindingType: "projected-consumer-application-binding.v2", capabilityId };
  const authorityDigest = `sha256:${capabilityId.padEnd(64, "0").slice(0, 64)}`;
  return { capabilityId, bindingRef: `${capabilityId}.json`, bindingDigest: canonicalDigest(binding), capabilityAuthorityDigest: authorityDigest,
    continuationDecisionPath: "continuationDecision", requestPath: "request", decision };
}

function mechanics(entries, calls) {
  const invoke = async (bindingRef, request) => {
    calls.push({ bindingRef, request });
    const item = entries.find((entry) => entry.bindingRef === bindingRef);
    const application = { binding: { bindingType: "projected-consumer-application-binding.v2", capabilityId: item.capabilityId }, plan: { capabilityId: item.capabilityId, source: { capabilityAuthorityDigest: item.capabilityAuthorityDigest } } };
    return { application, execute: async () => ({ disposition: "terminated", outcome: { result: request, continuationDecision: item.decision }, executions: [], observations: [] }) };
  };
  return createNodeMechanicRegistry({ bindingUrl: new URL(import.meta.url), invokeBinding: invoke }).eventPorts.get("sda-governed-serial-execution-port.v1");
}

test("rejects duplicate bounded capability identities before invocation", async () => {
  await assert.rejects(() => port()(binding, { boundedTransactions: [{ capabilityId: "a" }, { capabilityId: "a" }] }, context), /DUPLICATE_IDENTITY/);
});

test("rejects an unavailable child without inventing a transaction", async () => {
  await assert.rejects(() => port()(binding, { boundedTransactions: [{ capabilityId: "a" }] }, context), /CHILD_UNAVAILABLE/);
});

test("executes bounded children in declared order", async () => {
  const entries = [child("alpha", "CONTINUE"), child("beta")], calls = [];
  const result = await mechanics(entries, calls)({ configuration: { transactionBindings: entries } }, { boundedTransactions: entries.map((entry, i) => ({ capabilityId: entry.capabilityId, transactionId: `${i}`, request: { i }, continuationDecision: entry.decision })) }, { rootExecutionId: "ordered", nestedExecutions: [] });
  assert.deepEqual(calls.map((call) => call.bindingRef), ["alpha.json", "beta.json"]);
  assert.equal(result.observations.length, 2);
});

test("continues after a rejected child only when the supplied decision says continue", async () => {
  const entries = [child("rejected", "CONTINUE"), child("next")], calls = [];
  await mechanics(entries, calls)({ configuration: { transactionBindings: entries } }, { boundedTransactions: entries.map((entry) => ({ capabilityId: entry.capabilityId, request: {}, continuationDecision: entry.decision })) }, { rootExecutionId: "continue", nestedExecutions: [] });
  assert.equal(calls.length, 2);
});

test("stops without invoking a later child when supplied authority says stop", async () => {
  const entries = [child("first"), child("not-reached")], calls = [];
  await mechanics(entries, calls)({ configuration: { transactionBindings: entries } }, { boundedTransactions: entries.map((entry) => ({ capabilityId: entry.capabilityId, request: {}, continuationDecision: entry.decision })) }, { rootExecutionId: "stop", nestedExecutions: [] });
  assert.equal(calls.length, 1);
});

test("rejects a child binding or authority lineage mismatch", async () => {
  const entry = child("mismatch"); entry.bindingDigest = `sha256:${"0".repeat(64)}`;
  await assert.rejects(() => mechanics([entry], [])({ configuration: { transactionBindings: [entry] } }, { boundedTransactions: [{ capabilityId: "mismatch", request: {} }] }, { rootExecutionId: "mismatch", nestedExecutions: [] }), /CHILD_LINEAGE_MISMATCH/);
});

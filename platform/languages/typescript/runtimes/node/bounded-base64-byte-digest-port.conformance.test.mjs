import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createNodeMechanicRegistry } from "./node-mechanic-registry-loader.mjs";

const platformCapabilityId = "sda-bounded-base64-byte-digest-port.v1";
const sha = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;

function provider(host) {
  const registry = createNodeMechanicRegistry({
    bindingUrl: pathToFileURL(path.join(host, "projected", "application-binding.node.json")),
    invokeBinding: () => { throw new Error("Nested invocation is not used by byte digest resolution."); }
  });
  return registry.eventPorts.get(platformCapabilityId);
}

const binding = { bindingId: "port:byte-digest", configuration: {} };
const context = { rootExecutionId: "byte-digest.conformance" };

test("digests exact decoded bytes without UTF-8 coercion", async (t) => {
  const host = fs.mkdtempSync(path.join(os.tmpdir(), "sda-byte-digest-host-"));
  fs.mkdirSync(path.join(host, "projected"));
  t.after(() => fs.rmSync(host, { recursive: true, force: true }));
  const binary = Buffer.from([0, 255, 195, 40, 10]);
  const multibyte = Buffer.from("é漢字", "utf8");
  const result = await provider(host)(binding, {
    items: [
      { itemId: "binary", bytesBase64: binary.toString("base64"), expectedDigest: sha(binary) },
      { itemId: "multibyte", bytesBase64: multibyte.toString("base64"), expectedDigest: sha(multibyte) }
    ],
    effectLineage: ["digest-request"]
  }, context);
  assert.equal(result.observed, 2);
  assert.equal(result.allExpectedDigestsMatch, true);
  assert.deepEqual(result.observations.map((item) => item.byteLength), [5, multibyte.length]);
  assert.deepEqual(result.effectLineage, ["digest-request", context.rootExecutionId]);
});

test("reports digest divergence without changing the observed bytes", async (t) => {
  const host = fs.mkdtempSync(path.join(os.tmpdir(), "sda-byte-digest-host-"));
  fs.mkdirSync(path.join(host, "projected"));
  t.after(() => fs.rmSync(host, { recursive: true, force: true }));
  const bytes = Buffer.from("exact", "utf8");
  const result = await provider(host)(binding, {
    items: [{ itemId: "divergent", bytesBase64: bytes.toString("base64"), expectedDigest: `sha256:${"0".repeat(64)}` }]
  }, context);
  assert.equal(result.allExpectedDigestsMatch, false);
  assert.equal(result.observations[0].matchesExpected, false);
  assert.equal(result.observations[0].observedDigest, sha(bytes));
});

test("digests a large exact entry without representation-validator stack overflow", async (t) => {
  const host = fs.mkdtempSync(path.join(os.tmpdir(), "sda-byte-digest-host-"));
  fs.mkdirSync(path.join(host, "projected"));
  t.after(() => fs.rmSync(host, { recursive: true, force: true }));
  const bytes = Buffer.alloc((20 * 1024 * 1024) + 3, 0xa5);
  const result = await provider(host)(binding, {
    items: [{ itemId: "large-entry", bytesBase64: bytes.toString("base64"), expectedDigest: sha(bytes) }]
  }, context);
  assert.equal(result.allExpectedDigestsMatch, true);
  assert.equal(result.observations[0].byteLength, bytes.length);
  assert.equal(result.observations[0].observedDigest, sha(bytes));
});

test("rejects non-canonical base64 and duplicate item identities", async (t) => {
  const host = fs.mkdtempSync(path.join(os.tmpdir(), "sda-byte-digest-host-"));
  fs.mkdirSync(path.join(host, "projected"));
  t.after(() => fs.rmSync(host, { recursive: true, force: true }));
  const invoke = provider(host);
  await assert.rejects(invoke(binding, { items: [{ itemId: "invalid", bytesBase64: "YQ" }] }, context), /BASE64_BYTE_DIGEST_REPRESENTATION_REJECTED/);
  await assert.rejects(invoke(binding, { items: [
    { itemId: "same", bytesBase64: "YQ==" },
    { itemId: "same", bytesBase64: "Yg==" }
  ] }, context), /BASE64_BYTE_DIGEST_UNIQUE_ITEM_ID_REQUIRED/);
});

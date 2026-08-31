import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { observeGovernedExternalRoot } from "./governed-external-root-observation-provider.mjs";

const digest = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const context = { rootExecutionId: "external-root-observation.conformance" };

function request(root, resources, order = resources.map((resource) => resource.semanticIdentity)) {
  return {
    carrierType: "bounded-governed-external-root-observation-context.v1",
    rootRef: pathToFileURL(root).href,
    declaredResources: resources,
    stableIdentityOrder: order,
    requestLineage: ["external-root-observation-conformance"]
  };
}

test("observes exact bytes, byte lengths, digests, absence, and directory presence in declared order", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-external-observation-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const binary = Buffer.from([0x00, 0xff, 0xc3, 0xa9]);
  fs.mkdirSync(path.join(root, "nested"));
  fs.writeFileSync(path.join(root, "nested", "binary.bin"), binary);

  const result = await observeGovernedExternalRoot({}, request(root, [{
    semanticIdentity: "binary",
    relativePath: "nested/binary.bin",
    expectedKind: "file",
    requestedFactForms: ["presence", "bytes", "digest", "byteLength"],
    expectedSha256: digest(binary)
  }, {
    semanticIdentity: "missing",
    relativePath: "missing.txt",
    expectedKind: "file",
    requestedFactForms: ["presence"]
  }, {
    semanticIdentity: "nested-directory",
    relativePath: "nested",
    expectedKind: "directory",
    requestedFactForms: ["presence"]
  }], ["missing", "binary", "nested-directory"]), context);

  assert.equal(result.bounded, true);
  assert.equal(result.unchangedRoot, true);
  assert.equal(result.bytesEncoding, "base64");
  assert.deepEqual(result.observedFacts.map((fact) => fact.semanticIdentity), ["missing", "binary", "nested-directory"]);
  assert.equal(result.observedFacts[0].presence, false);
  assert.equal(result.observedFacts[1].exactBytes, binary.toString("base64"));
  assert.equal(result.observedFacts[1].byteLength, 4);
  assert.equal(result.observedFacts[1].sha256, digest(binary));
  assert.equal(result.observedFacts[2].presence, true);
  assert.deepEqual(result.attributableRejections, []);
});

test("rejects traversal, absolute paths, symbolic links, and incomplete stable ordering without reading outside authority", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-external-observation-boundary-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sda-external-observation-outside-"));
  t.after(() => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }); });
  fs.writeFileSync(path.join(outside, "secret.txt"), "secret");

  for (const relativePath of ["../secret.txt", path.join(outside, "secret.txt")]) {
    const result = await observeGovernedExternalRoot({}, request(root, [{
      semanticIdentity: "rejected",
      relativePath,
      requestedFactForms: ["presence", "bytes"]
    }]), context);
    assert.equal(result.bounded, false);
    assert.equal(result.observedFacts.length, 0);
    assert.match(result.attributableRejections[0].code, /REFERENCE_REJECTED/);
  }

  const incomplete = await observeGovernedExternalRoot({}, request(root, [{
    semanticIdentity: "one",
    relativePath: "one.txt"
  }], []), context);
  assert.equal(incomplete.bounded, false);
  assert.deepEqual(incomplete.attributableRejections.map((item) => item.code), ["STABLE_RESOURCE_ORDER_REJECTED"]);

  try {
    fs.symlinkSync(path.join(outside, "secret.txt"), path.join(root, "link.txt"), "file");
  } catch (error) {
    if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) return;
    throw error;
  }
  const linked = await observeGovernedExternalRoot({}, request(root, [{
    semanticIdentity: "linked",
    relativePath: "link.txt",
    requestedFactForms: ["presence", "bytes"]
  }]), context);
  assert.equal(linked.bounded, false);
  assert.equal(linked.observedFacts.length, 0);
  assert.deepEqual(linked.attributableRejections.map((item) => item.code), ["EXTERNAL_OBSERVATION_SYMBOLIC_LINK_REJECTED"]);
});

test("reports digest divergence and leaves the caller-authorized root unchanged", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-external-observation-digest-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "value.txt");
  fs.writeFileSync(file, "value");
  const before = fs.readFileSync(file);
  const result = await observeGovernedExternalRoot({}, request(root, [{
    semanticIdentity: "value",
    relativePath: "value.txt",
    requestedFactForms: ["presence", "bytes", "digest", "byteLength"],
    expectedSha256: `sha256:${"0".repeat(64)}`
  }]), context);
  assert.equal(result.bounded, true);
  assert.deepEqual(result.attributableRejections.map((item) => item.code), ["DIGEST_MISMATCH"]);
  assert.deepEqual(fs.readFileSync(file), before);
});

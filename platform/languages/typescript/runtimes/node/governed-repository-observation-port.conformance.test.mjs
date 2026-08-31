import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createNodeMechanicRegistry, evaluateExpression } from "./node-mechanic-registry-loader.mjs";

function digest(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function observes(directory, input) {
  const projected = path.join(directory, "projected");
  fs.mkdirSync(projected);
  const bindingUrl = pathToFileURL(path.join(projected, "application-binding.node.json"));
  const provider = createNodeMechanicRegistry({
    bindingUrl,
    invokeBinding: () => { throw new Error("Nested invocation is not used by repository observation."); }
  }).eventPorts.get("sda-governed-repository-observation-port.v1");
  return provider({
    bindingId: "port:observe-repository",
    configuration: {
      observationAuthorityRef: "interfaces.authority.json#/repository-observation",
      observationAuthority: {
        authorityType: "governed-repository-observation-authority.v1",
        roots: [{ rootId: "fixture-root", relativePath: ".." }]
      }
    }
  }, input, { rootExecutionId: "repository-observation.conformance" });
}

function request(resources, stableIdentityOrder) {
  return {
    carrierType: "bounded-governed-repository-observation-context.v1",
    admittedRoot: "fixture-root",
    observationAuthorityRef: "interfaces.authority.json#/repository-observation",
    declaredResources: resources,
    requestedFactForms: ["presence", "bytes", "digest"],
    stableIdentityOrder,
    requestLineage: ["repository-observation.request"]
  };
}

test("governed repository observation returns ordered exact facts without mutation", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sda-repository-observation-"));
  try {
    const before = Buffer.from("alpha\nbeta", "utf8");
    fs.writeFileSync(path.join(directory, "observed.txt"), before);
    const outcome = await observes(directory, request([
      { semanticIdentity: "observed", relativePath: "observed.txt", requestedFactForms: ["presence", "bytes", "digest"] },
      { semanticIdentity: "missing", relativePath: "missing.txt", requestedFactForms: ["presence"] }
    ], ["missing", "observed"]));
    assert.equal(outcome.carrierType, "governed-repository-observation.v1");
    assert.equal(outcome.bounded, true);
    assert.equal(outcome.unchangedRepository, true);
    assert.equal(outcome.interpretationMade, false);
    assert.equal(outcome.bytesEncoding, "base64");
    assert.deepEqual(outcome.stableOrder, ["missing", "observed"]);
    assert.deepEqual(outcome.observedFacts[0], {
      semanticIdentity: "missing", relativePath: "missing.txt", presence: false, factForms: ["presence"]
    });
    assert.deepEqual(outcome.observedFacts[1], {
      semanticIdentity: "observed",
      relativePath: "observed.txt",
      presence: true,
      factForms: ["presence", "bytes", "digest"],
      exactBytes: before.toString("base64"),
      sha256: digest(before)
    });
    assert.deepEqual(outcome.attributableRejections, []);
    assert.deepEqual(fs.readFileSync(path.join(directory, "observed.txt")), before);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("governed repository observation returns attributable boundary and digest findings", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sda-repository-observation-rejection-"));
  try {
    fs.writeFileSync(path.join(directory, "observed.txt"), "alpha", "utf8");
    const outcome = await observes(directory, request([
      {
        semanticIdentity: "digest-mismatch",
        relativePath: "observed.txt",
        requestedFactForms: ["digest"],
        expectedSha256: `sha256:${"0".repeat(64)}`
      },
      { semanticIdentity: "escaped", relativePath: "../escaped.txt", requestedFactForms: ["presence"] }
    ], ["digest-mismatch", "escaped", "undeclared"]));
    assert.equal(outcome.bounded, false);
    assert.deepEqual(outcome.attributableRejections.map((finding) => finding.code), [
      "UNDECLARED_RESOURCE", "DIGEST_MISMATCH", "OUT_OF_ROOT_TRAVERSAL"
    ]);
    assert.match(outcome.observedFacts[0].sha256, /^sha256:[a-f0-9]{64}$/);
    assert.ok(outcome.effectLineage.includes("repository-observation.conformance"));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("governed repository observation reports physical byte length without conflating empty and missing files", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sda-repository-observation-byte-length-"));
  try {
    const multibyte = Buffer.from("é\n", "utf8");
    const binary = Buffer.from([0x00, 0xff, 0x80, 0x0a]);
    fs.writeFileSync(path.join(directory, "multibyte.txt"), multibyte);
    fs.writeFileSync(path.join(directory, "empty.bin"), Buffer.alloc(0));
    fs.writeFileSync(path.join(directory, "binary.bin"), binary);
    const outcome = await observes(directory, request([
      { semanticIdentity: "multibyte", relativePath: "multibyte.txt", requestedFactForms: ["presence", "byteLength"] },
      { semanticIdentity: "empty", relativePath: "empty.bin", requestedFactForms: ["presence", "byteLength"] },
      { semanticIdentity: "binary", relativePath: "binary.bin", requestedFactForms: ["presence", "byteLength"] },
      { semanticIdentity: "missing", relativePath: "missing.bin", requestedFactForms: ["presence", "byteLength"] }
    ], ["binary", "empty", "missing", "multibyte"]));
    assert.deepEqual(outcome.observedFacts, [
      {
        semanticIdentity: "binary", relativePath: "binary.bin", presence: true,
        factForms: ["presence", "byteLength"], byteLength: binary.length
      },
      {
        semanticIdentity: "empty", relativePath: "empty.bin", presence: true,
        factForms: ["presence", "byteLength"], byteLength: 0
      },
      {
        semanticIdentity: "missing", relativePath: "missing.bin", presence: false,
        factForms: ["presence", "byteLength"]
      },
      {
        semanticIdentity: "multibyte", relativePath: "multibyte.txt", presence: true,
        factForms: ["presence", "byteLength"], byteLength: multibyte.length
      }
    ]);
    assert.equal(multibyte.length, 3);
    assert.equal(multibyte.toString("utf8").length, 2);
    assert.deepEqual(outcome.attributableRejections, []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("declarative transformations decode observed JSON bytes and reproduce compact JSON hashing", () => {
  const structuredValue = { candidate: "alpha", nested: { accepted: false } };
  const response = JSON.stringify({ result: { structuredValue } });
  const expression = {
    op: "sha256",
    value: {
      op: "json-stringify",
      value: {
        op: "path",
        from: "parsed",
        path: "result.structuredValue"
      }
    }
  };
  const parsed = evaluateExpression({
    op: "parse-json",
    value: { op: "base64-decode-utf8", value: { op: "path", from: "input", path: "exactBytes" } }
  }, { input: { exactBytes: Buffer.from(response).toString("base64") } });
  assert.equal(
    evaluateExpression(expression, { parsed }),
    crypto.createHash("sha256").update(JSON.stringify(structuredValue)).digest("hex")
  );
});

test("declarative transformations enumerate object values in lexical key order", () => {
  assert.deepEqual(evaluateExpression({
    op: "object-values",
    value: { op: "path", from: "input", path: "catalog" }
  }, { input: { catalog: { zebra: "z.schema.json", alpha: "a.schema.json" } } }), [
    "a.schema.json",
    "z.schema.json"
  ]);
});

test("declarative transformations classify malformed JSON without throwing", () => {
  const expression = { op: "try-parse-json", value: { op: "path", from: "input", path: "text" } };
  assert.deepEqual(evaluateExpression(expression, { input: { text: '{"valid":true}' } }), {
    disposition: "PARSED",
    value: { valid: true }
  });
  assert.deepEqual(evaluateExpression(expression, { input: { text: '{"invalid":]' } }), {
    disposition: "NOT_PARSED",
    value: null
  });
});

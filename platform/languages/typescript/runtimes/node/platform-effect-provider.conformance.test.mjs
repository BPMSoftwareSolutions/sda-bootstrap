import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { invokePlatformEffectMechanic } from "./platform-effect-provider.mjs";

test("admitted read-file-bytes mechanic returns byte-exact observation inside the binding root", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-read-file-bytes-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from([0x40, 0x57, 0x6a, 0x77, 0x7c, 0x77, 0x6a, 0x57, 0x40, 0x29, 0x16, 0x09, 0x04, 0x09, 0x16, 0x29]);
  const target = path.join(root, "artifact.bin");
  fs.writeFileSync(target, bytes);
  const digest = `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
  const observed = invokePlatformEffectMechanic("read-file-bytes", {
    bindingUrl: pathToFileURL(path.join(root, "application-binding.node.json")),
    input: { location: target, expectedSha256: digest },
    configuration: {
      operationKind: "read-file-bytes",
      pathPath: "location",
      expectedSha256Path: "expectedSha256",
      outputMode: "binary-artifact-readback-observation.v2"
    }
  });
  assert.deepEqual(observed, {
    observationType: "binary-artifact-readback-observation.v2",
    destination: target,
    byteLength: bytes.length,
    sha256: digest,
    expectedSha256: digest,
    equal: true
  });
});

test("admitted read-file-bytes mechanic rejects paths outside the binding root", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-read-file-root-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sda-read-file-outside-"));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const target = path.join(outside, "artifact.bin");
  fs.writeFileSync(target, "outside");
  assert.throws(() => invokePlatformEffectMechanic("read-file-bytes", {
    bindingUrl: pathToFileURL(path.join(root, "application-binding.node.json")),
    input: { location: target },
    configuration: { operationKind: "read-file-bytes", pathPath: "location" }
  }), /READ_FILE_BYTES_PATH_OUTSIDE_ADMITTED_ROOT/);
});

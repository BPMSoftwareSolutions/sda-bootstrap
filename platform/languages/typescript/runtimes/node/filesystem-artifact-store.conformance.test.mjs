import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createNodeMechanicRegistry } from "./node-mechanic-registry-loader.mjs";

function ownedTestArtifactRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-artifact-store-test-"));
  const marker = crypto.randomUUID();
  fs.writeFileSync(path.join(root, ".sda-test-artifact-root.json"), JSON.stringify({ marker, root }), "utf8");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, marker };
}

function testStore(root, marker) {
  return createNodeMechanicRegistry({
    bindingUrl: pathToFileURL(path.join(root, "application-binding.node.json")).href,
    invokeBinding: async () => { throw new Error("UNUSED"); },
    testArtifactContext: { testExecution: true, testArtifactRoot: root, testArtifactRootMarker: marker }
  }).eventPorts.get("sda-filesystem-artifact-store.v1");
}

function artifactBinding(directory = "published") {
  return { configuration: {
    contentPath: "content", directory, logicalName: "artifact.json",
    existingDestinationPolicy: "reject", targetPath: "publicationReference"
  } };
}

function artifactInput() { return { content: "{}", publicationReference: {} }; }

test("filesystem artifact store rejects symbolic-link destination directories", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-artifact-store-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sda-artifact-store-outside-"));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });
  const linkedDirectory = path.join(root, "linked-output");
  try {
    fs.symlinkSync(outside, linkedDirectory, "junction");
  } catch (error) {
    t.skip(`symbolic links unavailable: ${error.code ?? error.message}`);
    return;
  }
  const registry = createNodeMechanicRegistry({
    bindingUrl: pathToFileURL(path.join(root, "application-binding.node.json")).href,
    invokeBinding: async () => { throw new Error("UNUSED"); }
  });
  const store = registry.eventPorts.get("sda-filesystem-artifact-store.v1");
  await assert.rejects(
    () => store({ configuration: {
      contentPath: "content", directory: "linked-output", logicalName: "artifact.json",
      existingDestinationPolicy: "reject", targetPath: "publicationReference"
    } }, { content: "{}", publicationReference: {} }, { rootExecutionId: "proof" }),
    /ARTIFACT_DIRECTORY_(SYMBOLIC_LINK|SYMLINK)_REJECTED/
  );
  assert.equal(fs.existsSync(path.join(outside, "artifact.json")), false);
});

test("test-only artifact root rejects replay within one immutable sandbox", async (t) => {
  const { root, marker } = ownedTestArtifactRoot(t);
  const store = testStore(root, marker);
  await store(artifactBinding(), artifactInput(), { rootExecutionId: "first" });
  await assert.rejects(
    () => store(artifactBinding(), artifactInput(), { rootExecutionId: "replay" }),
    /ARTIFACT_DESTINATION_EXISTS/
  );
});

test("independent owned test artifact roots admit identical publication", async (t) => {
  const left = ownedTestArtifactRoot(t);
  const right = ownedTestArtifactRoot(t);
  const leftResult = await testStore(left.root, left.marker)(artifactBinding(), artifactInput(), { rootExecutionId: "left" });
  const rightResult = await testStore(right.root, right.marker)(artifactBinding(), artifactInput(), { rootExecutionId: "right" });
  assert.ok(leftResult.publicationReference.path.startsWith(left.root));
  assert.ok(rightResult.publicationReference.path.startsWith(right.root));
});

test("base64 artifact store derives the bounded logical name and byte evidence from decoded bytes", async (t) => {
  const { root, marker } = ownedTestArtifactRoot(t);
  const bytes = Buffer.from([0x40, 0x57, 0x6a, 0x77, 0x7c, 0x77, 0x6a, 0x57, 0x40, 0x29, 0x16, 0x09, 0x04, 0x09, 0x16, 0x29]);
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  const input = { content: bytes.toString("base64"), publicationReference: {} };
  const result = await testStore(root, marker)({ configuration: {
    contentPath: "content", directory: "artifacts", logicalNameFromContentSha256: true,
    logicalNameSuffix: ".bin", encoding: "base64", existingDestinationPolicy: "reject",
    targetPath: "publicationReference"
  } }, input, { rootExecutionId: "byte-proof" });
  assert.equal(path.basename(result.publicationReference.path), `${digest}.bin`);
  assert.equal(result.publicationReference.byteSha256, `sha256:${digest}`);
  assert.equal(result.publicationReference.byteLength, bytes.length);
  assert.deepEqual(fs.readFileSync(result.publicationReference.path), bytes);
});

test("test-only artifact root rejects traversal and symbolic-link escape", async (t) => {
  const { root, marker } = ownedTestArtifactRoot(t);
  const store = testStore(root, marker);
  await assert.rejects(
    () => store(artifactBinding("../outside"), artifactInput(), { rootExecutionId: "traversal" }),
    /artifact directory escapes|ARTIFACT_DIRECTORY_INVALID/
  );
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sda-artifact-store-outside-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  try { fs.symlinkSync(outside, path.join(root, "linked"), "junction"); }
  catch (error) { t.skip(`symbolic links unavailable: ${error.code ?? error.message}`); return; }
  await assert.rejects(
    () => store(artifactBinding("linked"), artifactInput(), { rootExecutionId: "symlink" }),
    /ARTIFACT_DIRECTORY_(SYMBOLIC_LINK|SYMLINK)_REJECTED/
  );
  assert.equal(fs.existsSync(path.join(outside, "artifact.json")), false);
});

test("projected consumer invocation rejects caller-supplied test artifact override", async () => {
  const runtime = await import(pathToFileURL(path.resolve(process.cwd(), "..", "agentic-harness", "capabilities",
    "construct-capability-author-delegate-request", "projected", "node", "capability-runtime.generated.mjs")).href);
  assert.throws(
    () => runtime.executeCapability({}, { testExecution: true, testArtifactRoot: os.tmpdir(), testArtifactRootMarker: "forbidden" }),
    /TEST_ARTIFACT_OVERRIDE_NOT_AVAILABLE_TO_CONSUMERS/
  );
});

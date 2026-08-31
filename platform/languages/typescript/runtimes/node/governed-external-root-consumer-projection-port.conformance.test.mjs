import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createNodeMechanicRegistry } from "./node-mechanic-registry-loader.mjs";

const platformCapabilityId = "sda-governed-external-root-consumer-projection-port.v1";
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const artifactsRoot = path.join(repositoryRoot, "artifacts");

const digest = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;

function provider(host) {
  const registry = createNodeMechanicRegistry({
    bindingUrl: pathToFileURL(path.join(host, "projected", "application-binding.node.json")),
    invokeBinding: () => { throw new Error("Nested invocation is not used by consumer projection."); }
  });
  return registry.eventPorts.get(platformCapabilityId);
}

function arrange() {
  fs.mkdirSync(artifactsRoot, { recursive: true });
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "governed-consumer-projection-external-"));
  const workspace = path.join(externalRoot, "workspace");
  const host = fs.mkdtempSync(path.join(artifactsRoot, "governed-consumer-projection-host-"));
  fs.mkdirSync(path.join(host, "projected"));
  fs.cpSync(path.join(repositoryRoot, "examples", "generic-capability"), workspace, { recursive: true });
  fs.rmSync(path.join(workspace, "projected"), { recursive: true, force: true });
  const authorityBytes = fs.readFileSync(path.join(workspace, "capability.authority.json"));
  return {
    workspace,
    externalRoot,
    workspaceRef: "workspace",
    host,
    authorityDigest: digest(authorityBytes),
    invoke: provider(host)
  };
}

const binding = {
  bindingId: "port:governed-consumer-projection",
  configuration: {}
};
const context = { rootExecutionId: "consumer-projection.conformance" };

test("projects a digest-bound consumer workspace inside a caller-authorized external root", async (t) => {
  const arranged = arrange();
  t.after(() => {
    fs.rmSync(arranged.externalRoot, { recursive: true, force: true });
    fs.rmSync(arranged.host, { recursive: true, force: true });
  });
  const result = await arranged.invoke(binding, {
    rootUrl: pathToFileURL(arranged.externalRoot).href,
    operations: [{
      projectionId: "project-generic",
      workspaceRef: arranged.workspaceRef,
      capabilityAuthorityDigest: arranged.authorityDigest,
      projectionTargets: ["node"]
    }],
    effectLineage: ["projection-request"]
  }, context);
  assert.equal(result.disposition, "PROJECTED");
  assert.equal(result.projected, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.observations[0].capabilityId, "capability-a");
  assert.equal(result.observations[0].capabilityAuthorityDigest, arranged.authorityDigest);
  assert.deepEqual(result.observations[0].projectionTargets, ["node"]);
  assert.equal(fs.existsSync(path.join(arranged.workspace, "projected", "application-binding.node.json")), true);
  assert.deepEqual(result.effectLineage, ["projection-request", context.rootExecutionId]);
});

test("rejects authority digest divergence before projection", async (t) => {
  const arranged = arrange();
  t.after(() => {
    fs.rmSync(arranged.externalRoot, { recursive: true, force: true });
    fs.rmSync(arranged.host, { recursive: true, force: true });
  });
  await assert.rejects(
    arranged.invoke(binding, {
      rootUrl: pathToFileURL(arranged.externalRoot).href,
      operations: [{
        projectionId: "reject-digest",
        workspaceRef: arranged.workspaceRef,
        capabilityAuthorityDigest: `sha256:${"0".repeat(64)}`,
        projectionTargets: ["node"]
      }]
    }, context),
    /CONSUMER_PROJECTION_CAPABILITY_AUTHORITY_DIGEST_MISMATCH/
  );
  assert.equal(fs.existsSync(path.join(arranged.workspace, "projected")), false);
});

test("rejects traversal before reading a workspace", async (t) => {
  const arranged = arrange();
  t.after(() => {
    fs.rmSync(arranged.externalRoot, { recursive: true, force: true });
    fs.rmSync(arranged.host, { recursive: true, force: true });
  });
  await assert.rejects(
    arranged.invoke(binding, {
      rootUrl: pathToFileURL(arranged.externalRoot).href,
      operations: [{
        projectionId: "reject-traversal",
        workspaceRef: "../examples/generic-capability",
        capabilityAuthorityDigest: arranged.authorityDigest,
        projectionTargets: ["node"]
      }]
    }, context),
    /CONSUMER_PROJECTION_WORKSPACE_REFERENCE_REJECTED/
  );
  assert.equal(fs.existsSync(path.join(arranged.workspace, "projected")), false);
});

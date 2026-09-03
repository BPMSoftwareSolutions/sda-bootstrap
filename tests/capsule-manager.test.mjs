import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const packageRoot = path.resolve(import.meta.dirname, "..");
const managerSource = path.join(packageRoot, "src", "capsule-manager.mjs");
const sha256 = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

test("verifies an internally consistent empty capsule estate", (context) => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-bootstrap-unit-"));
  context.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));

  writeJson(path.join(repositoryRoot, "capsules", "capsule-estate.manifest.json"), {
    estateManifestType: "sidefx-capsule-estate-manifest.v1",
    capabilityCount: 0,
    capsules: [],
  });

  const result = spawnSync(process.execPath, [managerSource, "verify"], {
    cwd: repositoryRoot,
    env: process.env,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    capabilityCount: 0,
    entryCount: 0,
    durableLayout: { expandedCapabilityRoot: "ABSENT" },
  });
  assert.equal(fs.existsSync(path.join(repositoryRoot, "bootstrap")), false);
});

test("provisions and executes a content-addressed capability token without a managed estate", (context) => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-bootstrap-provision-"));
  context.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));
  const featurePath = path.join(repositoryRoot, "features", "quote-order.feature");
  fs.mkdirSync(path.dirname(featurePath), { recursive: true });
  fs.writeFileSync(featurePath, [
    "@capability:quote-order",
    "Feature: Quote an order",
    "  A cheap capability token retains the requested topology.",
    "",
    "  Scenario: Quote one accepted order",
    "    Given an order request",
    "    When the order is quoted",
    "    Then the quote is returned",
    "",
    "  Scenario: Reject one invalid order",
    "    Given an invalid order request",
    "    When the order is quoted",
    "    Then the validation findings are returned",
    "",
  ].join("\n"), "utf8");

  const invoke = () => spawnSync(process.execPath, [managerSource, "provision", featurePath], {
    cwd: repositoryRoot,
    env: process.env,
    encoding: "utf8",
  });
  const first = invoke();
  assert.equal(first.status, 0, first.stderr);
  const result = JSON.parse(first.stdout);
  assert.equal(result.operation, "TOKEN_PROVISIONING");
  assert.equal(result.capabilityId, "quote-order");
  assert.equal(result.provisioningDisposition, "PROVISIONED_EXECUTABLE_WITH_OPEN_SLOTS");
  assert.equal(result.proof.structuralDisposition, "PASS");
  assert.equal(result.proof.exactTokenExecutionDisposition, "terminated");
  assert.equal(result.execution.outcome.managedAdmission, "NOT_REQUIRED");
  assert.equal(result.execution.outcome.scenarioTopology.length, 2);
  assert.equal(result.execution.outcome.openSlots.length, 2);
  assert.equal(result.execution.outcome.motifs[0].motifType, "LINEAR_PIPELINE");

  const capsulePath = path.join(repositoryRoot, result.capsulePath);
  const receiptPath = path.join(repositoryRoot, result.placementReceiptPath);
  assert.equal(sha256(fs.readFileSync(capsulePath)), result.capsuleDigest);
  assert.equal(readJson(receiptPath).externalProvisioningRepositoryParticipated, false);
  assert.deepEqual(
    fs.readdirSync(path.join(repositoryRoot, "provisioning")).map((name) => path.extname(name)).sort(),
    [".json", ".sfxcap"],
  );
  const capsule = readJson(capsulePath);
  assert.equal(capsule.lifecycleDisposition, "PROVISIONAL");
  assert.deepEqual(capsule.declaredDependencies, []);
  assert.deepEqual(capsule.externalToolRoots, []);
  assert.ok(capsule.entries.some((entry) => entry.entryId === "blueprint.authority.json"));
  assert.ok(capsule.entries.some((entry) => entry.entryId === "executable-scaffold.authority.json"));

  const openSlotInvocation = spawnSync(
    process.execPath,
    [managerSource, "invoke-provisioned", result.capsulePath, JSON.stringify({
      requestType: "execute-provisioned-capability.v1",
      payload: { orderId: "order-1" },
    })],
    { cwd: repositoryRoot, env: process.env, encoding: "utf8" },
  );
  assert.equal(openSlotInvocation.status, 0, openSlotInvocation.stderr);
  const openSlotResult = JSON.parse(openSlotInvocation.stdout);
  assert.equal(openSlotResult.execution.disposition, "terminated");
  assert.equal(openSlotResult.execution.outcome.executionDisposition, "PROVIDER_REQUIRED");
  assert.equal(openSlotResult.execution.outcome.reachedNodeId, "quote-one-accepted-order");
  assert.equal(openSlotResult.execution.outcome.motifs[0].motifType, "LINEAR_PIPELINE");

  const second = invoke();
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(JSON.parse(second.stdout), result);
  assert.equal(fs.readdirSync(path.join(repositoryRoot, "provisioning")).length, 2);
});

test("invokes explicitly bound provisional capability providers by exact capsule path", (context) => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-bootstrap-provider-"));
  context.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));
  const featureRoot = path.join(repositoryRoot, "features");
  fs.mkdirSync(featureRoot, { recursive: true });
  fs.writeFileSync(path.join(featureRoot, "provision-capability-token.feature"), [
    "@capability:provision-capability-token",
    "@provisioned-provider:sda-bootstrap.provision-capability-token.v1",
    "Feature: Provision a capability token",
    "  Scenario: Provision one token",
    "    Given a capability feature path",
    "    When token provisioning is requested",
    "    Then an executable token is returned",
    "",
  ].join("\n"), "utf8");
  fs.writeFileSync(path.join(featureRoot, "deliver-capability-token-provisioning-cli.feature"), [
    "@capability:deliver-capability-token-provisioning-cli",
    "@provisioned-provider:sda-bootstrap.deliver-capability-token-provisioning-cli.v1",
    "Feature: Deliver the capability token provisioning CLI",
    "  Scenario: Invoke provisioning through the CLI",
    "    Given a provisioning command and feature path",
    "    When the command is invoked",
    "    Then an executable token is returned",
    "",
  ].join("\n"), "utf8");
  fs.writeFileSync(path.join(featureRoot, "quote-order.feature"), [
    "@capability:quote-order",
    "Feature: Quote an order",
    "  Scenario: Quote one order",
    "    Given an order request",
    "    When the order is quoted",
    "    Then the quote is returned",
    "",
  ].join("\n"), "utf8");
  fs.writeFileSync(path.join(featureRoot, "reveal.feature"), [
    "@capability:reveal",
    "@provisioned-provider:sda-bootstrap.reveal-semantic-model.v1",
    "Feature: Reveal declared semantic models",
    "  Scenario: Reveal one declared model",
    "    Given a source carrying an explicit semantic model",
    "    When the semantic model is revealed",
    "    Then its blueprint-derived motifs are returned",
    "",
  ].join("\n"), "utf8");
  fs.writeFileSync(path.join(repositoryRoot, "subject.ts"), [
    "/* @reveal-semantic-model/v2",
    JSON.stringify({
      schema: "reveal.semantic-model.v2",
      capability: { capabilityId: "subject", name: "Subject" },
      features: [{
        featureId: "subject-feature",
        name: "Subject feature",
        scenarios: [
          { scenarioId: "first", routes: [{ routeId: "first-to-second", targetScenarioId: "second" }] },
          { scenarioId: "second", routes: [] },
        ],
      }],
      eventExecutionProjections: [],
      mechanicCircuits: [{
        projectionId: "mechanic:test", cells: [{ cellId: "m1", input: { dataType: "raw" }, mechanic: { mechanicId: "parse" }, result: { dataType: "parsed" } }], routes: [],
      }],
      providerCircuits: [{
        projectionId: "provider:test", cells: [{ cellId: "p1", input: { dataType: "path" }, providerId: "filesystem-read", result: { dataType: "bytes" } }], routes: [],
      }],
    }),
    "*/",
    "export {};",
    "",
  ].join("\n"), "utf8");

  const run = (...args) => spawnSync(process.execPath, [managerSource, ...args], {
    cwd: repositoryRoot,
    env: process.env,
    encoding: "utf8",
  });
  const provisioner = run("provision", "features/provision-capability-token.feature");
  assert.equal(provisioner.status, 0, provisioner.stderr);
  const provisionerToken = JSON.parse(provisioner.stdout);
  assert.equal(provisionerToken.provisioningDisposition, "PROVISIONED_EXECUTABLE");
  assert.equal(provisionerToken.execution.outcome.providerDisposition, "AVAILABLE");

  const directInvocation = run(
    "invoke-provisioned",
    provisionerToken.capsulePath,
    JSON.stringify({
      requestType: "capability-token-provisioning-request.v1",
      featurePath: "features/quote-order.feature",
    }),
  );
  assert.equal(directInvocation.status, 0, directInvocation.stderr);
  const directResult = JSON.parse(directInvocation.stdout);
  assert.equal(directResult.operation, "PROVISIONED_CAPABILITY_INVOCATION");
  assert.equal(directResult.providerCapabilityId, "sda-bootstrap.provision-capability-token.v1");
  assert.equal(directResult.execution.disposition, "terminated");
  assert.equal(directResult.execution.outcome.operation, "TOKEN_PROVISIONING");
  assert.equal(directResult.execution.outcome.capabilityId, "quote-order");

  const cli = run("provision", "features/deliver-capability-token-provisioning-cli.feature");
  assert.equal(cli.status, 0, cli.stderr);
  const cliToken = JSON.parse(cli.stdout);
  assert.equal(cliToken.provisioningDisposition, "PROVISIONED_EXECUTABLE");

  const cliInvocation = run(
    "invoke-provisioned",
    cliToken.capsulePath,
    JSON.stringify({
      requestType: "capability-token-provisioning-cli-request.v1",
      command: "provision",
      featurePath: "features/quote-order.feature",
    }),
  );
  assert.equal(cliInvocation.status, 0, cliInvocation.stderr);
  const cliResult = JSON.parse(cliInvocation.stdout);
  assert.equal(cliResult.providerCapabilityId, "sda-bootstrap.deliver-capability-token-provisioning-cli.v1");
  assert.equal(cliResult.execution.disposition, "terminated");
  assert.equal(cliResult.execution.outcome.operation, "TOKEN_PROVISIONING");
  assert.equal(cliResult.execution.outcome.capabilityId, "quote-order");

  const reveal = run("provision", "features/reveal.feature");
  assert.equal(reveal.status, 0, reveal.stderr);
  const revealToken = JSON.parse(reveal.stdout);
  assert.equal(revealToken.provisioningDisposition, "PROVISIONED_EXECUTABLE");
  const revealInvocation = run(
    "invoke-provisioned",
    revealToken.capsulePath,
    JSON.stringify({
      requestType: "reveal-semantic-model-request.v1",
      sourcePath: "subject.ts",
      outputPath: "output/reveal.md",
    }),
  );
  assert.equal(revealInvocation.status, 0, revealInvocation.stderr);
  const revealed = JSON.parse(revealInvocation.stdout);
  assert.equal(revealed.execution.outcome.revelationDisposition, "REVEALED");
  assert.equal(revealed.execution.outcome.capability.capabilityId, "subject");
  assert.equal(revealed.execution.outcome.motifs[0].motifType, "ROUTED_PIPELINE");
  const documentationPath = path.join(repositoryRoot, "output", "reveal.md");
  const documentationBytes = fs.readFileSync(documentationPath);
  const documentation = documentationBytes.toString("utf8");
  assert.match(documentation, /^# Reveal: Subject/m);
  assert.match(documentation, /## Feature: Subject feature/);
  assert.match(documentation, /Identity: `first`/);
  assert.match(documentation, /ROUTED_PIPELINE/);
  assert.equal((documentation.match(/```mermaid/g) ?? []).length, 5);
  assert.match(documentation, /## Blueprint diagrams/);
  assert.match(documentation, /DATA \/ INPUT<br\/>unspecified/);
  assert.match(documentation, /Mechanic descent: mechanic:test/);
  assert.match(documentation, /MECHANIC<br\/>parse/);
  assert.match(documentation, /Provider descent: provider:test/);
  assert.match(documentation, /PROVIDER<br\/>filesystem-read/);
  assert.match(documentation, /motif_0 --> motif_1/);
  assert.equal(revealed.execution.outcome.documentationArtifact.path, "output/reveal.md");
  assert.equal(revealed.execution.outcome.documentationArtifact.digest, sha256(documentationBytes));
  assert.equal(revealed.execution.outcome.documentationDigest, sha256(documentationBytes));

  const managedTokens = [provisionerToken, cliToken].map((token) => {
    const source = path.join(repositoryRoot, token.capsulePath);
    const capsule = readJson(source);
    const file = `${token.capabilityId}.sfxcap`;
    fs.mkdirSync(path.join(repositoryRoot, "capsules"), { recursive: true });
    fs.copyFileSync(source, path.join(repositoryRoot, "capsules", file));
    return {
      capabilityId: token.capabilityId,
      file,
      capsuleDigest: token.capsuleDigest,
      capabilityAuthorityDigest: capsule.entries.find((entry) => entry.entryId === "capability.authority.json").entryDigest,
    };
  });
  writeJson(path.join(repositoryRoot, "capsules", "capsule-estate.manifest.json"), {
    estateManifestType: "sidefx-capsule-estate-manifest.v1",
    capabilityCount: managedTokens.length,
    capsules: managedTokens,
  });

  const managedProvisionerInvocation = run(
    "invoke",
    "provision-capability-token",
    JSON.stringify({
      requestType: "capability-token-provisioning-request.v1",
      featurePath: "features/quote-order.feature",
    }),
  );
  assert.equal(managedProvisionerInvocation.status, 0, managedProvisionerInvocation.stderr);
  assert.equal(JSON.parse(managedProvisionerInvocation.stdout).outcome.operation, "TOKEN_PROVISIONING");

  const managedCliInvocation = run(
    "invoke",
    "deliver-capability-token-provisioning-cli",
    JSON.stringify({
      requestType: "capability-token-provisioning-cli-request.v1",
      command: "provision",
      featurePath: "features/quote-order.feature",
    }),
  );
  assert.equal(managedCliInvocation.status, 0, managedCliInvocation.stderr);
  assert.equal(JSON.parse(managedCliInvocation.stdout).outcome.operation, "TOKEN_PROVISIONING");
});

test("rejects invalid feature authority before creating a provisioning landing zone", (context) => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-bootstrap-provision-invalid-"));
  context.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));
  const featurePath = path.join(repositoryRoot, "invalid.feature");
  fs.writeFileSync(featurePath, "Feature: Invalid without scenarios\n", "utf8");

  const result = spawnSync(process.execPath, [managerSource, "provision", featurePath], {
    cwd: repositoryRoot,
    env: process.env,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PROVISIONING_SCENARIO_REQUIRED/);
  assert.equal(fs.existsSync(path.join(repositoryRoot, "provisioning")), false);
});

test("rejects incomplete Input Event Outcome geometry before collapse", (context) => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-bootstrap-provision-geometry-"));
  context.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));
  const featurePath = path.join(repositoryRoot, "incomplete.feature");
  fs.writeFileSync(featurePath, [
    "Feature: Incomplete geometry",
    "  Scenario: Missing an outcome",
    "    Given an input",
    "    When an event occurs",
    "",
  ].join("\n"), "utf8");

  const result = spawnSync(process.execPath, [managerSource, "provision", featurePath], {
    cwd: repositoryRoot,
    env: process.env,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PROVISIONING_SCENARIO_GEOMETRY_INVALID/);
  assert.equal(fs.existsSync(path.join(repositoryRoot, "provisioning")), false);
});

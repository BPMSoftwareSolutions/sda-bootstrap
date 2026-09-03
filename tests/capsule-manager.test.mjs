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

  const second = invoke();
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(JSON.parse(second.stdout), result);
  assert.equal(fs.readdirSync(path.join(repositoryRoot, "provisioning")).length, 2);
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

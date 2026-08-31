import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const packageRoot = path.resolve(import.meta.dirname, "..");
const harnessRoot = process.env.AGENTIC_HARNESS_FIXTURE_ROOT;
const npmCli = process.env.npm_execpath;

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.error?.stack || result.stderr || result.stdout);
  return result.stdout;
}

function runNpm(args, cwd) {
  assert.ok(npmCli, "NPM_EXECUTABLE_REQUIRED");
  return run(process.execPath, [npmCli, ...args], cwd);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function inventory(root, current = root) {
  return fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) return inventory(root, absolute);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    return [`${relative}|${sha256(fs.readFileSync(absolute))}`];
  }).sort();
}

function uniqueCapsuleEntryCount(repositoryRoot) {
  const manifest = readJson(path.join(repositoryRoot, "capsules", "capsule-estate.manifest.json"));
  const bootstrap = readJson(path.join(repositoryRoot, "bootstrap", "bootstrap.manifest.json"));
  const runtimeEntryRoot = `${bootstrap.runtimeEntryRoot}/`;
  const entries = new Map();
  for (const record of manifest.capsules) {
    const capsule = readJson(path.join(repositoryRoot, "capsules", record.file));
    for (const entry of capsule.entries) {
      const reference = entry.entryRef.replaceAll("\\", "/");
      if (reference.startsWith(runtimeEntryRoot)) continue;
      const prior = entries.get(reference);
      assert.ok(!prior || prior === entry.entryDigest, `CAPSULE_ENTRY_COLLISION:${reference}`);
      entries.set(reference, entry.entryDigest);
    }
  }
  return entries.size;
}

test("the installed package deterministically expands the real capsule estate", (context) => {
  assert.ok(harnessRoot, "AGENTIC_HARNESS_FIXTURE_ROOT_REQUIRED");
  const resolvedHarnessRoot = path.resolve(harnessRoot);
  assert.ok(fs.statSync(resolvedHarnessRoot).isDirectory());

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-bootstrap-integration-"));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const packed = JSON.parse(runNpm(["pack", "--json", "--silent", "--pack-destination", temporaryRoot], packageRoot));
  const tarball = path.join(temporaryRoot, packed[0].filename);
  writeJson(path.join(temporaryRoot, "package.json"), {
    name: "sda-bootstrap-integration-consumer",
    version: "0.0.0",
    private: true,
  });
  runNpm(["install", "--save-exact", "--ignore-scripts", "--no-audit", "--no-fund", tarball], temporaryRoot);

  fs.cpSync(path.join(resolvedHarnessRoot, "capsules"), path.join(temporaryRoot, "capsules"), { recursive: true });
  fs.mkdirSync(path.join(temporaryRoot, "bootstrap"), { recursive: true });
  const manifestPath = path.join(temporaryRoot, "bootstrap", "bootstrap.manifest.json");
  fs.copyFileSync(path.join(resolvedHarnessRoot, "bootstrap", "bootstrap.manifest.json"), manifestPath);

  const managerPath = path.join(temporaryRoot, "node_modules", "sda-bootstrap", "src", "capsule-manager.mjs");
  const manifest = readJson(manifestPath);
  manifest.languageResolver.entryRef = "package:sda-bootstrap";
  manifest.languageResolver.entryDigest = sha256(fs.readFileSync(managerPath));
  manifest.platform.rootRef = "package:sda-bootstrap/platform";
  writeJson(manifestPath, manifest);

  const verification = JSON.parse(run(process.execPath, [managerPath, "verify"], temporaryRoot));
  assert.equal(verification.capabilityCount, 210);
  assert.equal(verification.entryCount, 6678);
  assert.equal(verification.durableLayout.expandedCapabilityRoot, "ABSENT");
  assert.deepEqual(JSON.parse(run(process.execPath, [managerPath, "resolve"], temporaryRoot)), {
    declaredDependencies: 69,
    present: 69,
    toolRootsDeclared: 0,
    toolRootsPresent: 0,
  });
  const expectedMaterializedEntryCount = uniqueCapsuleEntryCount(temporaryRoot);

  const firstRoot = path.join(temporaryRoot, "expanded-a");
  const secondRoot = path.join(temporaryRoot, "expanded-b");
  const first = JSON.parse(run(process.execPath, [managerPath, "expand", firstRoot], temporaryRoot));
  const second = JSON.parse(run(process.execPath, [managerPath, "expand", secondRoot], temporaryRoot));
  assert.deepEqual(first, { capabilityCount: 210, entryCount: expectedMaterializedEntryCount });
  assert.deepEqual(second, first);

  const firstInventory = inventory(firstRoot);
  const secondInventory = inventory(secondRoot);
  assert.equal(firstInventory.length, expectedMaterializedEntryCount);
  assert.deepEqual(secondInventory, firstInventory);
  assert.equal(fs.existsSync(path.join(resolvedHarnessRoot, "capabilities")), false);

  const selected = [
    "validate-semantic-carrier",
    "extract-semantic-carrier-graph",
    "audit-controlled-tooling-migration-batch",
    "author-canonical-feature",
    "read-authorized-file",
    "read-authorized-file-through-capability",
    "retrieve-sidefx-semantic-candidates",
    "shape-governed-file-system-batch",
  ].join(",");
  const direct = JSON.parse(run(process.execPath, [managerPath, "direct", selected], temporaryRoot));
  assert.deepEqual(direct, {
    eligible: 8,
    reconstructedEntryCount: expectedMaterializedEntryCount,
    fixtureCount: 33,
    tests: 41,
    passed: 41,
    failed: 0,
    skipped: 0,
    todo: 0,
    broken: 0,
  });

  const fixtures = readJson(path.join(firstRoot, "capabilities", "validate-semantic-carrier", "fixtures.authority.json"));
  const invocation = JSON.parse(run(
    process.execPath,
    [managerPath, "invoke", "validate-semantic-carrier", JSON.stringify(fixtures.fixtures[0].input)],
    temporaryRoot,
  ));
  assert.equal(invocation.disposition, "terminated");
  assert.equal(invocation.outcome.disposition, "CONFORMANT");

  context.diagnostic(JSON.stringify({
    package: `${packed[0].name}@${packed[0].version}`,
    packageIntegrity: packed[0].integrity,
    managerDigest: manifest.languageResolver.entryDigest,
    capabilityCount: first.capabilityCount,
    entryCount: first.entryCount,
    materializedFileCount: firstInventory.length,
    replay: "BYTE_IDENTICAL",
    portablePlatform: "INSTALLED_PACKAGE",
    directTests: direct.tests,
    invocationDisposition: invocation.outcome.disposition,
  }));
});

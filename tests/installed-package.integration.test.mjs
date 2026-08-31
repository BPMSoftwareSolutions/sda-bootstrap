import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL } from "node:url";

const packageRoot = path.resolve(import.meta.dirname, "..");
const harnessRoot = process.env.AGENTIC_HARNESS_FIXTURE_ROOT;
const npmCli = process.env.npm_execpath;

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
  assert.equal(result.status, 0, result.error?.stack || result.stderr || result.stdout);
  return result.stdout;
}

function runNpm(args, cwd, options = {}) {
  assert.ok(npmCli, "NPM_EXECUTABLE_REQUIRED");
  return run(process.execPath, [npmCli, ...args], cwd, options);
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
  const runtimeEntryRoot = "capsule-runtime/";
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

test("the installed package deterministically expands and delivers the real capsule estate", async (context) => {
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
    scripts: {
      mcp: "sidefx-capsules-mcp",
      verify: "sda-bootstrap verify",
    },
  });
  runNpm(["install", "--save-exact", "--ignore-scripts", "--no-audit", "--no-fund", tarball], temporaryRoot);

  fs.cpSync(path.join(resolvedHarnessRoot, "capsules"), path.join(temporaryRoot, "capsules"), { recursive: true });
  const managerPath = path.join(temporaryRoot, "node_modules", "sda-bootstrap", "src", "capsule-manager.mjs");
  assert.equal(fs.existsSync(path.join(temporaryRoot, "bootstrap")), false);

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
  assert.deepEqual(JSON.parse(runNpm(["run", "verify", "--silent"], temporaryRoot)), verification);
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

  const projectedRoot = path.join(temporaryRoot, "projected");
  const projection = JSON.parse(run(process.execPath, [managerPath, "project", projectedRoot], temporaryRoot));
  assert.equal(projection.eligible, 210);
  assert.equal(projection.projected, 210);
  assert.ok(projection.reused > 0);
  assert.equal(projection.broken, 0);

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

  const observation = JSON.parse(run(
    process.execPath,
    [managerPath, "invoke", "observe-capability-change", JSON.stringify({
      contractId: "capability-change-status-request.v1",
      payload: {
        changeId: "change-validate-semantic-carrier-0.3.1",
        reasonRef: "reason:installed-package-integration",
        rootCapabilityId: "validate-semantic-carrier",
      },
    })],
    temporaryRoot,
  ));
  assert.equal(observation.disposition, "terminated");
  assert.equal(observation.outcome.payload.state, "PUBLISHED");
  assert.equal(observation.outcome.payload.stage, "CAPSULE_ESTATE_ADMITTED");
  assert.equal(observation.outcome.payload.lifecycleDisposition, "SUCCEEDED");
  assert.deepEqual(observation.outcome.payload.findings, []);

  const mcpInput = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "installed-package-proof", version: "1.0.0" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "sidefx_capsules_list", arguments: { query: "deliver-capsule-estate-mcp" } } },
  ].map((message) => JSON.stringify(message)).join("\n") + "\n";
  const mcpOutput = runNpm(["run", "mcp", "--silent"], temporaryRoot, {
    input: mcpInput,
    env: { ...process.env, CAPSULE_SOURCE_REPOSITORY_ROOT: temporaryRoot },
  });
  const mcpMessages = mcpOutput.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(mcpMessages.find((message) => message.id === 1)?.result?.serverInfo?.name, "sidefx-capsule-estate");
  assert.equal(mcpMessages.find((message) => message.id === 2)?.result?.tools?.length, 5);
  const mcpCall = mcpMessages.find((message) => message.id === 3)?.result;
  assert.equal(mcpCall?.isError, false);
  assert.equal(mcpCall?.structuredContent?.result?.[0]?.capabilityId, "deliver-capsule-estate-mcp");
  assert.match(mcpCall?.content?.[0]?.text, /^Tool execution succeeded:/);

  const priorRepositoryRoot = process.env.CAPSULE_SOURCE_REPOSITORY_ROOT;
  const priorApiPort = process.env.SIDEFX_API_PORT;
  process.env.CAPSULE_SOURCE_REPOSITORY_ROOT = temporaryRoot;
  process.env.SIDEFX_API_PORT = "0";
  try {
    const apiPath = path.join(temporaryRoot, "node_modules", "sda-bootstrap", "src", "realization-api.mjs");
    const { startServer } = await import(`${pathToFileURL(apiPath).href}?proof=${crypto.randomUUID()}`);
    const running = await startServer();
    try {
      const response = await fetch(`http://${running.host}:${running.port}/capabilities?query=deliver-realization-api`);
      const capabilities = await response.json();
      assert.equal(response.status, 200);
      assert.equal(capabilities.length, 1);
      assert.equal(capabilities[0].capabilityId, "deliver-realization-api");
    } finally {
      await running.close();
    }
  } finally {
    if (priorRepositoryRoot === undefined) delete process.env.CAPSULE_SOURCE_REPOSITORY_ROOT;
    else process.env.CAPSULE_SOURCE_REPOSITORY_ROOT = priorRepositoryRoot;
    if (priorApiPort === undefined) delete process.env.SIDEFX_API_PORT;
    else process.env.SIDEFX_API_PORT = priorApiPort;
  }

  context.diagnostic(JSON.stringify({
    package: `${packed[0].name}@${packed[0].version}`,
    packageIntegrity: packed[0].integrity,
    managerDigest: sha256(fs.readFileSync(managerPath)),
    capabilityCount: first.capabilityCount,
    entryCount: first.entryCount,
    materializedFileCount: firstInventory.length,
    replay: "BYTE_IDENTICAL",
    portablePlatform: "INSTALLED_PACKAGE",
    directTests: direct.tests,
    invocationDisposition: invocation.outcome.disposition,
    observationDisposition: observation.outcome.payload.state,
    mcpToolCount: 5,
    httpDelivery: "LIVE_LOOPBACK",
  }));
});

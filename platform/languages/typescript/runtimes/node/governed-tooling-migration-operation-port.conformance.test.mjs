import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { projectedCliExitCode } from "./admitted-consumer-platform.mjs";
import { invokeGovernedToolingMigrationOperation } from "./node-mechanic-registry-loader.mjs";

test("projected CLI exit status follows execution and declared interface disposition", () => {
  assert.equal(projectedCliExitCode({ disposition: "terminated", outcome: { interfaceExitDisposition: "ZERO" } }), 0);
  assert.equal(projectedCliExitCode({ disposition: "terminated", outcome: { interfaceExitDisposition: "NONZERO" } }), 1);
  assert.equal(projectedCliExitCode({ disposition: "failed", outcome: null }), 1);
});

test("governed tooling migration operation invokes the admitted local provider and retains lineage", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-tooling-migration-port-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const provider = path.join(root, "provider.mjs");
  const authority = path.join(root, "authority.json");
  fs.writeFileSync(provider, "export async function executeToolingMigrationOperation(configuration, input) { return { operation: configuration.operation, authorityPath: configuration.authorityPath, input, disposition: 'INVENTORIED', interfaceExitDisposition: 'ZERO' }; }\n");
  fs.writeFileSync(authority, "{}\n");

  const outcome = await invokeGovernedToolingMigrationOperation({
    providerRef: pathToFileURL(provider).href,
    authorityRef: pathToFileURL(authority).href,
    operation: "inventory"
  }, { contractId: "request.v1" }, { rootExecutionId: "tooling-migration.conformance" }, pathToFileURL(`${root}${path.sep}`));

  assert.equal(outcome.operation, "inventory");
  assert.equal(outcome.disposition, "INVENTORIED");
  assert.deepEqual(outcome.input, { contractId: "request.v1" });
  assert.deepEqual(outcome.effectLineage, ["tooling-migration.conformance"]);
});

test("governed tooling migration operation rejects unsupported operations", async () => {
  await assert.rejects(invokeGovernedToolingMigrationOperation({
    providerRef: "provider.mjs",
    authorityRef: "authority.json",
    operation: "delete-everything"
  }, {}, { rootExecutionId: "tooling-migration.rejected" }, import.meta.url), /OPERATION_UNSUPPORTED/);
});

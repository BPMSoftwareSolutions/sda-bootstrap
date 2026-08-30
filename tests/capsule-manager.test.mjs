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
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

test("verifies an internally consistent empty capsule estate", (context) => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-bootstrap-unit-"));
  context.after(() => fs.rmSync(repositoryRoot, { recursive: true, force: true }));

  writeJson(path.join(repositoryRoot, "bootstrap", "bootstrap.manifest.json"), {
    languageResolver: {
      entryRef: "package:sda-bootstrap",
      entryDigest: sha256(fs.readFileSync(managerSource)),
    },
    capsuleEstateRef: "capsules/capsule-estate.manifest.json",
    runtimeEntryRoot: "capsule-runtime",
    ephemeralCapabilityRoot: "capabilities",
    eligibleCapabilityCount: 0,
    platform: {
      rootRef: ".",
      externalBindings: [],
    },
    repositoryBootstrapRoots: [],
  });
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
});

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const REPO_ROOT = path.resolve(__dirname, "../..");

const DIST_ROOT = path.join(REPO_ROOT, "artifacts", "tools", "dist");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

async function modules() {
  const [run, provider, obligation] = await Promise.all([
    importDist("interfaces", "language-declaration-admission", "run.js"),
    importDist("capabilities", "workspace-governance", "admit-language-declaration", "provider.js"),
    importDist("capabilities", "workspace-governance", "admit-language-declaration", "obligation.js")
  ]);
  return { ...run, ...provider, ...obligation };
}

function fact(sourceRef, value) {
  return { sourceRef, digest: `sha256:${"0".repeat(64)}`, observedAt: "2026-08-10T00:00:00.000Z", value };
}

test("every active repository language declaration is admitted by the TypeScript scenario", async () => {
  const { runLanguageDeclarationAdmission } = await modules();
  const languageRoot = path.join(REPO_ROOT, "languages");
  const activeLanguages = fs.readdirSync(languageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      language: entry.name,
      bindingPath: path.join(languageRoot, entry.name, "binding", `scenario-kernel-${entry.name}.binding.json`)
    }))
    .filter(({ bindingPath }) => fs.existsSync(bindingPath))
    .filter(({ bindingPath }) => JSON.parse(fs.readFileSync(bindingPath, "utf8")).status === "IMPLEMENTING")
    .map(({ language }) => language)
    .sort();
  for (const language of activeLanguages) {
    const result = await runLanguageDeclarationAdmission({
      repositoryRoot: REPO_ROOT,
      language,
      executionId: `language-declaration-${language}`
    });
    assert.equal(result.closure.evidence.bindingValid, true);
    assert.equal(result.closure.evidence.conformanceClaimValid, true);
    assert.deepEqual(result.closure.evidence.bindingErrors, []);
    assert.deepEqual(result.closure.evidence.conformanceClaimErrors, []);
    assert.equal(result.closure.obligationDisposition.kind, "SATISFIED");
    assert.equal(result.closure.experienceDisposition, "REALIZED");
    assert.deepEqual(result.observations.map((item) => item.stepId), [
      "admit-input",
      "resolve-event-authority",
      "execute-event-authority",
      "admit-outcome",
      "resolve-disposition"
    ]);
  }
});

test("language-declaration obligation distinguishes invalid facts from an unavailable claim", async () => {
  const { LanguageDeclarationProvider, LanguageDeclarationObligation } = await modules();
  const provider = new LanguageDeclarationProvider();
  const missing = await provider.execute({
    language: "node",
    binding: fact("binding.json", { implementationId: "node" }),
    bindingValidation: fact("binding.json#/validation", { valid: true, errors: [] }),
    manifestPath: "/workspace/languages/typescript/conformance/node.json",
    manifest: null,
    manifestValidation: null
  });
  assert.equal(new LanguageDeclarationObligation().evaluate(missing).kind, "NOT_OBSERVABLE");

  const invalid = await provider.execute({
    language: "node",
    binding: fact("binding.json", { implementationId: "node" }),
    bindingValidation: fact("binding.json#/validation", {
      valid: false,
      errors: [{ instancePath: "/status", message: "must be equal to one of the allowed values" }]
    }),
    manifestPath: "manifest.json",
    manifest: fact("manifest.json", {}),
    manifestValidation: fact("manifest.json#/validation", {
      valid: false,
      errors: [
        { instancePath: "/implementationId", message: "must be string" },
        { instancePath: "/semanticObjects", message: "must NOT have fewer than 1 items" }
      ]
    })
  });
  assert.deepEqual(invalid.conformanceClaimErrors, ["/implementationId must be string"]);
  assert.equal(new LanguageDeclarationObligation().evaluate(invalid).kind, "NOT_SATISFIED");
});

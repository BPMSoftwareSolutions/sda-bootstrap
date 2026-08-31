"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const REPO_ROOT = path.resolve(__dirname, "../..");

const DIST_ROOT = path.join(REPO_ROOT, "artifacts", "tools", "dist");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

async function modules() {
  const [run, provider, obligation] = await Promise.all([
    importDist("interfaces", "language-binding-discovery", "run.js"),
    importDist(
      "capabilities",
      "workspace-governance",
      "discover-language-bindings",
      "provider.js"
    ),
    importDist(
      "capabilities",
      "workspace-governance",
      "discover-language-bindings",
      "obligation.js"
    )
  ]);
  return { ...run, ...provider, ...obligation };
}

function byBindingPath(a, b) {
  return a.bindingPath < b.bindingPath ? -1 : a.bindingPath > b.bindingPath ? 1 : 0;
}

function fact(sourceRef, value) {
  return { sourceRef, digest: `sha256:${"0".repeat(64)}`, observedAt: "2026-08-09T00:00:00.000Z", value };
}

test("TypeScript scenario discovers every repository language binding", async () => {
  const { runLanguageBindingDiscovery } = await modules();
  const expected = fs.readdirSync(path.join(REPO_ROOT, "languages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const directory = path.join(REPO_ROOT, "languages", entry.name, "binding");
      return fs.existsSync(directory)
        ? fs.readdirSync(directory).filter((file) => file.endsWith(".binding.json")).map((file) => path.join(directory, file))
        : [];
    })
    .filter((bindingPath) => fs.existsSync(bindingPath))
    .map((bindingPath) => ({
      language: JSON.parse(fs.readFileSync(bindingPath, "utf8")).language,
      bindingPath,
      binding: JSON.parse(fs.readFileSync(bindingPath, "utf8"))
    }))
    .sort(byBindingPath);
  const result = await runLanguageBindingDiscovery({
    repositoryRoot: REPO_ROOT,
    executionId: "parity-language-binding-discovery"
  });
  const discovered = [...result.closure.evidence.discovered].sort(byBindingPath);
  assert.deepEqual(discovered, expected);
  assert.equal(result.closure.obligationDisposition.kind, "SATISFIED");
  assert.equal(result.closure.experienceDisposition, "REALIZED");
  assert.deepEqual(result.observations.map((item) => item.stepId), [
    "admit-input",
    "resolve-event-authority",
    "execute-event-authority",
    "admit-outcome",
    "resolve-disposition"
  ]);
});

test("evidence and obligation characterize empty, complete, and duplicated discovery", async () => {
  const { LanguageBindingDiscoveryProvider, LanguageBindingDiscoveryObligation } = await modules();
  const provider = new LanguageBindingDiscoveryProvider();
  const obligation = new LanguageBindingDiscoveryObligation();

  const empty = await provider.execute({
    languagesDirectory: "/workspace/languages",
    languageDirectories: fact("/workspace/languages#/directories", []),
    bindingFiles: []
  });
  assert.deepEqual(empty.discovered, []);
  assert.equal(obligation.evaluate(empty).kind, "SATISFIED");

  const bindingPath = "/workspace/languages/typescript/binding/node.binding.json";
  const complete = await provider.execute({
    languagesDirectory: "/workspace/languages",
    languageDirectories: fact("/workspace/languages#/directories", ["node"]),
    bindingFiles: [{ language: "node", fact: fact(bindingPath, { implementationId: "node" }) }]
  });
  assert.deepEqual(complete.discovered, [
    { language: "node", bindingPath, binding: { implementationId: "node" } }
  ]);
  assert.equal(obligation.evaluate(complete).kind, "SATISFIED");

  const duplicated = await provider.execute({
    languagesDirectory: "/workspace/languages",
    languageDirectories: fact("/workspace/languages#/directories", ["node"]),
    bindingFiles: [
      { language: "node", fact: fact(bindingPath, { implementationId: "node" }) },
      { language: "node", fact: fact(bindingPath, { implementationId: "node" }) }
    ]
  });
  assert.deepEqual(duplicated.duplicateBindingPaths, [bindingPath]);
  assert.equal(obligation.evaluate(duplicated).kind, "NOT_SATISFIED");
});

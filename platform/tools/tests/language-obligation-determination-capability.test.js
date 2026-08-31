"use strict";

const path = require("node:path");
const fs = require("node:fs");
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
    importDist("interfaces", "language-obligation-determination", "run.js"),
    importDist(
      "capabilities",
      "workspace-governance",
      "determine-active-language-obligations",
      "provider.js"
    ),
    importDist(
      "capabilities",
      "workspace-governance",
      "determine-active-language-obligations",
      "obligation.js"
    )
  ]);
  return { ...run, ...provider, ...obligation };
}

function byLanguage(a, b) {
  return a.language < b.language ? -1 : a.language > b.language ? 1 : 0;
}

function fact(sourceRef, value) {
  return { sourceRef, digest: `sha256:${"0".repeat(64)}`, observedAt: "2026-08-09T00:00:00.000Z", value };
}

test("TypeScript scenario classifies every repository binding from declared lifecycle intent", async () => {
  const { runLanguageObligationDetermination } = await modules();
  const expected = fs.readdirSync(path.join(REPO_ROOT, "languages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const directory = path.join(REPO_ROOT, "languages", entry.name, "binding");
      return fs.existsSync(directory)
        ? fs.readdirSync(directory).filter((file) => file.endsWith(".binding.json")).map((file) => path.join(directory, file))
        : [];
    })
    .filter((bindingPath) => fs.existsSync(bindingPath))
    .map((bindingPath) => {
      const binding = JSON.parse(fs.readFileSync(bindingPath, "utf8"));
      return { language: binding.language, bindingPath, binding, status: binding.status, isActiveObligation: binding.status !== "DECLARED" };
    })
    .sort(byLanguage);
  const result = await runLanguageObligationDetermination({
    repositoryRoot: REPO_ROOT,
    executionId: "parity-language-obligation-determination"
  });
  const obligations = [...result.closure.evidence.obligations].sort(byLanguage);
  assert.deepEqual(obligations, expected);
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

test("obligation recognizes only declared lifecycle intent and flags missing or unrecognized status", async () => {
  const { LanguageObligationDeterminationProvider, LanguageObligationDeterminationObligation } = await modules();
  const provider = new LanguageObligationDeterminationProvider();
  const obligation = new LanguageObligationDeterminationObligation();

  const recognized = await provider.execute({
    bindingFiles: [
      { language: "node", fact: fact("/languages/typescript/binding/node.binding.json", { status: "IMPLEMENTING" }) },
      { language: "go", fact: fact("/languages/go/binding/go.binding.json", { status: "DECLARED" }) }
    ]
  });
  assert.deepEqual(recognized.obligations.map((entry) => entry.isActiveObligation), [true, false]);
  assert.equal(obligation.evaluate(recognized).kind, "SATISFIED");

  const missingStatus = await provider.execute({
    bindingFiles: [
      { language: "python", fact: fact("/languages/python/binding/python.binding.json", {}) }
    ]
  });
  assert.equal(missingStatus.obligations[0].status, "UNKNOWN");
  assert.equal(obligation.evaluate(missingStatus).kind, "NOT_SATISFIED");

  const unrecognizedStatus = await provider.execute({
    bindingFiles: [
      { language: "java", fact: fact("/languages/java/binding/java.binding.json", { status: "CONFORMING" }) }
    ]
  });
  assert.equal(obligation.evaluate(unrecognizedStatus).kind, "NOT_SATISFIED");
});

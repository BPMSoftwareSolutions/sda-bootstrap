"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const MODULE_PATH = path.join(REPOSITORY_ROOT, "artifacts", "tools", "dist", "governance", "language-ecosystem-layout.js");

function createCanonicalLayout(root) {
  for (const ecosystem of ["cpp", "csharp", "go", "java", "kotlin", "python", "swift", "typescript"]) {
    fs.mkdirSync(path.join(root, "languages", ecosystem), { recursive: true });
  }
  for (const implementationRoot of [
    "languages/typescript/runtimes/node",
    "languages/typescript/runtimes/browser",
    "languages/typescript/presentation/react",
    "languages/typescript/presentation/browser-dom",
    "languages/java/presentation/javafx",
    "languages/swift/presentation/swiftui",
    "languages/kotlin/presentation/android-compose"
  ]) fs.mkdirSync(path.join(root, ...implementationRoot.split("/")), { recursive: true });
}

test("repository language roots are ecosystems and implementations live under their owners", async () => {
  const { inspectLanguageEcosystemLayout } = await import(pathToFileURL(MODULE_PATH).href);
  const evidence = inspectLanguageEcosystemLayout(REPOSITORY_ROOT);
  assert.equal(evidence.disposition, "PASS", JSON.stringify(evidence.findings));
  assert.deepEqual(evidence.languageRoots, ["cpp", "csharp", "go", "java", "kotlin", "python", "swift", "typescript"]);
});

test("framework and runtime names are rejected as language roots", async () => {
  const { inspectLanguageEcosystemLayout } = await import(pathToFileURL(MODULE_PATH).href);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-language-layout-"));
  try {
    createCanonicalLayout(root);
    fs.mkdirSync(path.join(root, "languages", "react"));
    const evidence = inspectLanguageEcosystemLayout(root);
    assert.equal(evidence.disposition, "FAIL");
    assert.deepEqual(evidence.findings, [{
      code: "NON_LANGUAGE_ROOT",
      path: "languages/react",
      owner: "languages/typescript/presentation/react"
    }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

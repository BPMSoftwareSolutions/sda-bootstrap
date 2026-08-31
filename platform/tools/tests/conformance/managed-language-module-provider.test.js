import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { invokeManagedLanguageModule } from "../../../languages/typescript/runtimes/node/managed-language-module-provider.mjs";

const sha256 = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;

test("invokes one capsule-contained digest-checked JavaScript module", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-managed-module-test-"));
  try {
    const source = "export function execute(input) { return { value: input.value + 1 }; }\n";
    fs.writeFileSync(path.join(root, "execution-authorities.authority.json"), JSON.stringify({
      authorityType: "execution-authorities.v1",
      languageModules: [{
        authorityType: "managed-language-module-authority.v1",
        moduleId: "increment",
        language: "javascript-esm",
        entry: "index.mjs",
        exports: ["execute"],
        files: [{ path: "index.mjs", source, sourceDigest: sha256(source) }],
      }],
    }));
    const result = await invokeManagedLanguageModule({
      moduleAuthorityRef: "../execution-authorities.authority.json",
      moduleId: "increment",
      exportName: "execute",
    }, { value: 41 }, pathToFileURL(path.join(root, "projected", "application-binding.node.json")).href);
    assert.deepEqual(result, { value: 42 });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects modified managed module bytes", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-managed-module-test-"));
  try {
    fs.writeFileSync(path.join(root, "execution-authorities.authority.json"), JSON.stringify({
      authorityType: "execution-authorities.v1",
      languageModules: [{
        authorityType: "managed-language-module-authority.v1",
        moduleId: "modified",
        language: "javascript-esm",
        entry: "index.mjs",
        exports: ["execute"],
        files: [{ path: "index.mjs", source: "export const execute = () => true;", sourceDigest: sha256("different") }],
      }],
    }));
    await assert.rejects(() => invokeManagedLanguageModule({
      moduleAuthorityRef: "../execution-authorities.authority.json",
      moduleId: "modified",
      exportName: "execute",
    }, {}, pathToFileURL(path.join(root, "projected", "application-binding.node.json")).href), /SOURCE_DIGEST_MISMATCH/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

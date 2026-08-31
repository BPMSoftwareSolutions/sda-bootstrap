import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { invokePlatformEffectMechanic } from "../platform/languages/typescript/runtimes/node/platform-effect-provider.mjs";
import { canonicalDigest } from "../platform/languages/typescript/runtimes/node/native-mechanic-primitives.mjs";

const sha256 = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-contained-process-"));
  const binding = path.join(root, "application-binding.node.json");
  fs.writeFileSync(binding, "{}\n");
  const runtimeDirectory = path.join(root, "runtime");
  fs.mkdirSync(runtimeDirectory);
  const containedExecutable = path.join(runtimeDirectory, path.basename(process.execPath));
  fs.copyFileSync(process.execPath, containedExecutable);
  fs.chmodSync(containedExecutable, 0o755);
  const environmentBytes = Buffer.from("portable-contained-runtime-v1\n");
  fs.writeFileSync(path.join(root, "environment.lock"), environmentBytes);
  const environmentAuthority = {
    authorityId: "contained-node-environment.v1",
    digest: sha256(environmentBytes),
    manifest: [{ relativePath: "environment.lock", digest: sha256(environmentBytes) }],
  };
  const admittedExecutables = [{
    form: "CONTAINED",
    name: `runtime/${path.basename(process.execPath)}`,
    environmentAuthority,
  }];
  const executableAuthority = {
    authorityId: "contained-node-executable-authority.v1",
    digest: canonicalDigest({ authorityId: "contained-node-executable-authority.v1", admittedExecutables }),
    admittedExecutables,
  };
  const request = (overrides = {}) => ({
    executableAuthority,
    executableForm: "CONTAINED",
    executable: admittedExecutables[0].name,
    arguments: ["-e", ""],
    workingDirectory: ".",
    timeoutMilliseconds: 2000,
    maxOutputBytes: 8192,
    effectLineage: ["contained-process.test"],
    ...overrides,
  });
  const invoke = (input) => invokePlatformEffectMechanic("execute-bounded-process", {
    bindingUrl: pathToFileURL(binding),
    input,
    configuration: {
      timeoutMaximumMilliseconds: 5000,
      outputMaximumBytes: 16384,
      executableAuthorityDigests: [input.executableAuthority.digest],
    },
    options: { testExecution: true, testArtifactRoot: root, rootExecutionId: "contained-process.test" },
  });
  return { root, request, invoke, executableAuthority, environmentAuthority };
}

async function withSubject(run) {
  const subject = setup();
  try { return await run(subject); }
  finally { fs.rmSync(subject.root, { recursive: true, force: true }); }
}

test("contained executable runs from the admitted root on Windows, Linux, and macOS", async () => {
  await withSubject(async ({ request, invoke }) => {
    const outcome = await invoke(request({ arguments: ["-e", "process.stdout.write('contained')"] }));
    assert.equal(outcome.disposition, "EXITED_ZERO");
    assert.equal(outcome.stdoutSha256, sha256(Buffer.from("contained")));
    assert.equal(outcome.acceptanceClaimed, false);
  });
});

test("contained executable rejects absolute, parent, form, shell, and environment divergence before effect", async () => {
  await withSubject(async ({ root, request, invoke, executableAuthority, environmentAuthority }) => {
    const absolute = process.execPath.replaceAll("\\", "/");
    const absoluteEntries = [{ form: "CONTAINED", name: absolute, environmentAuthority }];
    const absoluteAuthority = {
      authorityId: "absolute-authority.v1",
      digest: canonicalDigest({ authorityId: "absolute-authority.v1", admittedExecutables: absoluteEntries }),
      admittedExecutables: absoluteEntries,
    };
    assert.throws(() => invoke(request({ executableAuthority: absoluteAuthority, executable: absolute })), /CONTAINED_EXECUTABLE_NOT_ROOT_RELATIVE/);

    const parentEntries = [{ form: "CONTAINED", name: "../outside", environmentAuthority }];
    const parentAuthority = {
      authorityId: "parent-authority.v1",
      digest: canonicalDigest({ authorityId: "parent-authority.v1", admittedExecutables: parentEntries }),
      admittedExecutables: parentEntries,
    };
    assert.throws(() => invoke(request({ executableAuthority: parentAuthority, executable: "../outside" })), /CONTAINED_EXECUTABLE_ESCAPES_ROOT/);
    assert.throws(() => invoke(request({ executableForm: "SYSTEM" })), /EXECUTABLE_FORM_MISMATCH/);

    const shellName = `runtime/${process.platform === "win32" ? "cmd.exe" : "sh"}`;
    const shellEntries = [{ form: "CONTAINED", name: shellName, environmentAuthority }];
    const shellAuthority = {
      authorityId: "contained-shell-authority.v1",
      digest: canonicalDigest({ authorityId: "contained-shell-authority.v1", admittedExecutables: shellEntries }),
      admittedExecutables: shellEntries,
    };
    assert.throws(() => invoke(request({ executableAuthority: shellAuthority, executable: shellName })), /SHELL_EXECUTABLE_REFUSED/);

    fs.writeFileSync(path.join(root, "environment.lock"), "mutated\n");
    assert.throws(() => invoke(request({ executableAuthority })), /ENVIRONMENT_MANIFEST_INCOMPLETE/);
  });
});

test("contained executable never falls back to ambient PATH", async () => {
  await withSubject(async ({ root, request, invoke }) => {
    const decoyRoot = fs.mkdtempSync(path.join(root, "decoy-"));
    const previousPath = process.env.PATH;
    process.env.PATH = `${decoyRoot}${path.delimiter}${previousPath ?? ""}`;
    try {
      const outcome = await invoke(request({ arguments: ["-e", "process.stdout.write(process.execPath)"] }));
      assert.equal(outcome.disposition, "EXITED_ZERO");
      assert.notEqual(outcome.stdoutSha256, sha256(Buffer.from(path.join(decoyRoot, path.basename(process.execPath)))));
    } finally {
      process.env.PATH = previousPath;
    }
  });
});

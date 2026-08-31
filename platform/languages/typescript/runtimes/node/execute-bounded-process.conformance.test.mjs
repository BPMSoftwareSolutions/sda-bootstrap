import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { invokePlatformEffectMechanic } from "./platform-effect-provider.mjs";

const EMPTY_SHA256 = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const NODE = path.basename(process.execPath);

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-bounded-process-"));
  fs.writeFileSync(path.join(root, "application-binding.node.json"), "{}\n");
  const bindingUrl = pathToFileURL(path.join(root, "application-binding.node.json"));
  const authority = (authorityId, executables) => ({
    authorityId,
    digest: `sha256:${crypto.createHash("sha256").update(JSON.stringify({ authorityId, executables })).digest("hex")}`,
    executables
  });
  const request = (overrides = {}) => ({
    executableAuthority: authority("node-conformance-executable-authority.v1", [NODE]),
    executable: NODE,
    arguments: ["-e", ""],
    workingDirectory: ".",
    timeoutMilliseconds: 1000,
    maxOutputBytes: 1024,
    effectLineage: ["execute-bounded-process.conformance"],
    ...overrides
  });
  const invoke = (input, options = {}) => invokePlatformEffectMechanic("execute-bounded-process", {
    bindingUrl,
    input,
    configuration: {
      timeoutMaximumMilliseconds: 2000,
      outputMaximumBytes: 8192,
      executableAuthorityDigests: [input.executableAuthority.digest]
    },
    options: { ...options, rootExecutionId: "execute-bounded-process.conformance" }
  });
  return { root, request, invoke, authority };
}

async function withSubject(run) {
  const subject = setup();
  try { return await run(subject); }
  finally { fs.rmSync(subject.root, { recursive: true, force: true }); }
}

test("execute-bounded-process binds zero exit and stable empty stream digests without acceptance", async () => {
  await withSubject(async ({ request, invoke }) => {
    const first = await invoke(request());
    const second = await invoke(request());
    assert.equal(first.disposition, "EXITED_ZERO");
    assert.equal(first.stdoutSha256, EMPTY_SHA256);
    assert.equal(first.stderrSha256, EMPTY_SHA256);
    assert.equal(first.acceptanceClaimed, false);
    assert.deepEqual(first, second);
  });
});

test("execute-bounded-process binds nonzero exit testimony", async () => {
  await withSubject(async ({ request, invoke }) => {
    const outcome = await invoke(request({ arguments: ["-e", "process.exit(7)"] }));
    assert.equal(outcome.disposition, "EXITED_NONZERO");
    assert.equal(outcome.exitCode, 7);
    assert.equal(outcome.acceptanceClaimed, false);
  });
});

test("execute-bounded-process enforces timeout and cancellation with one terminal testimony", async () => {
  await withSubject(async ({ request, invoke }) => {
    const slow = ["-e", "setTimeout(()=>{},10000)"];
    const timedOut = await invoke(request({ arguments: slow, timeoutMilliseconds: 25 }));
    assert.equal(timedOut.disposition, "TIMED_OUT");
    assert.equal(timedOut.timedOut, true);
    const controller = new AbortController();
    const pending = invoke(request({ arguments: slow }), { signal: controller.signal });
    setImmediate(() => controller.abort());
    const cancelled = await pending;
    assert.equal(cancelled.disposition, "CANCELLED");
    assert.equal(cancelled.timedOut, false);
  });
});

test("execute-bounded-process attributes an unavailable runtime", async () => {
  await withSubject(async ({ request, invoke, authority }) => {
    const missing = "definitely-not-an-admitted-runtime-20260829";
    const outcome = await invoke(request({
      executableAuthority: authority("missing-runtime-authority.v1", [missing]),
      executable: missing
    }));
    assert.equal(outcome.disposition, "RUNTIME_UNAVAILABLE");
    assert.deepEqual(outcome.findings, [{ code: "RUNTIME_UNAVAILABLE" }]);
  });
});

test("execute-bounded-process rejects root escape, undeclared or shell executables, and NUL arguments before spawn", async () => {
  await withSubject(async ({ request, invoke, authority }) => {
    assert.throws(() => invoke(request({ workingDirectory: ".." })), /PROCESS_WORKING_DIRECTORY_OUTSIDE_ADMITTED_ROOT/);
    assert.throws(() => invoke(request({ executable: "not-declared" })), /EXECUTABLE_NOT_ADMITTED/);
    assert.throws(() => invoke(request({
      executableAuthority: {
        ...authority("forged-authority.v1", [NODE]),
        digest: "sha256:5555555555555555555555555555555555555555555555555555555555555555"
      }
    })), /EXECUTABLE_AUTHORITY_NOT_ADMITTED/);
    assert.throws(() => invoke(request({
      executableAuthority: authority("shell-authority.v1", ["cmd.exe"]),
      executable: "cmd.exe"
    })), /EXECUTABLE_NOT_ADMITTED/);
    assert.throws(() => invoke(request({ arguments: ["bad\0argument"] })), /PROCESS_ARGUMENTS_INVALID/);
  });
});

test("execute-bounded-process bounds stdout and stderr independently under one combined limit", async () => {
  await withSubject(async ({ request, invoke }) => {
    const stdout = await invoke(request({ arguments: ["-e", "process.stdout.write('x'.repeat(4096))"], maxOutputBytes: 32 }));
    assert.equal(stdout.disposition, "OUTPUT_LIMIT_EXCEEDED");
    assert.equal(stdout.outputLimitExceeded, true);
    assert.ok(stdout.stdoutByteLength > 32);
    const stderr = await invoke(request({ arguments: ["-e", "process.stderr.write('x'.repeat(4096))"], maxOutputBytes: 32 }));
    assert.equal(stderr.disposition, "OUTPUT_LIMIT_EXCEEDED");
    assert.ok(stderr.stderrByteLength > 32);
  });
});

test("execute-bounded-process exposes exactly eighteen governed outcome fields", async () => {
  await withSubject(async ({ request, invoke }) => {
    const outcome = await invoke(request());
    assert.equal(Object.keys(outcome).length, 18);
    assert.match(outcome.argumentDigest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(outcome.workingDirectoryRef, ".");
    assert.ok(outcome.effectLineage.includes("platform-effect-mechanics.v1#execute-bounded-process"));
  });
});

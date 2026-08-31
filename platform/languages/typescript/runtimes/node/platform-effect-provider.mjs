import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { canonicalDigest, valueAt } from "./native-mechanic-primitives.mjs";

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SHELL_EXECUTABLES = new Set([
  "cmd", "cmd.exe", "powershell", "powershell.exe", "pwsh", "pwsh.exe", "sh", "bash", "zsh", "fish"
]);

function sha256Bytes(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function processFinding(code) {
  return Object.freeze({ code });
}

function boundedPositiveInteger(value, code, maximum) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) throw new Error(code);
  return value;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function rootRelativePosixPath(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || value.includes("\\") ||
      value.startsWith("/") || /^[A-Za-z]:/u.test(value) || value.startsWith("//")) {
    throw new Error("CONTAINED_EXECUTABLE_NOT_ROOT_RELATIVE");
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(segments.includes("..") ? "CONTAINED_EXECUTABLE_ESCAPES_ROOT" : "CONTAINED_EXECUTABLE_NOT_ROOT_RELATIVE");
  }
  return segments;
}

function environmentManifestDigest(root, environmentAuthority) {
  if (!environmentAuthority || typeof environmentAuthority !== "object" || Array.isArray(environmentAuthority) ||
      typeof environmentAuthority.authorityId !== "string" || environmentAuthority.authorityId.length === 0 ||
      !SHA256_PATTERN.test(environmentAuthority.digest) || !Array.isArray(environmentAuthority.manifest) ||
      environmentAuthority.manifest.length === 0) {
    throw new Error("ENVIRONMENT_MANIFEST_INCOMPLETE");
  }
  const aggregate = crypto.createHash("sha256");
  for (const item of environmentAuthority.manifest) {
    if (!item || typeof item !== "object" || Array.isArray(item) || !SHA256_PATTERN.test(item.digest)) {
      throw new Error("ENVIRONMENT_MANIFEST_INCOMPLETE");
    }
    let segments;
    try {
      segments = rootRelativePosixPath(item.relativePath);
    } catch {
      throw new Error("ENVIRONMENT_MANIFEST_INCOMPLETE");
    }
    const lexicalPath = path.resolve(root, ...segments);
    if (!isInside(root, lexicalPath) || !fs.existsSync(lexicalPath) || !fs.statSync(lexicalPath).isFile()) {
      throw new Error("ENVIRONMENT_MANIFEST_INCOMPLETE");
    }
    const realPath = fs.realpathSync(lexicalPath);
    if (!isInside(root, realPath)) throw new Error("ENVIRONMENT_MANIFEST_INCOMPLETE");
    const bytes = fs.readFileSync(realPath);
    if (sha256Bytes(bytes) !== item.digest) throw new Error("ENVIRONMENT_MANIFEST_INCOMPLETE");
    aggregate.update(bytes);
  }
  const observed = `sha256:${aggregate.digest("hex")}`;
  if (observed !== environmentAuthority.digest) throw new Error("ENVIRONMENT_AUTHORITY_DIGEST_MISMATCH");
  return observed;
}

function admittedProcessRequest({ bindingUrl, input, configuration, options }) {
  const candidate = ["mechanic:execute-bounded-process:input.v1", "mechanic:execute-bounded-process:input.v2"].includes(input?.contractId)
    ? input.payload
    : input;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("BOUNDED_PROCESS_REQUEST_REQUIRED");
  }
  const authority = candidate.executableAuthority;
  if (!authority || typeof authority !== "object" || Array.isArray(authority) ||
      typeof authority.authorityId !== "string" || authority.authorityId.length === 0 ||
      !SHA256_PATTERN.test(authority.digest)) {
    throw new Error("EXECUTABLE_AUTHORITY_INVALID");
  }
  const v2 = Array.isArray(authority.admittedExecutables);
  const declarations = v2 ? authority.admittedExecutables : authority.executables;
  if (!Array.isArray(declarations) || declarations.length === 0 || declarations.some((item) => v2
    ? (!item || typeof item !== "object" || Array.isArray(item) || !["SYSTEM", "CONTAINED"].includes(item.form) || typeof item.name !== "string" || item.name.length === 0 || item.name.includes("\0"))
    : (typeof item !== "string" || item.length === 0 || item.includes("\0")))) {
    throw new Error("EXECUTABLE_AUTHORITY_INVALID");
  }
  const authorityDigest = canonicalDigest(v2
    ? { authorityId: authority.authorityId, admittedExecutables: declarations }
    : { authorityId: authority.authorityId, executables: declarations });
  if (authority.digest !== authorityDigest || !Array.isArray(configuration.executableAuthorityDigests) ||
      !configuration.executableAuthorityDigests.includes(authority.digest)) {
    throw new Error("EXECUTABLE_AUTHORITY_NOT_ADMITTED");
  }
  const executable = candidate.executable;
  if (typeof executable !== "string" || executable.length === 0 || executable.includes("\0")) {
    throw new Error("EXECUTABLE_NOT_ADMITTED");
  }
  const executableForm = v2 ? candidate.executableForm : "SYSTEM";
  const declaration = v2
    ? declarations.find((item) => item.name === executable)
    : declarations.includes(executable) ? { form: "SYSTEM", name: executable } : null;
  if (!declaration) throw new Error("EXECUTABLE_NOT_ADMITTED");
  if (declaration.form !== executableForm) throw new Error("EXECUTABLE_FORM_MISMATCH");
  if (SHELL_EXECUTABLES.has(path.basename(executable).toLowerCase())) {
    throw new Error(v2 ? "SHELL_EXECUTABLE_REFUSED" : "EXECUTABLE_NOT_ADMITTED");
  }
  const args = candidate.arguments;
  if (!Array.isArray(args) || args.some((argument) => typeof argument !== "string" || argument.includes("\0"))) {
    throw new Error("PROCESS_ARGUMENTS_INVALID");
  }
  const root = admittedRoot(bindingUrl, options);
  const workingDirectoryRef = candidate.workingDirectory;
  if (typeof workingDirectoryRef !== "string" || workingDirectoryRef.length === 0 || path.isAbsolute(workingDirectoryRef)) {
    throw new Error("PROCESS_WORKING_DIRECTORY_INVALID");
  }
  const unresolvedWorkingDirectory = path.resolve(root, workingDirectoryRef);
  const relative = path.relative(root, unresolvedWorkingDirectory);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) ||
      !fs.existsSync(unresolvedWorkingDirectory) || !fs.statSync(unresolvedWorkingDirectory).isDirectory()) {
    throw new Error("PROCESS_WORKING_DIRECTORY_OUTSIDE_ADMITTED_ROOT");
  }
  const workingDirectory = fs.realpathSync(unresolvedWorkingDirectory);
  const realRelative = path.relative(root, workingDirectory);
  if (realRelative === ".." || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
    throw new Error("PROCESS_WORKING_DIRECTORY_OUTSIDE_ADMITTED_ROOT");
  }
  let resolvedExecutable = executable;
  let environmentAuthorityDigest = null;
  if (executableForm === "SYSTEM") {
    if (path.basename(executable) !== executable || executable.includes("/") || executable.includes("\\")) {
      throw new Error("EXECUTABLE_PATH_INVALID");
    }
  } else if (executableForm === "CONTAINED") {
    const segments = rootRelativePosixPath(executable);
    const lexicalExecutable = path.resolve(root, ...segments);
    if (!isInside(root, lexicalExecutable)) throw new Error("CONTAINED_EXECUTABLE_ESCAPES_ROOT");
    if (fs.existsSync(lexicalExecutable)) {
      const realExecutable = fs.realpathSync(lexicalExecutable);
      if (!isInside(root, realExecutable)) throw new Error("CONTAINED_EXECUTABLE_ESCAPES_ROOT");
      resolvedExecutable = realExecutable;
    } else {
      resolvedExecutable = lexicalExecutable;
    }
    environmentAuthorityDigest = environmentManifestDigest(root, declaration.environmentAuthority);
  } else {
    throw new Error("EXECUTABLE_FORM_MISMATCH");
  }
  const timeoutMaximum = configuration.timeoutMaximumMilliseconds ?? 300000;
  const outputMaximum = configuration.outputMaximumBytes ?? 16 * 1024 * 1024;
  const timeoutMilliseconds = boundedPositiveInteger(candidate.timeoutMilliseconds, "PROCESS_TIMEOUT_INVALID", timeoutMaximum);
  const maxOutputBytes = boundedPositiveInteger(candidate.maxOutputBytes, "PROCESS_OUTPUT_BOUND_INVALID", outputMaximum);
  if (!Array.isArray(candidate.effectLineage) || candidate.effectLineage.length === 0 ||
      candidate.effectLineage.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error("PROCESS_EFFECT_LINEAGE_INVALID");
  }
  return Object.freeze({
    executable: resolvedExecutable,
    executableForm,
    executableAuthorityDigest: authorityDigest,
    environmentAuthorityDigest,
    arguments: Object.freeze([...args]),
    argumentDigest: sha256Bytes(Buffer.from(JSON.stringify(args))),
    workingDirectory,
    workingDirectoryRef: realRelative === "" ? "." : realRelative.replaceAll("\\", "/"),
    timeoutMilliseconds,
    maxOutputBytes,
    effectLineage: Object.freeze([...candidate.effectLineage])
  });
}

function processTestimony(request, observation, rootExecutionId) {
  const stdoutDigest = observation.stdoutHash.digest("hex");
  const stderrDigest = observation.stderrHash.digest("hex");
  const abnormal = observation.disposition === "EXITED_ZERO" ? [] : [processFinding(observation.disposition)];
  return Object.freeze({
    contractId: "mechanic:execute-bounded-process:outcome.v1",
    disposition: observation.disposition,
    executableAuthorityDigest: request.executableAuthorityDigest,
    argumentDigest: request.argumentDigest,
    workingDirectoryRef: request.workingDirectoryRef,
    timeoutMilliseconds: request.timeoutMilliseconds,
    maxOutputBytes: request.maxOutputBytes,
    exitCode: observation.exitCode ?? null,
    signal: observation.signal ?? null,
    stdoutSha256: `sha256:${stdoutDigest}`,
    stderrSha256: `sha256:${stderrDigest}`,
    stdoutByteLength: observation.stdoutByteLength,
    stderrByteLength: observation.stderrByteLength,
    timedOut: observation.disposition === "TIMED_OUT",
    outputLimitExceeded: observation.disposition === "OUTPUT_LIMIT_EXCEEDED",
    acceptanceClaimed: false,
    findings: abnormal,
    effectLineage: Object.freeze([
      ...request.effectLineage,
      "platform-effect-mechanics.v1#execute-bounded-process",
      rootExecutionId ?? "execute-bounded-process.execution"
    ])
  });
}

export function executeBoundedProcess({ bindingUrl, input, configuration = {}, options = {} }) {
  const request = admittedProcessRequest({ bindingUrl, input, configuration, options });
  const initialObservation = () => ({
    stdoutHash: crypto.createHash("sha256"),
    stderrHash: crypto.createHash("sha256"),
    stdoutByteLength: 0,
    stderrByteLength: 0,
    exitCode: null,
    signal: null,
    disposition: null
  });
  if (options.signal?.aborted === true) {
    const observation = initialObservation();
    observation.disposition = "CANCELLED";
    return Promise.resolve(processTestimony(request, observation, options.rootExecutionId));
  }
  return new Promise((resolve) => {
    const observation = initialObservation();
    let child;
    let settled = false;
    let selectedDisposition = null;
    let timer = null;
    const finish = (disposition, exitCode = null, signal = null) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      observation.disposition = selectedDisposition ?? disposition;
      observation.exitCode = exitCode;
      observation.signal = signal;
      resolve(processTestimony(request, observation, options.rootExecutionId));
    };
    const terminate = (disposition) => {
      if (selectedDisposition === null) selectedDisposition = disposition;
      if (child && !child.killed) child.kill();
    };
    const cancel = () => terminate("CANCELLED");
    try {
      child = spawn(request.executable, request.arguments, {
        cwd: request.workingDirectory,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch {
      finish("RUNTIME_UNAVAILABLE");
      return;
    }
    const observeChunk = (stream, chunk) => {
      if (settled) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (stream === "stdout") {
        observation.stdoutHash.update(bytes);
        observation.stdoutByteLength += bytes.length;
      } else {
        observation.stderrHash.update(bytes);
        observation.stderrByteLength += bytes.length;
      }
      if (observation.stdoutByteLength + observation.stderrByteLength > request.maxOutputBytes) {
        terminate("OUTPUT_LIMIT_EXCEEDED");
      }
    };
    child.stdout.on("data", (chunk) => observeChunk("stdout", chunk));
    child.stderr.on("data", (chunk) => observeChunk("stderr", chunk));
    child.once("error", () => finish("RUNTIME_UNAVAILABLE"));
    child.once("close", (exitCode, signal) => finish(exitCode === 0 ? "EXITED_ZERO" : "EXITED_NONZERO", exitCode, signal));
    timer = setTimeout(() => terminate("TIMED_OUT"), request.timeoutMilliseconds);
    options.signal?.addEventListener("abort", cancel, { once: true });
  });
}

function admittedRoot(bindingUrl, options) {
  const root = options.testExecution === true
    ? options.testArtifactRoot
    : path.dirname(fileURLToPath(bindingUrl));
  if (typeof root !== "string" || !path.isAbsolute(root)) throw new Error("PLATFORM_EFFECT_ROOT_INVALID");
  return fs.realpathSync(root);
}

export function readFileBytes({ bindingUrl, input, configuration, options = {} }) {
  const declaredPath = configuration.path ?? valueAt(input, configuration.pathPath ?? "location");
  if (typeof declaredPath !== "string" || declaredPath.length === 0) throw new Error("READ_FILE_BYTES_PATH_MISSING");
  const root = admittedRoot(bindingUrl, options);
  const candidate = path.isAbsolute(declaredPath) ? path.resolve(declaredPath) : path.resolve(root, declaredPath);
  const relative = path.relative(root, candidate);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("READ_FILE_BYTES_PATH_OUTSIDE_ADMITTED_ROOT");
  }
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile() || fs.lstatSync(candidate).isSymbolicLink()) {
    throw new Error("READ_FILE_BYTES_TARGET_INVALID");
  }
  const bytes = fs.readFileSync(candidate);
  const observedSha256 = `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
  const expectedSha256 = configuration.expectedSha256Path
    ? valueAt(input, configuration.expectedSha256Path)
    : undefined;
  if (configuration.outputMode === "binary-artifact-readback-observation.v2") {
    return Object.freeze({
      observationType: "binary-artifact-readback-observation.v2",
      destination: candidate,
      byteLength: bytes.length,
      sha256: observedSha256,
      expectedSha256,
      equal: observedSha256 === expectedSha256
    });
  }
  return Object.freeze({
    contractId: "mechanic:read-file-bytes:outcome.v1",
    path: candidate,
    bytesBase64: bytes.toString("base64"),
    byteLength: bytes.length,
    sha256: observedSha256
  });
}

const graphMechanics = new Map([
  ["read-file-bytes", readFileBytes],
  ["execute-bounded-process", executeBoundedProcess]
]);

export function invokePlatformEffectMechanic(mechanicId, request) {
  const provider = graphMechanics.get(mechanicId);
  if (!provider) throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: '${mechanicId}'`);
  return provider(request);
}

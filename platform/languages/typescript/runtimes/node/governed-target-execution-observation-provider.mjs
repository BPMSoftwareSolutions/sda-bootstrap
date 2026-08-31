import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { canonicalDigest } from "./native-mechanic-primitives.mjs";

function targetExecutionFinding(code, targetId, fixtureId, message) {
  return { code, targetId: targetId ?? null, fixtureId: fixtureId ?? null, message };
}

function digestDirectory(directory) {
  const entries = [];
  const visit = (relative = "") => {
    const absolute = path.join(directory, relative);
    for (const name of fs.readdirSync(absolute).sort()) {
      const next = path.join(relative, name);
      const stat = fs.lstatSync(path.join(directory, next));
      if (stat.isSymbolicLink()) entries.push({ path: next.replaceAll("\\", "/"), type: "symlink" });
      else if (stat.isDirectory()) visit(next);
      else if (stat.isFile()) entries.push({ path: next.replaceAll("\\", "/"), type: "file", sha256: canonicalDigest(fs.readFileSync(path.join(directory, next))) });
    }
  };
  visit();
  return canonicalDigest(entries);
}

function isBoundedCommandValue(value) {
  return typeof value === "string" && value.length > 0 && !/[\r\n|&;><`$]/.test(value);
}

function runsBoundedCommand(executable, args, cwd, timeoutMilliseconds) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(executable, args, { cwd, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      resolve({ disposition: "RUNTIME_UNAVAILABLE", error: String(error.message ?? error), stdout: "", stderr: "" });
      return;
    }
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMilliseconds);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ disposition: "RUNTIME_UNAVAILABLE", error: String(error.message ?? error), stdout, stderr });
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ disposition: timedOut ? "TIMED_OUT" : exitCode === 0 ? "SUCCEEDED" : "NONZERO_EXIT", exitCode, signal, stdout, stderr });
    });
  });
}

export async function observeGovernedTargetExecution(configuration, input, context, bindingUrl) {
  if (!input || input.carrierType !== "bounded-projected-target-execution-context.v1") {
    throw new Error("BOUNDED_PROJECTED_TARGET_EXECUTION_CONTEXT_REQUIRED");
  }
  let authority = configuration.executionAuthority;
  if (!authority && typeof configuration.executionAuthorityRef === "string") {
    const authorityUrl = new URL(configuration.executionAuthorityRef, bindingUrl);
    if (authorityUrl.protocol !== "file:") throw new Error("GOVERNED_TARGET_EXECUTION_AUTHORITY_MUST_BE_LOCAL");
    authority = JSON.parse(fs.readFileSync(authorityUrl, "utf8"));
  }
  if (!authority || authority.authorityType !== "governed-target-execution-observation-authority.v1" || !Array.isArray(authority.targets)) {
    throw new Error("GOVERNED_TARGET_EXECUTION_AUTHORITY_MISSING");
  }
  const projectedRoot = path.dirname(fileURLToPath(bindingUrl));
  const artifactRelativePath = authority.generatedArtifactRelativePath ?? ".";
  const artifactRoot = path.resolve(projectedRoot, artifactRelativePath);
  const safeRoot = artifactRoot === projectedRoot || artifactRoot.startsWith(`${projectedRoot}${path.sep}`);
  if (!safeRoot || !fs.existsSync(artifactRoot) || !fs.statSync(artifactRoot).isDirectory()) {
    throw new Error("GOVERNED_TARGET_EXECUTION_ARTIFACT_ROOT_UNAVAILABLE");
  }
  const requestedTargets = Array.isArray(input.targetScope) ? input.targetScope : Array.isArray(input.targets) ? input.targets : [];
  const stableTargetOrder = Array.isArray(input.stableTargetOrder) ? input.stableTargetOrder : requestedTargets;
  const declaredById = new Map(authority.targets.map((target) => [target.targetId, target]));
  const findings = [];
  const duplicateTargets = stableTargetOrder.filter((id, index) => stableTargetOrder.indexOf(id) !== index);
  for (const targetId of [...new Set([...requestedTargets, ...stableTargetOrder])]) {
    if (!declaredById.has(targetId)) findings.push(targetExecutionFinding("UNDECLARED_TARGET", targetId, null, `Target '${targetId}' is not declared by execution authority.`));
  }
  for (const targetId of duplicateTargets) findings.push(targetExecutionFinding("DUPLICATE_TARGET", targetId, null, `Target '${targetId}' appears more than once in stable target order.`));
  const beforeDigest = digestDirectory(artifactRoot);
  const targetObservations = [];
  for (const targetId of stableTargetOrder) {
    const target = declaredById.get(targetId);
    if (!target || duplicateTargets.includes(targetId)) continue;
    const executable = target.executable;
    const cwdRelativePath = target.cwdRelativePath ?? artifactRelativePath;
    const cwd = path.resolve(projectedRoot, cwdRelativePath);
    if (!isBoundedCommandValue(executable) || path.basename(executable) !== executable || ["cmd", "cmd.exe", "powershell", "powershell.exe", "pwsh", "pwsh.exe", "sh", "bash"].includes(executable.toLowerCase()) || !Array.isArray(target.args) || target.args.some((arg) => !isBoundedCommandValue(arg)) ||
      !(cwd === projectedRoot || cwd.startsWith(`${projectedRoot}${path.sep}`)) || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      findings.push(targetExecutionFinding("UNSAFE_TARGET_CONFIGURATION", targetId, null, `Target '${targetId}' has an unsafe executable, arguments, or working directory.`));
      continue;
    }
    const fixtureById = new Map((target.fixtures ?? []).map((fixture) => [fixture.fixtureId, fixture]));
    const requestedFixtures = Array.isArray(input.fixtureScope?.[targetId]) ? input.fixtureScope[targetId] : [...fixtureById.keys()];
    const fixtureOrder = Array.isArray(target.stableFixtureOrder) ? target.stableFixtureOrder : requestedFixtures;
    const fixtureObservations = [];
    for (const fixtureId of fixtureOrder) {
      const fixture = fixtureById.get(fixtureId);
      if (!fixture || !requestedFixtures.includes(fixtureId)) {
        findings.push(targetExecutionFinding("UNDECLARED_FIXTURE", targetId, fixtureId, `Fixture '${fixtureId}' is not declared for target '${targetId}'.`));
        continue;
      }
      if (!Array.isArray(fixture.args) || fixture.args.some((arg) => !isBoundedCommandValue(arg))) {
        findings.push(targetExecutionFinding("UNSAFE_FIXTURE_ARGUMENTS", targetId, fixtureId, `Fixture '${fixtureId}' declares unsafe arguments.`));
        continue;
      }
      const command = await runsBoundedCommand(executable, [...target.args, ...fixture.args], cwd, target.timeoutMilliseconds ?? authority.timeoutMilliseconds ?? 30000);
      const receipt = { fixtureId, disposition: command.disposition, exitCode: command.exitCode ?? null, signal: command.signal ?? null,
        stdoutSha256: canonicalDigest(command.stdout), stderrSha256: canonicalDigest(command.stderr) };
      fixtureObservations.push(receipt);
      if (command.disposition !== "SUCCEEDED") findings.push(targetExecutionFinding(command.disposition, targetId, fixtureId, `Fixture '${fixtureId}' did not succeed on '${targetId}'.`));
    }
    targetObservations.push({ targetId, fixtureObservations });
  }
  const afterDigest = digestDirectory(artifactRoot);
  if (beforeDigest !== afterDigest) findings.push(targetExecutionFinding("GENERATED_ARTIFACT_DRIFT", null, null, "Governed target execution changed the generated artifact manifest."));
  return {
    carrierType: "projected-target-execution-observation.v1",
    bounded: findings.length === 0,
    acceptanceClaimed: false,
    promotionClaimed: false,
    generatedArtifactUnchanged: beforeDigest === afterDigest,
    beforeGeneratedArtifactManifestDigest: beforeDigest,
    afterGeneratedArtifactManifestDigest: afterDigest,
    stableTargetOrder,
    targetObservations,
    attributableRejections: findings,
    effectLineage: [...(input.lineage ?? input.requestLineage ?? []), configuration.executionAuthorityRef ?? null, context.rootExecutionId].filter(Boolean)
  };
}

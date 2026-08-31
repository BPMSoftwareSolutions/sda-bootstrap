import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const projectorUrl = pathToFileURL(path.join(
  repositoryRoot,
  "artifacts",
  "tools",
  "dist",
  "interfaces",
  "consumer-projection",
  "project.js"
)).href;

function digest(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function requestRejection(code, context) {
  const error = new Error(code);
  error.code = code;
  error.context = context;
  return error;
}

function callerRoot(rootUrl, bindingUrl) {
  if (typeof rootUrl !== "string" || rootUrl.length === 0) throw requestRejection("CONSUMER_PROJECTION_ROOT_REQUIRED");
  const resolvedUrl = new URL(rootUrl, bindingUrl);
  if (resolvedUrl.protocol !== "file:") throw requestRejection("CONSUMER_PROJECTION_ROOT_MUST_BE_LOCAL");
  const root = path.resolve(fileURLToPath(resolvedUrl));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw requestRejection("CONSUMER_PROJECTION_ROOT_UNAVAILABLE");
  }
  if (fs.lstatSync(root).isSymbolicLink()) throw requestRejection("CONSUMER_PROJECTION_ROOT_SYMBOLIC_LINK_REJECTED");
  return root;
}

function confinedPath(root, reference, kind) {
  if (typeof reference !== "string" || reference.length === 0 || reference.includes("\0") ||
      path.posix.isAbsolute(reference) || path.win32.isAbsolute(reference)) {
    throw requestRejection(`CONSUMER_PROJECTION_${kind}_REFERENCE_REJECTED`);
  }
  const segments = reference.replaceAll("\\", "/").split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw requestRejection(`CONSUMER_PROJECTION_${kind}_REFERENCE_REJECTED`);
  }
  let cursor = root;
  for (const segment of segments) {
    cursor = path.join(cursor, segment);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
      throw requestRejection(`CONSUMER_PROJECTION_${kind}_SYMBOLIC_LINK_REJECTED`);
    }
  }
  const resolved = path.resolve(root, ...segments);
  const relative = path.relative(root, resolved);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw requestRejection(`CONSUMER_PROJECTION_${kind}_REFERENCE_REJECTED`);
  }
  return resolved;
}

function declaredCapabilityAuthority(workspaceRoot) {
  const workspacePath = path.join(workspaceRoot, "consumer-workspace.authority.json");
  if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isFile()) {
    throw requestRejection("CONSUMER_PROJECTION_WORKSPACE_AUTHORITY_UNAVAILABLE");
  }
  const workspace = JSON.parse(fs.readFileSync(workspacePath, "utf8"));
  if (!Array.isArray(workspace.capabilities) || workspace.capabilities.length !== 1 ||
      typeof workspace.capabilities[0]?.capability !== "string") {
    throw requestRejection("CONSUMER_PROJECTION_SINGLE_CAPABILITY_DECLARATION_REQUIRED");
  }
  const authorityPath = confinedPath(workspaceRoot, workspace.capabilities[0].capability, "AUTHORITY");
  if (!fs.existsSync(authorityPath) || !fs.statSync(authorityPath).isFile()) {
    throw requestRejection("CONSUMER_PROJECTION_CAPABILITY_AUTHORITY_UNAVAILABLE");
  }
  return authorityPath;
}

function validateOperations(operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    throw requestRejection("CONSUMER_PROJECTION_OPERATIONS_REQUIRED");
  }
  const ids = operations.map((operation) => operation?.projectionId);
  if (ids.some((id) => typeof id !== "string" || id.length === 0) || new Set(ids).size !== ids.length) {
    throw requestRejection("CONSUMER_PROJECTION_UNIQUE_PROJECTION_ID_REQUIRED");
  }
}

export async function invokeGovernedExternalRootConsumerProjection(_configuration, request, context, bindingUrl) {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    throw requestRejection("CONSUMER_PROJECTION_REQUEST_REQUIRED");
  }
  const root = callerRoot(request.rootUrl, bindingUrl);
  validateOperations(request.operations);
  const { projectConsumerCapability } = await import(projectorUrl);
  const observations = [];
  for (const operation of request.operations) {
    const workspaceRoot = confinedPath(root, operation.workspaceRef, "WORKSPACE");
    if (!fs.existsSync(workspaceRoot) || !fs.statSync(workspaceRoot).isDirectory()) {
      throw requestRejection("CONSUMER_PROJECTION_WORKSPACE_UNAVAILABLE", { projectionId: operation.projectionId });
    }
    const authorityPath = declaredCapabilityAuthority(workspaceRoot);
    const authorityDigest = digest(fs.readFileSync(authorityPath));
    if (authorityDigest !== operation.capabilityAuthorityDigest) {
      throw requestRejection("CONSUMER_PROJECTION_CAPABILITY_AUTHORITY_DIGEST_MISMATCH", {
        projectionId: operation.projectionId,
        expected: operation.capabilityAuthorityDigest,
        observed: authorityDigest
      });
    }
    const targets = operation.projectionTargets;
    if (targets !== undefined && (!Array.isArray(targets) || targets.length === 0 ||
        targets.some((target) => !["node", "csharp", "python"].includes(target)) ||
        new Set(targets).size !== targets.length)) {
      throw requestRejection("CONSUMER_PROJECTION_TARGET_SCOPE_REJECTED", { projectionId: operation.projectionId });
    }
    const result = await projectConsumerCapability(workspaceRoot, {
      repositoryRoot,
      ...(targets ? { projectionTargets: targets } : {}),
      executionId: `${context.rootExecutionId}.${operation.projectionId}`
    });
    observations.push({
      projectionId: operation.projectionId,
      capabilityId: result.capability.capabilityId,
      capabilityAuthorityDigest: authorityDigest,
      projectionTargets: Object.keys(result.queries).sort(),
      scenarioCount: result.scenarios.length,
      transitionCount: result.transitions.length,
      projectedEntryCount: result.plan.files.length,
      outputRef: path.relative(root, result.outDir).replaceAll("\\", "/"),
      disposition: "PROJECTED",
      findingCodes: []
    });
  }
  return {
    outcomeType: "governed-external-root-consumer-projection-observation.v1",
    disposition: "PROJECTED",
    rootUrl: pathToFileURL(root).href,
    projected: observations.length,
    failed: 0,
    observations,
    effectLineage: [...(request.effectLineage ?? []), context.rootExecutionId]
  };
}

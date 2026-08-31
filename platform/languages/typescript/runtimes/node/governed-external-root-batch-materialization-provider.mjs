import crypto from "node:crypto";
import path from "node:path";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { valueAt } from "./native-mechanic-primitives.mjs";

function requiredConfiguration(configuration) {
  if (configuration?.mode !== "execute-authorized-materialization-plan") {
    throw new Error("GOVERNED_EXTERNAL_ROOT_BATCH_MATERIALIZATION_MODE_UNSUPPORTED");
  }
  if (configuration.lineageMode !== "retain-effect-lineage") {
    throw new Error("GOVERNED_EXTERNAL_ROOT_BATCH_MATERIALIZATION_LINEAGE_MODE_UNSUPPORTED");
  }
}

function configuredValue(configuration, input, directProperty, pathProperty) {
  return configuration[directProperty] ?? valueAt(input, configuration[pathProperty]);
}

function localRoot(reference, bindingUrl) {
  if (typeof reference !== "string" || reference.length === 0) throw new Error("TARGET_ROOT_AUTHORITY_MISSING");
  const url = new URL(reference, bindingUrl);
  if (url.protocol !== "file:") throw new Error("LOCAL_FILE_AUTHORITY_REQUIRED");
  return path.resolve(fileURLToPath(url));
}

function canonicalRelativePath(declaredPath) {
  if (typeof declaredPath !== "string" || declaredPath.length === 0 || declaredPath.includes("\0")) {
    throw new Error("RELATIVE_PATH_REQUIRED");
  }
  if (path.posix.isAbsolute(declaredPath) || path.win32.isAbsolute(declaredPath)) {
    throw new Error("ABSOLUTE_PATH_REJECTED");
  }
  const segments = declaredPath.replaceAll("\\", "/").split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("PATH_TRAVERSAL_REJECTED");
  }
  return segments.join("/");
}

function beneath(root, relativePath) {
  const resolved = path.resolve(root, ...relativePath.split("/"));
  const relative = path.relative(root, resolved);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("PATH_AUTHORITY_ESCAPE_REJECTED");
  }
  return resolved;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function contentAddress(plan) {
  const core = Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "planId"));
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonicalize(core))).digest("hex")}`;
}

function digest(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function isBase64AlphabetCode(code) {
  return (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 43 ||
    code === 47;
}

function decodeCanonicalBase64(value) {
  if (typeof value !== "string" || value.length % 4 !== 0) {
    throw new Error("CANONICAL_BASE64_REQUIRED");
  }
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const contentLength = value.length - padding;
  for (let index = 0; index < contentLength; index += 1) {
    if (!isBase64AlphabetCode(value.charCodeAt(index))) throw new Error("CANONICAL_BASE64_REQUIRED");
  }
  for (let index = contentLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 61) throw new Error("CANONICAL_BASE64_REQUIRED");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error("CANONICAL_BASE64_REQUIRED");
  return bytes;
}

async function statOrAbsent(candidatePath) {
  try {
    return await lstat(candidatePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function assertNoSymbolicLinkInAbsolutePath(candidatePath) {
  const parsed = path.parse(candidatePath);
  const relative = path.relative(parsed.root, candidatePath);
  let cursor = parsed.root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    const observed = await statOrAbsent(cursor);
    if (observed === null) continue;
    if (observed.isSymbolicLink()) throw new Error("SYMBOLIC_LINK_REJECTED");
  }
}

function normalizeOperations(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan) || plan.disposition !== "AUTHORIZED" ||
      !Array.isArray(plan.operations) || !Array.isArray(plan.findings) || plan.findings.length !== 0) {
    throw new Error("AUTHORIZED_MATERIALIZATION_PLAN_REQUIRED");
  }
  if (plan.planId !== contentAddress(plan)) throw new Error("AUTHORIZED_MATERIALIZATION_PLAN_DIGEST_MISMATCH");
  if (plan.operations.length === 0) throw new Error("EMPTY_MATERIALIZATION_BATCH_REJECTED");
  const mappingIds = new Set();
  const targets = new Map();
  return plan.operations.map((operation) => {
    if (typeof operation?.mappingId !== "string" || operation.mappingId.length === 0 || mappingIds.has(operation.mappingId)) {
      throw new Error("UNIQUE_MAPPING_ID_REQUIRED");
    }
    mappingIds.add(operation.mappingId);
    if (operation.operation !== "materialize-file") throw new Error("AUTHORIZED_MATERIALIZATION_OPERATION_REQUIRED");
    if (!["must-not-exist", "allow-exact-match"].includes(operation.targetDisposition)) {
      throw new Error("TARGET_EXISTENCE_POLICY_REQUIRED");
    }
    const targetPath = canonicalRelativePath(operation.targetPath);
    const bytes = decodeCanonicalBase64(operation.contentBase64);
    const contentHash = digest(bytes);
    if (operation.contentHash !== contentHash) throw new Error("AUTHORIZED_CONTENT_HASH_DIVERGED");
    const targetKey = process.platform === "win32" ? targetPath.toLowerCase() : targetPath;
    const prior = targets.get(targetKey);
    if (!prior && [...targets.keys()].some((key) => key.startsWith(`${targetKey}/`) || targetKey.startsWith(`${key}/`))) {
      throw new Error("TARGET_PATH_SHAPE_COLLISION_REJECTED");
    }
    if (prior && prior.contentHash !== contentHash) throw new Error("DIVERGENT_TARGET_COLLISION_REJECTED");
    const effectiveTargetPath = prior?.targetPath ?? targetPath;
    const normalized = {
      mappingId: operation.mappingId,
      operation: operation.operation,
      targetPath: effectiveTargetPath,
      targetDisposition: operation.targetDisposition,
      contentHash,
      byteLength: bytes.length,
      bytes,
      duplicateOf: prior?.mappingId ?? null
    };
    if (!prior) targets.set(targetKey, normalized);
    return normalized;
  });
}

async function observeTarget(root, operation) {
  const target = beneath(root, operation.targetPath);
  await assertNoSymbolicLinkInAbsolutePath(target);
  const observed = await statOrAbsent(target);
  if (observed === null) return { target, exists: false, contentHash: null };
  if (!observed.isFile()) throw new Error("AUTHORIZED_TARGET_KIND_DIVERGED");
  const contentHash = digest(await readFile(target));
  if (operation.targetDisposition === "must-not-exist") throw new Error("AUTHORIZED_TARGET_EXISTENCE_DIVERGED");
  if (contentHash !== operation.contentHash) throw new Error("AUTHORIZED_EXISTING_TARGET_HASH_DIVERGED");
  return { target, exists: true, contentHash };
}

function effectLineage(configuration, context) {
  return [...(configuration.lineage ?? []), context.rootExecutionId].filter(Boolean);
}

function publicOperation(operation) {
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) return {};
  const allowed = [
    "mappingId", "operation", "targetPath", "contentHash", "targetDisposition",
    "targetExistedBefore", "targetHashAfter", "byteLength", "duplicateOf", "result", "failure"
  ];
  return Object.fromEntries(allowed.filter((key) => Object.hasOwn(operation, key)).map((key) => [key, structuredClone(operation[key])]));
}

function publicPlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null;
  return {
    planId: typeof plan.planId === "string" ? plan.planId : null,
    disposition: typeof plan.disposition === "string" ? plan.disposition : null,
    findings: [],
    operations: Array.isArray(plan.operations) ? plan.operations.map(publicOperation) : []
  };
}

function publicRequest(request) {
  return typeof request?.requestId === "string" ? { requestId: request.requestId } : null;
}

function rejectedOutcome(configuration, input, context, plan, targetRootRef, error) {
  return {
    contractId: "external-root-batch-materialization-effect-testimony.v1",
    outcomeVariant: "REQUEST_REJECTED",
    plan: publicPlan(plan),
    request: publicRequest(input.request),
    targetRootRef: typeof targetRootRef === "string" ? targetRootRef : null,
    effect: {
      disposition: "REQUEST_REJECTED",
      operations: [],
      failure: { mappingId: null, code: error.code ?? error.message }
    },
    acceptanceClaimed: false,
    effectLineage: effectLineage(configuration, context)
  };
}

async function executeAuthorizedPlan(configuration, input, context, bindingUrl) {
  const plan = configuredValue(configuration, input, "plan", "planPath");
  const targetRootRef = configuredValue(configuration, input, "targetRootRef", "targetRootPath");
  let targetRoot;
  let normalized;
  const firstByTarget = new Map();
  const observations = new Map();
  try {
    targetRoot = localRoot(targetRootRef, bindingUrl);
    normalized = normalizeOperations(plan);
    await assertNoSymbolicLinkInAbsolutePath(targetRoot);
    const rootObservation = await statOrAbsent(targetRoot);
    if (rootObservation && !rootObservation.isDirectory()) throw new Error("AUTHORIZED_TARGET_ROOT_KIND_DIVERGED");
    for (const operation of normalized) {
      if (operation.duplicateOf !== null) continue;
      firstByTarget.set(operation.targetPath, operation);
      observations.set(operation.targetPath, await observeTarget(targetRoot, operation));
    }
  } catch (error) {
    return rejectedOutcome(configuration, input, context, plan, targetRootRef, error);
  }

  await mkdir(targetRoot, { recursive: true });
  await assertNoSymbolicLinkInAbsolutePath(targetRoot);

  const operations = [];
  let failure = null;
  for (const operation of normalized) {
    if (failure !== null) {
      operations.push({ ...publicOperation(plan.operations[operations.length]), result: "unattempted" });
      continue;
    }
    try {
      const first = firstByTarget.get(operation.targetPath);
      const observation = observations.get(operation.targetPath);
      if (operation.duplicateOf !== null) {
        const targetHashAfter = digest(await readFile(observation.target));
        if (targetHashAfter !== operation.contentHash) throw new Error("POST_EFFECT_PROOF_FAILED");
        operations.push({
          ...publicOperation(plan.operations[operations.length]),
          targetExistedBefore: observation.exists,
          targetHashAfter,
          byteLength: operation.byteLength,
          duplicateOf: first.mappingId,
          result: "satisfied"
        });
        continue;
      }
      if (observation.exists) {
        operations.push({
          ...publicOperation(plan.operations[operations.length]),
          targetExistedBefore: true,
          targetHashAfter: observation.contentHash,
          byteLength: operation.byteLength,
          result: "satisfied"
        });
        continue;
      }
      await mkdir(path.dirname(observation.target), { recursive: true });
      await assertNoSymbolicLinkInAbsolutePath(observation.target);
      await writeFile(observation.target, operation.bytes, { flag: "wx" });
      const targetHashAfter = digest(await readFile(observation.target));
      if (targetHashAfter !== operation.contentHash) throw new Error("POST_EFFECT_PROOF_FAILED");
      operations.push({
        ...publicOperation(plan.operations[operations.length]),
        targetExistedBefore: false,
        targetHashAfter,
        byteLength: operation.byteLength,
        result: "verified"
      });
    } catch (error) {
      failure = { mappingId: operation.mappingId, code: error.code ?? error.message };
      operations.push({ ...publicOperation(plan.operations[operations.length]), result: "failed", failure: structuredClone(failure) });
    }
  }

  const outcomeVariant = failure === null ? "EFFECT_OBSERVED" : "EFFECT_FAILED";
  return {
    contractId: "external-root-batch-materialization-effect-testimony.v1",
    outcomeVariant,
    plan: publicPlan(plan),
    request: publicRequest(input.request),
    targetRootRef,
    effect: { disposition: outcomeVariant, operations, failure },
    acceptanceClaimed: false,
    effectLineage: effectLineage(configuration, context)
  };
}

export async function invokeGovernedExternalRootBatchMaterialization(configuration, input, context, bindingUrl) {
  requiredConfiguration(configuration);
  return executeAuthorizedPlan(configuration, input, context, bindingUrl);
}

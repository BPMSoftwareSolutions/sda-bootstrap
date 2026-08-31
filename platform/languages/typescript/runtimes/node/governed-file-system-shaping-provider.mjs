import crypto from "node:crypto";
import path from "node:path";
import { copyFile, lstat, mkdir, readFile, rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { valueAt } from "./native-mechanic-primitives.mjs";

function requiredConfiguration(configuration) {
  const required = ["mode", "lineageMode"];
  const missing = required.filter((property) => configuration?.[property] === undefined || configuration?.[property] === "");
  if (missing.length > 0) throw new Error(`GOVERNED_FILE_SYSTEM_SHAPING_CONFIGURATION_MISSING: '${missing.join(",")}'`);
  if (configuration.lineageMode !== "retain-effect-lineage") {
    throw new Error("GOVERNED_FILE_SYSTEM_SHAPING_LINEAGE_MODE_UNSUPPORTED");
  }
}

function configuredValue(configuration, input, directProperty, pathProperty) {
  return configuration[directProperty] ?? valueAt(input, configuration[pathProperty]);
}

function localRoot(reference, bindingUrl) {
  if (typeof reference !== "string" || reference.length === 0) throw new Error("ROOT_AUTHORITY_MISSING");
  const url = new URL(reference, bindingUrl);
  if (url.protocol !== "file:") throw new Error("LOCAL_FILE_AUTHORITY_REQUIRED");
  if (process.platform === "win32" && url.hostname === "" && !/^\/[A-Za-z]:\//u.test(url.pathname)) {
    return path.resolve(path.sep, ...decodeURIComponent(url.pathname).split("/").filter(Boolean));
  }
  return path.resolve(fileURLToPath(url));
}

function roots(configuration, input, bindingUrl) {
  const sourceRootRef = configuredValue(configuration, input, "sourceRootRef", "sourceRootPath");
  const targetRootRef = configuredValue(configuration, input, "targetRootRef", "targetRootPath");
  return {
    sourceRootRef,
    targetRootRef,
    sourceRoot: localRoot(sourceRootRef, bindingUrl),
    targetRoot: localRoot(targetRootRef, bindingUrl)
  };
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
  if (relative === "" || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error("PATH_AUTHORITY_ESCAPE_REJECTED");
  }
  return resolved;
}

function resolveMappings(shape, rootAuthority) {
  if (!shape || typeof shape !== "object" || Array.isArray(shape) || !Array.isArray(shape.mappings)) {
    throw new Error("GOVERNED_FILE_SYSTEM_SHAPE_MISSING");
  }
  const mappings = [];
  const findings = [];
  for (const mapping of shape.mappings) {
    try {
      const sourcePath = canonicalRelativePath(mapping?.source?.path);
      const targetPath = canonicalRelativePath(mapping?.target?.path);
      beneath(rootAuthority.sourceRoot, sourcePath);
      beneath(rootAuthority.targetRoot, targetPath);
      mappings.push({
        mappingId: mapping.mappingId,
        operation: mapping?.transformation?.operation,
        sourcePath,
        targetPath,
        expectedSourceHash: mapping.expectedSourceHash ?? null
      });
    } catch (error) {
      findings.push({
        mappingId: typeof mapping?.mappingId === "string" ? mapping.mappingId : "unidentified-mapping",
        rule: error.message,
        sourcePath: mapping?.source?.path ?? null,
        targetPath: mapping?.target?.path ?? null
      });
    }
  }
  return { mappings, findings };
}

async function statOrAbsent(candidatePath) {
  try {
    return await lstat(candidatePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function symbolicLinkSegment(root, relativePath) {
  let cursor = root;
  for (const segment of relativePath.split("/")) {
    cursor = path.join(cursor, segment);
    const observed = await statOrAbsent(cursor);
    if (observed === null) return false;
    if (observed.isSymbolicLink()) return true;
  }
  return false;
}

async function fileHash(candidatePath) {
  return `sha256:${crypto.createHash("sha256").update(await readFile(candidatePath)).digest("hex")}`;
}

async function observePath(root, relativePath) {
  const resolved = beneath(root, relativePath);
  const hasSymbolicLink = await symbolicLinkSegment(root, relativePath);
  const observed = await statOrAbsent(resolved);
  if (observed === null) return { exists: false, kind: "absent", hasSymbolicLink, contentHash: null };
  const kind = observed.isFile() ? "file" : observed.isDirectory() ? "directory" : observed.isSymbolicLink() ? "symbolic-link" : "other";
  return {
    exists: true,
    kind,
    hasSymbolicLink,
    contentHash: kind === "file" && !hasSymbolicLink ? await fileHash(resolved) : null
  };
}

function effectLineage(configuration, context) {
  return [...(configuration.lineage ?? []), context.rootExecutionId].filter(Boolean);
}

function withCarrier(input, contractId, outcomeVariant, payloadExtension, configuration, context) {
  return {
    ...structuredClone(input),
    contractId,
    outcomeVariant,
    payload: {
      ...structuredClone(input?.payload ?? {}),
      ...payloadExtension
    },
    acceptanceClaimed: false,
    effectLineage: effectLineage(configuration, context)
  };
}

async function resolveBoundedPaths(configuration, input, context, bindingUrl) {
  try {
    const rootAuthority = roots(configuration, input, bindingUrl);
    const shape = configuredValue(configuration, input, "shape", "shapePath");
    const resolution = resolveMappings(shape, rootAuthority);
    const outcomeVariant = resolution.findings.length === 0 ? "ADMISSIBLE" : "NON_ADMISSIBLE";
    return withCarrier(input, "bounded-file-system-mapping-paths.v1", outcomeVariant, {
      pathResolution: {
        disposition: outcomeVariant,
        mappings: resolution.mappings,
        findings: resolution.findings
      }
    }, configuration, context);
  } catch (error) {
    return withCarrier(input, "bounded-file-system-mapping-paths.v1", "NON_ADMISSIBLE", {
      pathResolution: {
        disposition: "NON_ADMISSIBLE",
        mappings: [],
        findings: [{ mappingId: "batch", rule: error.message, sourcePath: null, targetPath: null }]
      }
    }, configuration, context);
  }
}

async function observeMappings(configuration, input, context, bindingUrl) {
  try {
    const rootAuthority = roots(configuration, input, bindingUrl);
    const shape = configuredValue(configuration, input, "shape", "shapePath");
    const resolution = resolveMappings(shape, rootAuthority);
    if (resolution.findings.length > 0) throw new Error("UNBOUNDED_MAPPING_OBSERVATION_REJECTED");
    const facts = [];
    for (const mapping of resolution.mappings) {
      facts.push({
        ...mapping,
        source: await observePath(rootAuthority.sourceRoot, mapping.sourcePath),
        target: await observePath(rootAuthority.targetRoot, mapping.targetPath)
      });
    }
    return withCarrier(input, "file-system-mapping-fact-testimony.v1", "OBSERVED", {
      observation: { disposition: "OBSERVED", facts, failure: null }
    }, configuration, context);
  } catch (error) {
    return withCarrier(input, "file-system-mapping-fact-testimony.v1", "OBSERVATION_FAILED", {
      observation: { disposition: "OBSERVATION_FAILED", facts: [], failure: { code: error.code ?? error.message } }
    }, configuration, context);
  }
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

async function executeOperation(operation, rootAuthority) {
  const sourcePath = canonicalRelativePath(operation.sourcePath);
  const targetPath = canonicalRelativePath(operation.targetPath);
  const source = beneath(rootAuthority.sourceRoot, sourcePath);
  const target = beneath(rootAuthority.targetRoot, targetPath);
  if (await symbolicLinkSegment(rootAuthority.sourceRoot, sourcePath) || await symbolicLinkSegment(rootAuthority.targetRoot, targetPath)) {
    throw new Error("SYMBOLIC_LINK_REJECTED");
  }
  const sourceHashBefore = await fileHash(source);
  if (sourceHashBefore !== operation.sourceHash) throw new Error("AUTHORIZED_SOURCE_HASH_DIVERGED");
  if (operation.operation === "declare-noop") {
    const targetHashAfter = await fileHash(target);
    if (targetHashAfter !== sourceHashBefore) throw new Error("AUTHORIZED_NOOP_HASH_DIVERGED");
    return { ...operation, sourceHashBefore, targetHashAfter, sourceExistsAfter: true, result: "satisfied" };
  }
  await mkdir(path.dirname(target), { recursive: true });
  const targetObserved = await statOrAbsent(target);
  if (targetObserved?.isSymbolicLink() || (targetObserved && !targetObserved.isFile())) throw new Error("AUTHORIZED_TARGET_KIND_DIVERGED");
  if (targetObserved && operation.targetDisposition === "must-not-exist") throw new Error("AUTHORIZED_TARGET_EXISTENCE_DIVERGED");
  if (operation.operation === "copy-file") {
    await copyFile(source, target);
  } else if (operation.operation === "move-file" && operation.targetAlreadySatisfied === true) {
    const targetHashBefore = await fileHash(target);
    if (targetHashBefore !== sourceHashBefore) throw new Error("AUTHORIZED_SATISFIED_TARGET_HASH_DIVERGED");
    await rm(source);
  } else if (operation.operation === "move-file") {
    if (targetObserved) await rm(target);
    try {
      await rename(source, target);
    } catch (error) {
      if (error?.code !== "EXDEV") throw error;
      await copyFile(source, target);
      await rm(source);
    }
  } else {
    throw new Error(`AUTHORIZED_OPERATION_UNSUPPORTED: '${operation.operation}'`);
  }
  const targetHashAfter = await fileHash(target);
  const sourceExistsAfter = (await statOrAbsent(source)) !== null;
  const sourceDispositionVerified = operation.operation === "copy-file" ? sourceExistsAfter : !sourceExistsAfter;
  const result = targetHashAfter === sourceHashBefore && sourceDispositionVerified ? "verified" : "failed";
  return { ...operation, sourceHashBefore, targetHashAfter, sourceExistsAfter, result };
}

async function executeAuthorizedPlan(configuration, input, context, bindingUrl) {
  const rootAuthority = roots(configuration, input, bindingUrl);
  const plan = configuredValue(configuration, input, "plan", "planPath");
  if (!plan || typeof plan !== "object" || Array.isArray(plan) || plan.disposition !== "AUTHORIZED" || !Array.isArray(plan.operations)) {
    throw new Error("AUTHORIZED_FILE_SYSTEM_SHAPE_PLAN_REQUIRED");
  }
  if (plan.planId !== contentAddress(plan)) throw new Error("AUTHORIZED_FILE_SYSTEM_SHAPE_PLAN_DIGEST_MISMATCH");
  const operations = [];
  let failure = null;
  for (let index = 0; index < plan.operations.length; index += 1) {
    const operation = plan.operations[index];
    if (failure !== null) {
      operations.push({ ...structuredClone(operation), result: "unattempted" });
      continue;
    }
    try {
      const testimony = await executeOperation(operation, rootAuthority);
      operations.push(testimony);
      if (testimony.result === "failed") failure = { mappingId: operation.mappingId, code: "POST_EFFECT_PROOF_FAILED" };
    } catch (error) {
      failure = { mappingId: operation.mappingId, code: error.code ?? error.message };
      operations.push({ ...structuredClone(operation), result: "failed", failure: structuredClone(failure) });
    }
  }
  const outcomeVariant = failure === null ? "EFFECT_OBSERVED" : "EFFECT_FAILED";
  return {
    contractId: "file-system-shape-effect-testimony.v1",
    outcomeVariant,
    plan: structuredClone(plan),
    request: structuredClone(input.request ?? null),
    sourceRootRef: rootAuthority.sourceRootRef,
    targetRootRef: rootAuthority.targetRootRef,
    effect: { disposition: outcomeVariant, operations, failure },
    acceptanceClaimed: false,
    effectLineage: effectLineage(configuration, context)
  };
}

export async function invokeGovernedFileSystemShaping(configuration, input, context, bindingUrl) {
  requiredConfiguration(configuration);
  if (configuration.mode === "resolve-bounded-paths") return resolveBoundedPaths(configuration, input, context, bindingUrl);
  if (configuration.mode === "observe-bounded-mappings") return observeMappings(configuration, input, context, bindingUrl);
  if (configuration.mode === "execute-authorized-plan") return executeAuthorizedPlan(configuration, input, context, bindingUrl);
  throw new Error(`GOVERNED_FILE_SYSTEM_SHAPING_MODE_UNSUPPORTED: '${configuration.mode}'`);
}

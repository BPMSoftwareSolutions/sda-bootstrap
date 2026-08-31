import crypto from "node:crypto";
import path from "node:path";
import { lstat, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const markerName = ".sda-disposable-root-authority.json";

async function statOrAbsent(candidate) {
  try {
    return await lstat(candidate);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function localRoot(reference) {
  if (typeof reference !== "string" || reference.length === 0) throw new Error("DISPOSABLE_ROOT_FILE_AUTHORITY_REQUIRED");
  const url = new URL(reference);
  if (url.protocol !== "file:") throw new Error("DISPOSABLE_ROOT_FILE_AUTHORITY_REQUIRED");
  return path.resolve(fileURLToPath(url));
}

async function existingDirectory(reference, code) {
  const root = localRoot(reference);
  const observed = await statOrAbsent(root);
  if (!observed?.isDirectory()) throw new Error(code);
  if (observed.isSymbolicLink()) throw new Error("DISPOSABLE_ROOT_SYMBOLIC_LINK_REJECTED");
  return root;
}

function lineage(configuration, input, context) {
  return [...(input.requestLineage ?? []), ...(configuration.lineage ?? []), context.rootExecutionId];
}

function rejected(configuration, input, context, error) {
  return {
    contractId: "governed-disposable-root-lifecycle-testimony.v1",
    disposition: "REQUEST_REJECTED",
    rootRef: typeof input?.rootRef === "string" ? input.rootRef : null,
    marker: null,
    rootPresent: null,
    findingCodes: [error.code ?? error.message],
    effectLineage: lineage(configuration, input ?? {}, context)
  };
}

async function assertTreeHasNoSymbolicLinks(root, relative = "") {
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const next = path.join(relative, entry.name);
    const observed = await lstat(path.join(root, next));
    if (observed.isSymbolicLink()) throw new Error("DISPOSABLE_ROOT_SYMBOLIC_LINK_REJECTED");
    if (observed.isDirectory()) await assertTreeHasNoSymbolicLinks(root, next);
  }
}

async function allocate(configuration, input, context) {
  const parentRoot = await existingDirectory(input.parentRootRef, "DISPOSABLE_PARENT_ROOT_UNAVAILABLE");
  if (typeof input.prefix !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.prefix)) {
    throw new Error("DISPOSABLE_ROOT_PREFIX_REJECTED");
  }
  const root = await mkdtemp(path.join(parentRoot, `${input.prefix}-`));
  const marker = crypto.randomUUID();
  const markerDocument = {
    markerType: "governed-disposable-root-marker.v1",
    marker,
    parentRootRef: pathToFileURL(parentRoot).href,
    rootRef: pathToFileURL(root).href,
    requestId: input.requestId
  };
  await writeFile(path.join(root, markerName), JSON.stringify(markerDocument), { encoding: "utf8", flag: "wx" });
  return {
    contractId: "governed-disposable-root-lifecycle-testimony.v1",
    disposition: "ALLOCATED",
    rootRef: markerDocument.rootRef,
    marker,
    rootPresent: true,
    findingCodes: [],
    effectLineage: lineage(configuration, input, context)
  };
}

async function release(configuration, input, context) {
  const parentRoot = await existingDirectory(input.parentRootRef, "DISPOSABLE_PARENT_ROOT_UNAVAILABLE");
  const root = await existingDirectory(input.rootRef, "DISPOSABLE_ROOT_UNAVAILABLE");
  if (path.dirname(root) !== parentRoot) throw new Error("DISPOSABLE_ROOT_ESCAPES_PARENT_AUTHORITY");
  const markerPath = path.join(root, markerName);
  const markerBytes = await readFile(markerPath);
  const markerDocument = JSON.parse(markerBytes.toString("utf8"));
  if (markerDocument.markerType !== "governed-disposable-root-marker.v1" ||
      markerDocument.marker !== input.marker ||
      markerDocument.rootRef !== pathToFileURL(root).href ||
      markerDocument.parentRootRef !== pathToFileURL(parentRoot).href) {
    throw new Error("DISPOSABLE_ROOT_MARKER_DIVERGED");
  }
  await assertTreeHasNoSymbolicLinks(root);
  await rm(root, { recursive: true, force: false });
  if (await statOrAbsent(root)) throw new Error("DISPOSABLE_ROOT_POST_EFFECT_PROOF_FAILED");
  return {
    contractId: "governed-disposable-root-lifecycle-testimony.v1",
    disposition: "RELEASED",
    rootRef: pathToFileURL(root).href,
    marker: input.marker,
    rootPresent: false,
    findingCodes: [],
    effectLineage: lineage(configuration, input, context)
  };
}

export async function invokeGovernedDisposableRootLifecycle(configuration, input, context) {
  if (configuration.lineageMode !== "retain-effect-lineage") throw new Error("DISPOSABLE_ROOT_LINEAGE_MODE_UNSUPPORTED");
  try {
    if (configuration.mode === "allocate-disposable-root") return await allocate(configuration, input, context);
    if (configuration.mode === "release-disposable-root") return await release(configuration, input, context);
    throw new Error("DISPOSABLE_ROOT_LIFECYCLE_MODE_UNSUPPORTED");
  } catch (error) {
    return rejected(configuration, input, context, error);
  }
}

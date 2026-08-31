import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function finding(code, target, message) {
  return { code, target, message };
}

function localRoot(reference) {
  if (typeof reference !== "string" || reference.length === 0) throw new Error("EXTERNAL_OBSERVATION_ROOT_REQUIRED");
  const url = new URL(reference);
  if (url.protocol !== "file:") throw new Error("EXTERNAL_OBSERVATION_ROOT_MUST_BE_LOCAL");
  const root = path.resolve(fileURLToPath(url));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error("EXTERNAL_OBSERVATION_ROOT_UNAVAILABLE");
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error("EXTERNAL_OBSERVATION_ROOT_SYMBOLIC_LINK_REJECTED");
  return { root, realRoot: fs.realpathSync(root) };
}

function confinedPath(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.includes("\0") ||
      path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new Error("EXTERNAL_OBSERVATION_REFERENCE_REJECTED");
  }
  const segments = relativePath.replaceAll("\\", "/").split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("EXTERNAL_OBSERVATION_REFERENCE_REJECTED");
  }
  return { segments, normalized: segments.join("/") };
}

function observesSymbolicLink(root, segments) {
  let cursor = root;
  for (const segment of segments) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) return false;
    if (fs.lstatSync(cursor).isSymbolicLink()) return true;
  }
  return false;
}

export async function observeGovernedExternalRoot(_configuration, request, context) {
  if (!request || request.carrierType !== "bounded-governed-external-root-observation-context.v1") {
    throw new Error("BOUNDED_GOVERNED_EXTERNAL_ROOT_OBSERVATION_CONTEXT_REQUIRED");
  }
  const { root, realRoot } = localRoot(request.rootRef);
  const declaredResources = Array.isArray(request.declaredResources) ? request.declaredResources : [];
  const stableOrder = Array.isArray(request.stableIdentityOrder) ? request.stableIdentityOrder : [];
  const identities = declaredResources.map((resource) => resource?.semanticIdentity);
  const uniqueIdentities = new Set(identities);
  const declaredByIdentity = new Map(declaredResources.map((resource) => [resource.semanticIdentity, resource]));
  const attributableRejections = [];
  const observedFacts = [];

  if (identities.some((identity) => typeof identity !== "string" || identity.length === 0) ||
      uniqueIdentities.size !== identities.length) {
    attributableRejections.push(finding("DECLARED_RESOURCE_IDENTITY_REJECTED", "declaredResources", "Resource identities must be non-empty and unique."));
  }
  const stableUnique = new Set(stableOrder);
  if (stableOrder.some((identity) => typeof identity !== "string" || !declaredByIdentity.has(identity)) ||
      stableUnique.size !== stableOrder.length || stableOrder.length !== declaredResources.length ||
      identities.some((identity) => !stableUnique.has(identity))) {
    attributableRejections.push(finding("STABLE_RESOURCE_ORDER_REJECTED", "stableIdentityOrder", "Stable order must name every declared resource exactly once."));
  }
  if (attributableRejections.length) {
    return {
      carrierType: "governed-external-root-observation.v1",
      bounded: false,
      unchangedRoot: true,
      interpretationMade: false,
      bytesEncoding: "base64",
      observedFacts,
      stableOrder,
      attributableRejections,
      effectLineage: [...(request.requestLineage ?? []), context.rootExecutionId]
    };
  }

  for (const semanticIdentity of stableOrder) {
    const resource = declaredByIdentity.get(semanticIdentity);
    try {
      const expectedKind = resource.expectedKind ?? "file";
      if (!['file', 'directory'].includes(expectedKind)) throw new Error("EXTERNAL_OBSERVATION_KIND_REJECTED");
      const requested = new Set(resource.requestedFactForms ?? request.requestedFactForms ?? ["presence"]);
      if ([...requested].some((form) => !["presence", "bytes", "digest", "byteLength"].includes(form)) ||
          (expectedKind === "directory" && [...requested].some((form) => form !== "presence"))) {
        throw new Error("EXTERNAL_OBSERVATION_FACT_FORM_REJECTED");
      }
      const { segments, normalized } = confinedPath(root, resource.relativePath);
      const resolved = path.resolve(root, ...segments);
      if (observesSymbolicLink(root, segments)) throw new Error("EXTERNAL_OBSERVATION_SYMBOLIC_LINK_REJECTED");
      if (!fs.existsSync(resolved)) {
        observedFacts.push({ semanticIdentity, relativePath: normalized, expectedKind, presence: false, factForms: [...requested] });
        continue;
      }
      const observedRealPath = fs.realpathSync(resolved);
      if (observedRealPath !== realRoot && !observedRealPath.startsWith(`${realRoot}${path.sep}`)) {
        throw new Error("EXTERNAL_OBSERVATION_AUTHORITY_ESCAPE_REJECTED");
      }
      const observed = fs.statSync(resolved);
      if ((expectedKind === "file" && !observed.isFile()) || (expectedKind === "directory" && !observed.isDirectory())) {
        throw new Error("EXTERNAL_OBSERVATION_KIND_DIVERGED");
      }
      const fact = { semanticIdentity, relativePath: normalized, expectedKind, presence: true, factForms: [...requested] };
      if (expectedKind === "file") {
        const bytes = fs.readFileSync(resolved);
        const digest = `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
        if (requested.has("bytes")) fact.exactBytes = bytes.toString("base64");
        if (requested.has("digest")) fact.sha256 = digest;
        if (requested.has("byteLength")) fact.byteLength = bytes.length;
        if (resource.expectedSha256 !== undefined && resource.expectedSha256 !== digest) {
          attributableRejections.push(finding("DIGEST_MISMATCH", normalized, "Declared digest does not match observed bytes."));
        }
      }
      observedFacts.push(fact);
    } catch (error) {
      attributableRejections.push(finding(error.code ?? error.message, String(resource?.relativePath), "Declared resource could not be observed inside the caller-authorized root."));
    }
  }

  return {
    carrierType: "governed-external-root-observation.v1",
    bounded: !attributableRejections.some((item) => item.code !== "DIGEST_MISMATCH"),
    unchangedRoot: true,
    interpretationMade: false,
    bytesEncoding: "base64",
    observedFacts,
    stableOrder,
    attributableRejections,
    effectLineage: [...(request.requestLineage ?? []), context.rootExecutionId]
  };
}

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

function repositoryObservationFinding(code, target, message) {
  return { code, target, message };
}

function resolveGovernedRepositoryRoot(configuration, admittedRoot, bindingUrl) {
  const authority = configuration.observationAuthority;
  if (!authority || authority.authorityType !== "governed-repository-observation-authority.v1" || !Array.isArray(authority.roots)) {
    throw new Error("GOVERNED_REPOSITORY_OBSERVATION_AUTHORITY_MISSING");
  }
  const roots = authority.roots.filter((root) => root.rootId === admittedRoot);
  if (roots.length !== 1 || typeof roots[0].relativePath !== "string") {
    throw new Error(`GOVERNED_REPOSITORY_ROOT_NOT_ADMITTED: '${String(admittedRoot)}'`);
  }
  const projectedRoot = path.dirname(fileURLToPath(bindingUrl));
  const resolvedRoot = path.resolve(projectedRoot, roots[0].relativePath);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new Error(`GOVERNED_REPOSITORY_ROOT_UNAVAILABLE: '${String(admittedRoot)}'`);
  }
  return { rootId: admittedRoot, resolvedRoot, realRoot: fs.realpathSync(resolvedRoot) };
}

function observesSymbolicLink(root, relativePath) {
  const segments = relativePath.split(/[\\/]/).filter(Boolean);
  let cursor = root;
  for (const segment of segments) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) return false;
    if (fs.lstatSync(cursor).isSymbolicLink()) return true;
  }
  return false;
}

export function observeGovernedRepository(configuration, input, context, bindingUrl) {
  if (!input || input.carrierType !== "bounded-governed-repository-observation-context.v1") {
    throw new Error("BOUNDED_GOVERNED_REPOSITORY_OBSERVATION_CONTEXT_REQUIRED");
  }
  const { rootId, resolvedRoot, realRoot } = resolveGovernedRepositoryRoot(configuration, input.admittedRoot, bindingUrl);
  const declaredResources = Array.isArray(input.declaredResources) ? input.declaredResources : [];
  const stableOrder = Array.isArray(input.stableIdentityOrder) ? input.stableIdentityOrder : [];
  const byIdentity = new Map(declaredResources.map((resource) => [resource.semanticIdentity, resource]));
  const attributableRejections = [];
  const observedFacts = [];
  const undeclared = stableOrder.filter((semanticIdentity) => !byIdentity.has(semanticIdentity));
  const omitted = declaredResources.filter((resource) => !stableOrder.includes(resource.semanticIdentity));
  const duplicates = stableOrder.filter((semanticIdentity, index) => stableOrder.indexOf(semanticIdentity) !== index);
  for (const semanticIdentity of [...new Set([...undeclared, ...duplicates, ...omitted.map((resource) => resource.semanticIdentity)])].sort()) {
    attributableRejections.push(repositoryObservationFinding(
      "UNDECLARED_RESOURCE",
      String(semanticIdentity),
      `Stable observation order does not name declared resource '${String(semanticIdentity)}' exactly once.`
    ));
  }
  for (const semanticIdentity of stableOrder) {
    const resource = byIdentity.get(semanticIdentity);
    if (!resource) continue;
    const relativePath = resource.relativePath;
    const resolved = path.resolve(resolvedRoot, relativePath);
    if (path.isAbsolute(relativePath) || (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`))) {
      attributableRejections.push(repositoryObservationFinding(
        "OUT_OF_ROOT_TRAVERSAL",
        relativePath,
        `Declared resource '${relativePath}' escapes admitted root '${rootId}'.`
      ));
      continue;
    }
    if (observesSymbolicLink(resolvedRoot, relativePath)) {
      attributableRejections.push(repositoryObservationFinding(
        "SYMBOLIC_LINK_NOT_AUTHORIZED",
        relativePath,
        `Declared resource '${relativePath}' crosses a symbolic link.`
      ));
      continue;
    }
    const requested = new Set(resource.requestedFactForms ?? input.requestedFactForms ?? ["presence"]);
    if (!fs.existsSync(resolved)) {
      observedFacts.push({ semanticIdentity, relativePath, presence: false, factForms: [...requested] });
      continue;
    }
    const observedRealPath = fs.realpathSync(resolved);
    if (observedRealPath !== realRoot && !observedRealPath.startsWith(`${realRoot}${path.sep}`)) {
      attributableRejections.push(repositoryObservationFinding(
        "OUT_OF_ROOT_TRAVERSAL",
        relativePath,
        `Observed resource '${relativePath}' resolves outside admitted root '${rootId}'.`
      ));
      continue;
    }
    if (!fs.statSync(resolved).isFile()) {
      attributableRejections.push(repositoryObservationFinding(
        "RESOURCE_NOT_A_FILE",
        relativePath,
        `Declared resource '${relativePath}' is not a regular file.`
      ));
      continue;
    }
    const bytes = fs.readFileSync(resolved);
    const digest = `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
    const fact = { semanticIdentity, relativePath, presence: true, factForms: [...requested] };
    if (requested.has("bytes")) fact.exactBytes = bytes.toString("base64");
    if (requested.has("digest")) fact.sha256 = digest;
    if (requested.has("byteLength")) fact.byteLength = bytes.length;
    observedFacts.push(fact);
    if (typeof resource.expectedSha256 === "string" && resource.expectedSha256 !== digest) {
      attributableRejections.push(repositoryObservationFinding(
        "DIGEST_MISMATCH",
        relativePath,
        `Declared digest for '${relativePath}' does not match observed bytes.`
      ));
    }
  }
  return {
    carrierType: "governed-repository-observation.v1",
    bounded: !attributableRejections.some((finding) =>
      ["UNDECLARED_RESOURCE", "OUT_OF_ROOT_TRAVERSAL", "SYMBOLIC_LINK_NOT_AUTHORIZED"].includes(finding.code)),
    unchangedRepository: true,
    interpretationMade: false,
    bytesEncoding: "base64",
    observedFacts,
    stableOrder,
    attributableRejections,
    effectLineage: [...(input.requestLineage ?? []), input.observationAuthorityRef, rootId, context.rootExecutionId]
  };
}

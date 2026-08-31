import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function addCanonicalFeatureTag(tags, name, value) {
  const values = tags.get(name) ?? [];
  values.push(value);
  tags.set(name, values);
}

function collectCanonicalFeatureDeclarations(source) {
  const declarations = [];
  let pendingTags = new Map();
  for (const originalLine of source.split(/\r?\n/u)) {
    const trimmed = originalLine.replace(/^\uFEFF/u, "").trim();
    if (trimmed.startsWith("@")) {
      for (const match of trimmed.matchAll(/@([a-z0-9-]+):([^\s@]+)/giu)) {
        addCanonicalFeatureTag(pendingTags, match[1], match[2]);
      }
      continue;
    }
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (/^Feature\s*:/u.test(trimmed)) declarations.push({ kind: "feature", tags: pendingTags });
    else if (/^Scenario(?: Outline| Template)?\s*:/u.test(trimmed)) declarations.push({ kind: "scenario", tags: pendingTags });
    pendingTags = new Map();
  }
  return declarations;
}

function requireCanonicalFeatureTag(tags, name, context) {
  const values = tags.get(name) ?? [];
  if (values.length !== 1) {
    throw new Error(`CANONICAL_FEATURE_TAG_REQUIRED: expected exactly one @${name}: tag on ${context}; observed ${values.length}.`);
  }
  return values[0];
}

export function parseCanonicalCapabilityFeature(source, sourceRef) {
  if (typeof source !== "string" || source.trim() === "") throw new Error("CANONICAL_FEATURE_SOURCE_REQUIRED");
  const declarations = collectCanonicalFeatureDeclarations(source);
  const featureDeclarations = declarations.filter((item) => item.kind === "feature");
  if (featureDeclarations.length !== 1) {
    throw new Error(`CANONICAL_FEATURE_DECLARATION_REQUIRED: expected one Feature declaration; observed ${featureDeclarations.length}.`);
  }
  const featureTags = featureDeclarations[0].tags;
  const capabilityId = requireCanonicalFeatureTag(featureTags, "capability", "the Feature declaration");
  const rootScenarioId = requireCanonicalFeatureTag(featureTags, "root-scenario", "the Feature declaration");
  const authoringProfiles = featureTags.get("authoring-profile") ?? [];
  if (authoringProfiles.length > 1) {
    throw new Error(`CANONICAL_FEATURE_TAG_REQUIRED: expected at most one @authoring-profile: tag on the Feature declaration; observed ${authoringProfiles.length}.`);
  }
  const rootScenarios = declarations.filter((item) =>
    item.kind === "scenario" && (item.tags.get("scenario") ?? []).includes(rootScenarioId)
  );
  if (rootScenarios.length !== 1) {
    throw new Error(`CANONICAL_ROOT_SCENARIO_REQUIRED: expected one @scenario:${rootScenarioId} declaration; observed ${rootScenarios.length}.`);
  }
  const rootTags = rootScenarios[0].tags;
  return {
    featureType: "canonical-capability-feature.v1",
    sourceRef,
    source,
    ...(authoringProfiles[0] ? { authoringProfileId: authoringProfiles[0] } : {}),
    identities: {
      capabilityId,
      scenarioId: requireCanonicalFeatureTag(rootTags, "scenario", "the root Scenario declaration"),
      inputId: requireCanonicalFeatureTag(rootTags, "input", "the root Scenario declaration"),
      inputContractId: requireCanonicalFeatureTag(rootTags, "input-contract", "the root Scenario declaration"),
      eventId: requireCanonicalFeatureTag(rootTags, "event", "the root Scenario declaration"),
      eventAuthorityId: requireCanonicalFeatureTag(rootTags, "event-authority", "the root Scenario declaration"),
      outcomeId: requireCanonicalFeatureTag(rootTags, "outcome", "the root Scenario declaration"),
      outcomeContractId: requireCanonicalFeatureTag(rootTags, "outcome-contract", "the root Scenario declaration")
    }
  };
}

function isWithinGovernedRoot(candidate, governedRoot) {
  const relative = path.relative(governedRoot, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function resolveCanonicalCapabilityFeature(configuration, carrier, bindingUrl) {
  if (carrier?.carrierType !== "capability-feature-authoring-request.v1") {
    throw new Error("CANONICAL_FEATURE_AUTHORING_REQUEST_REQUIRED");
  }
  if (typeof carrier.featureReference !== "string" || carrier.featureReference.trim() === "") {
    throw new Error("FEATURE_PATH_OR_CAPABILITY_ID_REQUIRED");
  }
  if (!Array.isArray(configuration?.governedRootRefs) || configuration.governedRootRefs.length === 0) {
    throw new Error("CANONICAL_FEATURE_GOVERNED_ROOTS_REQUIRED");
  }
  const governedRoots = configuration.governedRootRefs.map((rootRef) => {
    if (typeof rootRef !== "string" || rootRef.length === 0) throw new Error("CANONICAL_FEATURE_GOVERNED_ROOT_REQUIRED");
    const rootUrl = new URL(rootRef, bindingUrl);
    if (rootUrl.protocol !== "file:") throw new Error("CANONICAL_FEATURE_LOCAL_FILE_AUTHORITY_REQUIRED");
    const root = fs.realpathSync(fileURLToPath(rootUrl));
    if (!fs.statSync(root).isDirectory()) throw new Error(`CANONICAL_FEATURE_GOVERNED_ROOT_INVALID: '${root}'.`);
    return root;
  });
  const reference = carrier.featureReference.trim();
  const candidates = governedRoots.flatMap((root) => {
    const direct = path.resolve(root, reference);
    return [
      direct,
      path.join(direct, "capability.feature"),
      path.join(root, "features", `${reference}.feature`),
      path.join(root, "capabilities", reference, "capability.feature")
    ];
  });
  const lexicalPath = [...new Set(candidates)].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!lexicalPath) throw new Error(`FEATURE_NOT_FOUND: '${reference}'.`);
  if (path.extname(lexicalPath).toLowerCase() !== ".feature") throw new Error(`FEATURE_FILE_REQUIRED: '${lexicalPath}'.`);
  const featurePath = fs.realpathSync(lexicalPath);
  if (path.resolve(lexicalPath).toLowerCase() !== path.resolve(featurePath).toLowerCase()) {
    throw new Error(`CANONICAL_FEATURE_SYMLINK_REJECTED: '${lexicalPath}'.`);
  }
  const governedRoot = governedRoots.find((root) => isWithinGovernedRoot(featurePath, root));
  if (!governedRoot) throw new Error(`CANONICAL_FEATURE_OUTSIDE_GOVERNED_ROOT: '${featurePath}'.`);
  const sourceRef = path.relative(governedRoot, featurePath).split(path.sep).join("/");
  return parseCanonicalCapabilityFeature(fs.readFileSync(featurePath, "utf8"), sourceRef);
}

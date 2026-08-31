function records(value) {
    return Array.isArray(value) ? value.filter((item) => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}
function escapePointer(value) {
    return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
function leafPaths(value, base) {
    if (Array.isArray(value))
        return value.flatMap((item) => leafPaths(item, `${base}/*`));
    if (value && typeof value === "object") {
        return Object.entries(value).flatMap(([key, item]) => leafPaths(item, `${base}/${escapePointer(key)}`));
    }
    return [base];
}
function featureValue(value, path) {
    const encoded = String(value);
    if (!/^[a-z][a-z0-9-]*$/u.test(encoded))
        throw new Error(`UNCONSUMED_UI_AUTHORITY_FIELD: '${path}' has unsupported feature value '${encoded}'.`);
    return encoded;
}
function accessibilityFeatures(add, value, base) {
    if (!value)
        return;
    if (value.name !== undefined)
        add("ui.accessibility-name.v1", [`${base}/name`]);
    if (value.description !== undefined)
        add("ui.accessibility-description.v1", [`${base}/description`]);
    if (value.live !== undefined)
        add(`ui.accessibility-live-${featureValue(value.live, `${base}/live`)}.v1`, [`${base}/live`]);
}
export function collectUiFeatureRequirements(authority) {
    if (authority.uiAuthorityType !== "consumer-ui-authority.v1")
        throw new Error("UI feature admission requires consumer-ui-authority.v1.");
    const requirements = new Map();
    const assignedPaths = new Set();
    const add = (featureId, paths) => {
        const found = requirements.get(featureId) ?? new Set();
        for (const path of paths) {
            found.add(path);
            assignedPaths.add(path);
        }
        requirements.set(featureId, found);
    };
    add("ui.application.v1", ["/uiAuthorityType", "/applicationId", "/title"]);
    add("ui.experience.v1", leafPaths(authority.experienceAuthority, "/experienceAuthority"));
    const interaction = authority.interactionAuthority;
    add("ui.view-topology.v1", [
        ...leafPaths(interaction.startViewId, "/interactionAuthority/startViewId"),
        ...leafPaths(interaction.views, "/interactionAuthority/views")
    ]);
    for (const state of records(interaction.stateBindings)) {
        const base = `/interactionAuthority/stateBindings/*`;
        add("ui.state-binding.v1", leafPaths(state, base));
        add(`ui.state-value-${featureValue(state.valueIntent, `${base}/valueIntent`)}.v1`, [`${base}/valueIntent`]);
        add(`ui.state-source-${featureValue(state.source, `${base}/source`)}.v1`, [`${base}/source`]);
    }
    for (const item of records(interaction.information)) {
        const base = "/interactionAuthority/information/*";
        add("ui.information.v1", leafPaths(item, base));
        add(`ui.information-${featureValue(item.importance, `${base}/importance`)}.v1`, [`${base}/importance`]);
        accessibilityFeatures(add, item.accessibility, `${base}/accessibility`);
    }
    for (const item of records(interaction.inputs)) {
        const base = "/interactionAuthority/inputs/*";
        add(`ui.input-${featureValue(item.inputIntent, `${base}/inputIntent`)}.v1`, leafPaths(item, base));
        if (item.commitOperationId !== undefined)
            add("ui.input-commit-operation.v1", [`${base}/commitOperationId`]);
        if (item.acceptedFileTypes !== undefined)
            add("ui.input-accepted-file-types.v1", leafPaths(item.acceptedFileTypes, `${base}/acceptedFileTypes`));
        if (item.placeholder !== undefined)
            add("ui.input-placeholder.v1", [`${base}/placeholder`]);
        accessibilityFeatures(add, item.accessibility, `${base}/accessibility`);
    }
    for (const item of records(interaction.actions)) {
        const base = "/interactionAuthority/actions/*";
        add("ui.action.v1", leafPaths(item, base));
        add(`ui.action-${featureValue(item.importance, `${base}/importance`)}.v1`, [`${base}/importance`]);
        const availability = item.availability;
        add(`ui.availability-${featureValue(availability.operator, `${base}/availability/operator`)}.v1`, leafPaths(availability, `${base}/availability`));
        accessibilityFeatures(add, item.accessibility, `${base}/accessibility`);
    }
    for (const item of records(interaction.collections)) {
        const base = "/interactionAuthority/collections/*";
        add(`ui.collection-${featureValue(item.presentationIntent ?? "tabular", `${base}/presentationIntent`)}.v1`, leafPaths(item, base));
        accessibilityFeatures(add, item.accessibility, `${base}/accessibility`);
    }
    for (const item of records(interaction.feedback)) {
        const base = "/interactionAuthority/feedback/*";
        add(`ui.feedback-${featureValue(item.feedbackIntent, `${base}/feedbackIntent`)}.v1`, leafPaths(item, base));
        const presentationPath = item.presentationIntent === undefined
            ? `${base}/presentationIntent#default=plain` : `${base}/presentationIntent`;
        add(`ui.feedback-presentation-${featureValue(item.presentationIntent ?? "plain", presentationPath)}.v1`, [presentationPath]);
        accessibilityFeatures(add, item.accessibility, `${base}/accessibility`);
    }
    for (const item of records(interaction.operations)) {
        const base = "/interactionAuthority/operations/*";
        add(`ui.operation-${featureValue(item.kind, `${base}/kind`)}.v1`, leafPaths(item, base));
    }
    for (const item of records(interaction.validation)) {
        const base = "/interactionAuthority/validation/*";
        add(`ui.validation-${featureValue(item.rule, `${base}/rule`)}.v1`, leafPaths(item, base));
    }
    if (records(interaction.navigation).length > 0)
        add("ui.navigation.v1", leafPaths(interaction.navigation, "/interactionAuthority/navigation"));
    const presentation = authority.presentationProfile;
    add("ui.presentation-profile.v1", ["/presentationProfile/profileId"]);
    add(`ui.density-${featureValue(presentation.density, "/presentationProfile/density")}.v1`, ["/presentationProfile/density"]);
    add("ui.presentation-tokens.v1", leafPaths(presentation.tokens, "/presentationProfile/tokens"));
    add("ui.presentation-intent.v1", leafPaths(presentation.intent, "/presentationProfile/intent"));
    add("ui.adaptation.v1", leafPaths(presentation.adaptation, "/presentationProfile/adaptation"));
    for (const view of records(presentation.views)) {
        const base = "/presentationProfile/views/*";
        add(`ui.presentation-view-${featureValue(view.sizeIntent, `${base}/sizeIntent`)}.v1`, leafPaths(view, base));
        add(`ui.view-layout-${featureValue(view.layoutIntent, `${base}/layoutIntent`)}.v1`, [`${base}/layoutIntent`]);
        for (const region of records(view.regions)) {
            const regionBase = `${base}/regions/*`;
            add(`ui.region-layout-${featureValue(region.layoutIntent, `${regionBase}/layoutIntent`)}.v1`, leafPaths(region, regionBase));
            if (region.role !== undefined)
                add(`ui.region-role-${featureValue(region.role, `${regionBase}/role`)}.v1`, [`${regionBase}/role`]);
            if (region.importance !== undefined)
                add(`ui.region-importance-${featureValue(region.importance, `${regionBase}/importance`)}.v1`, [`${regionBase}/importance`]);
        }
    }
    const allPaths = leafPaths(authority, "");
    const unconsumed = allPaths.filter((path) => !assignedPaths.has(path));
    if (unconsumed.length > 0)
        throw new Error(`UNCONSUMED_UI_AUTHORITY_FIELD: ${unconsumed.join(", ")}`);
    return Object.freeze([...requirements.entries()].sort(([left], [right]) => left.localeCompare(right))
        .map(([featureId, paths]) => Object.freeze({ featureId, authorityPaths: Object.freeze([...paths].sort()) })));
}
function profileFeatures(catalog, profileId, seen = new Set()) {
    if (seen.has(profileId))
        throw new Error(`UI_FEATURE_PROFILE_CYCLE: '${profileId}'.`);
    const profile = catalog.profiles.find((candidate) => candidate.profileId === profileId);
    if (!profile)
        throw new Error(`MISSING_UI_FEATURE_PROFILE: '${profileId}'.`);
    const next = new Set(seen);
    next.add(profileId);
    const inherited = profile.extends ? profileFeatures(catalog, profile.extends, next) : new Set();
    for (const featureId of profile.featureIds)
        inherited.add(featureId);
    return inherited;
}
export function resolveUiFeatureCapabilities(authority, catalog, target, capabilityId) {
    const matches = catalog.providers.filter((provider) => provider.embodimentTarget === target && (!capabilityId || provider.capabilityId === capabilityId));
    if (matches.length !== 1)
        throw new Error(`UI_FEATURE_PROVIDER_AMBIGUITY: '${target}' resolved ${matches.length} providers.`);
    const provider = matches[0];
    const supported = profileFeatures(catalog, provider.featureProfileId);
    const adapted = new Map((provider.adaptedFeatures ?? []).map((item) => [item.featureId, item]));
    const resolutions = collectUiFeatureRequirements(authority).map((requirement) => {
        const adaptation = adapted.get(requirement.featureId);
        if (supported.has(requirement.featureId))
            return Object.freeze({ ...requirement, disposition: "SUPPORTED", adaptationId: null, evidenceRefs: provider.evidenceRefs });
        if (adaptation)
            return Object.freeze({ ...requirement, disposition: "ADAPTED", adaptationId: adaptation.adaptationId, evidenceRefs: adaptation.evidenceRefs });
        return Object.freeze({ ...requirement, disposition: "NOT_SUPPORTED", adaptationId: null, evidenceRefs: Object.freeze([]) });
    });
    return Object.freeze({
        evidenceType: "sda-ui-feature-admission-evidence.v1", authorityType: "consumer-ui-authority.v1",
        capabilityId: provider.capabilityId, embodimentTarget: target, featureProfileId: provider.featureProfileId,
        requiredFeatureCount: resolutions.length, resolutions: Object.freeze(resolutions),
        disposition: resolutions.every((resolution) => resolution.disposition !== "NOT_SUPPORTED") ? "SUPPORTED" : "NOT_SUPPORTED"
    });
}

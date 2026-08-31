import path from "node:path";
import { pathToFileURL } from "node:url";
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function requiresSourceObservations(value) {
    if (Array.isArray(value))
        return value.some(requiresSourceObservations);
    if (!isRecord(value))
        return false;
    if (value.op === "path" &&
        (value.from === "root" || value.from === "input") &&
        typeof value.path === "string" &&
        (value.path === "observations" || value.path.startsWith("observations."))) {
        return true;
    }
    return Object.values(value).some(requiresSourceObservations);
}
function admittedTransformation(request) {
    const transformations = Array.isArray(request.authority.transformations)
        ? request.authority.transformations
        : [];
    const transformation = transformations.find((candidate) => isRecord(candidate) && candidate.id === request.recipeId);
    if (!isRecord(transformation)) {
        throw new Error(`SEMANTIC_READ_MODEL_RECIPE_NOT_FOUND: '${request.recipeId}'`);
    }
    if (!isRecord(transformation.expression)) {
        throw new Error(`SEMANTIC_READ_MODEL_EXPRESSION_MISSING: '${request.recipeId}'`);
    }
    return transformation;
}
export class NodeAuthorityTransformationSemanticReadModelProvider {
    repositoryRoot;
    providerId = "sda-node-authority-transformation-semantic-read-model.v1";
    authorityTypes = Object.freeze(["semantic-transformation-authority.v1"]);
    platformModule;
    sourceObservationProviders;
    constructor(repositoryRoot, sourceObservationProviders = []) {
        this.repositoryRoot = repositoryRoot;
        this.sourceObservationProviders = Object.freeze([...sourceObservationProviders].sort((left, right) => left.providerId.localeCompare(right.providerId)));
    }
    admit(request) {
        const transformation = admittedTransformation(request);
        if (requiresSourceObservations(transformation.expression) && this.sourceObservationProviders.length === 0) {
            throw new Error(`SOURCE_OBSERVATION_PROVIDER_MISSING: '${request.recipeId}' requires source observations.`);
        }
    }
    platform() {
        this.platformModule ??= import(pathToFileURL(path.join(this.repositoryRoot, "languages", "typescript", "runtimes", "node", "admitted-consumer-platform.mjs")).href);
        return this.platformModule;
    }
    async observeSources(sources) {
        const observations = {};
        const evidence = [];
        for (const [sourceRole, sourceValue] of Object.entries(sources).sort(([left], [right]) => left.localeCompare(right))) {
            const admissions = this.sourceObservationProviders.map((provider) => ({
                provider,
                admission: provider.admit(sourceValue)
            }));
            const supported = admissions.filter((candidate) => candidate.admission.disposition === "SUPPORTED");
            if (supported.length > 1) {
                throw new Error(`SOURCE_OBSERVATION_PROVIDER_AMBIGUOUS: source role '${sourceRole}' is admitted by '${supported.map((candidate) => candidate.provider.providerId).join(",")}'.`);
            }
            const selected = supported[0];
            if (selected) {
                const resolution = await selected.provider.observe({ sourceRole, sourceValue });
                if (resolution.disposition !== "OBSERVED" || !isRecord(resolution.observation) || !isRecord(resolution.evidence)) {
                    throw new Error(`SOURCE_OBSERVATION_RESOLUTION_INVALID: provider '${selected.provider.providerId}'.`);
                }
                observations[sourceRole] = resolution.observation;
                evidence.push(resolution.evidence);
                continue;
            }
            const rejected = admissions.find((candidate) => candidate.admission.disposition === "UNSUPPORTED");
            if (rejected) {
                throw new Error(`${rejected.admission.code}: source role '${sourceRole}' ${rejected.admission.reason}`);
            }
        }
        return Object.freeze({
            observations: Object.freeze(observations),
            evidence: Object.freeze(evidence)
        });
    }
    async resolve(request) {
        const transformation = admittedTransformation(request);
        const observedSources = await this.observeSources(request.sources);
        const sourceEnvelope = Object.freeze({
            sources: structuredClone(request.sources),
            observations: observedSources.observations
        });
        const platform = await this.platform();
        const evaluated = platform.platformMechanics.evaluateTransformation(transformation.expression, Object.freeze({ input: sourceEnvelope, root: sourceEnvelope }));
        if (!isRecord(evaluated)) {
            throw new Error(`SEMANTIC_READ_MODEL_OUTPUTS_INVALID: '${request.recipeId}'`);
        }
        return Object.freeze({
            disposition: "ADMITTED",
            outputs: Object.freeze(structuredClone(evaluated)),
            evidence: Object.freeze({
                evidenceType: "consumer-semantic-read-model-resolution-evidence.v1",
                providerId: this.providerId,
                authorityType: request.authority.authorityType,
                authorityDigest: request.authorityDigest,
                transformationId: request.recipeId,
                outputRoles: Object.freeze(Object.keys(evaluated).sort()),
                sourceObservations: observedSources.evidence
            })
        });
    }
}

import fs from "node:fs";
import path from "node:path";
import { canonicalDigest } from "../proof/canonical-ui-authority.js";
export class ConsumerSemanticReadModelError extends Error {
    code;
    constructor(code, message) {
        super(`${code}: ${message}`);
        this.code = code;
        this.name = "ConsumerSemanticReadModelError";
    }
}
function requiredText(value, field) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_REQUEST_INVALID", `${field} is required.`);
    }
    return value.trim();
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function roleBoundSources(bindings, sourceStates) {
    if (!Array.isArray(bindings)) {
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_REQUEST_INVALID", "sourceBindings must be an array.");
    }
    const sources = {};
    for (const binding of bindings) {
        if (!isRecord(binding)) {
            throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_REQUEST_INVALID", "every source binding must be an object.");
        }
        const role = requiredText(binding.role, "source binding role");
        const stateId = requiredText(binding.stateId, `state ID for source role '${role}'`);
        if (Object.prototype.hasOwnProperty.call(sources, role)) {
            throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_SOURCE_DUPLICATE", `source role '${role}' is bound more than once.`);
        }
        if (!Object.prototype.hasOwnProperty.call(sourceStates, stateId)) {
            throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_SOURCE_MISSING", `source state '${stateId}' bound to role '${role}' is missing.`);
        }
        sources[role] = sourceStates[stateId];
    }
    return Object.freeze(sources);
}
function authorityInsideWorkspace(workspaceRoot, authorityRef) {
    const root = fs.realpathSync.native(path.resolve(workspaceRoot));
    const requestedPath = path.resolve(root, authorityRef);
    const requestedRelative = path.relative(root, requestedPath);
    if (requestedRelative === ".." || requestedRelative.startsWith(`..${path.sep}`) || path.isAbsolute(requestedRelative)) {
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_AUTHORITY_OUTSIDE_WORKSPACE", "semantic read-model authority must remain inside the consumer workspace.");
    }
    if (!fs.existsSync(requestedPath)) {
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_AUTHORITY_MISSING", `semantic read-model authority '${authorityRef}' does not exist.`);
    }
    const authorityPath = fs.realpathSync.native(requestedPath);
    const observedRelative = path.relative(root, authorityPath);
    if (observedRelative === ".." || observedRelative.startsWith(`..${path.sep}`) || path.isAbsolute(observedRelative)) {
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_AUTHORITY_OUTSIDE_WORKSPACE", "semantic read-model authority must remain inside the consumer workspace after resolving links.");
    }
    return authorityPath;
}
function admitResolutionOperation(workspaceRoot, operation, provider) {
    const authorityRef = requiredText(operation.authorityRef, "authorityRef");
    const expectedDigest = requiredText(operation.authorityDigest, "authorityDigest");
    if (!/^sha256:[a-f0-9]{64}$/.test(expectedDigest)) {
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_REQUEST_INVALID", "authorityDigest must be a lowercase SHA-256 digest.");
    }
    const recipeId = requiredText(operation.recipeId, "recipeId");
    const authorityPath = authorityInsideWorkspace(workspaceRoot, authorityRef);
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
    }
    catch (error) {
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_AUTHORITY_INVALID", `semantic read-model authority '${authorityRef}' is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isRecord(parsed)) {
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_AUTHORITY_INVALID", `semantic read-model authority '${authorityRef}' must be a JSON object.`);
    }
    const observedDigest = canonicalDigest(parsed);
    if (observedDigest !== expectedDigest) {
        throw new ConsumerSemanticReadModelError("INPUT_RESOLUTION_AUTHORITY_DIGEST_DIVERGENCE", `expected '${expectedDigest}' observed '${observedDigest}'.`);
    }
    if (!provider) {
        throw new ConsumerSemanticReadModelError("MISSING_CONSUMER_SEMANTIC_READ_MODEL_PROVIDER", "input interpretation must be supplied by an admitted consumer-owned provider.");
    }
    const providerId = requiredText(provider.providerId, "provider.providerId");
    const authorityType = requiredText(parsed.authorityType, "authority.authorityType");
    if (!Array.isArray(provider.authorityTypes) || !provider.authorityTypes.includes(authorityType)) {
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_AUTHORITY_NOT_SUPPORTED", `provider '${providerId}' does not admit authority type '${authorityType}'.`);
    }
    try {
        provider.admit({
            workspaceRoot: fs.realpathSync.native(path.resolve(workspaceRoot)),
            authorityRef,
            authorityDigest: observedDigest,
            authority: parsed,
            recipeId
        });
    }
    catch (error) {
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_PROVIDER_REJECTED", `provider '${providerId}' rejected recipe '${recipeId}': ${error instanceof Error ? error.message : String(error)}`);
    }
    return Object.freeze({
        authorityRef,
        authorityDigest: observedDigest,
        authority: parsed,
        recipeId
    });
}
export function assertConsumerInputResolutionOperationSupported(workspaceRoot, operation, provider) {
    admitResolutionOperation(workspaceRoot, operation, provider);
}
export async function resolveConsumerInput(workspaceRoot, operation, sourceStates, provider) {
    const admitted = admitResolutionOperation(workspaceRoot, operation, provider);
    const admittedProvider = provider;
    let resolution;
    try {
        resolution = await admittedProvider.resolve({
            workspaceRoot: fs.realpathSync.native(path.resolve(workspaceRoot)),
            authorityRef: admitted.authorityRef,
            authorityDigest: admitted.authorityDigest,
            authority: admitted.authority,
            recipeId: admitted.recipeId,
            sources: roleBoundSources(operation.sourceBindings, sourceStates)
        });
    }
    catch (error) {
        if (error instanceof ConsumerSemanticReadModelError)
            throw error;
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_PROVIDER_REJECTED", `provider '${admittedProvider.providerId}' rejected recipe '${admitted.recipeId}': ${error instanceof Error ? error.message : String(error)}`);
    }
    if (resolution.disposition !== "ADMITTED" || !resolution.outputs || typeof resolution.outputs !== "object" || Array.isArray(resolution.outputs)) {
        throw new ConsumerSemanticReadModelError("CONSUMER_SEMANTIC_READ_MODEL_RESOLUTION_INVALID", `provider '${admittedProvider.providerId}' returned an invalid resolution.`);
    }
    return {
        disposition: resolution.disposition,
        recipeId: admitted.recipeId,
        authorityDigest: admitted.authorityDigest,
        providerId: admittedProvider.providerId,
        outputs: resolution.outputs,
        ...(resolution.evidence ? { evidence: resolution.evidence } : {})
    };
}

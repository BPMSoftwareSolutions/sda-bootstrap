import { createGovernedEffectContext, effectNow } from "./native-mechanic-primitives.mjs";

function credentialBindingEvidence(payload, context, disposition, details = {}) {
  return {
    contractId: "external-credential-binding-evidence.v1",
    disposition,
    opaqueBindingId: details.opaqueBindingId ?? "none",
    referenceName: payload.credentialReference ?? "unavailable",
    invocationIdentity: payload.invocationIdentity ?? "unavailable",
    requestingCapabilityId: payload.requestingCapabilityId ?? "unavailable",
    endpointAuthorityDigest: payload.endpointAuthorityDigest ?? null,
    credentialInjectionRuleId: details.credentialInjectionRuleId ?? "none",
    nonDisclosureVerified: true,
    detail: details.detail ?? disposition,
    effectLineage: [...(Array.isArray(payload.effectLineage) ? payload.effectLineage : []), context.rootExecutionId]
  };
}

function unwrapEffectPayload(input, contractId) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${contractId.toUpperCase().replaceAll("-", "_")}_REQUEST_REQUIRED`);
  if (input.contractId === contractId) {
    if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) throw new Error(`${contractId.toUpperCase().replaceAll("-", "_")}_PAYLOAD_REQUIRED`);
    return input.payload;
  }
  return input;
}

export async function bindExternalCredentialReference(configuration, input, context, suppliedEffectContext) {
  const effectContext = suppliedEffectContext ?? createGovernedEffectContext();
  const payload = unwrapEffectPayload(input, "bind-external-credential-reference-input.v1");
  const required = ["credentialReference", "invocationIdentity", "requestingCapabilityId", "endpointAuthorityDigest", "effectScope"];
  if (required.some((field) => typeof payload[field] !== "string" || payload[field].length === 0)) {
    return credentialBindingEvidence(payload, context, "CREDENTIAL_NOT_AVAILABLE", { detail: "required binding authority is absent" });
  }
  const authorities = Array.isArray(configuration?.credentialAuthorities) ? configuration.credentialAuthorities : [];
  const authority = authorities.find((entry) => entry.referenceName === payload.credentialReference);
  if (!authority) return credentialBindingEvidence(payload, context, "UNAUTHORIZED_REFERENCE");
  const admittedCapabilities = authority.requestingCapabilityIds ?? [];
  const admittedDigests = authority.endpointAuthorityDigests ?? [];
  const admittedScopes = authority.effectScopes ?? [];
  if (!admittedCapabilities.includes(payload.requestingCapabilityId) || !admittedDigests.includes(payload.endpointAuthorityDigest) || !admittedScopes.includes(payload.effectScope)) {
    return credentialBindingEvidence(payload, context, "IDENTITY_MISMATCH");
  }
  if (authority.source !== "environment" || typeof authority.injectionRule?.id !== "string" || typeof authority.injectionRule?.headerName !== "string") {
    return credentialBindingEvidence(payload, context, "UNAUTHORIZED_REFERENCE");
  }
  const credential = effectContext.credentialReader(authority.referenceName);
  if (typeof credential !== "string" || credential.length === 0) {
    return credentialBindingEvidence(payload, context, "CREDENTIAL_NOT_AVAILABLE");
  }
  const opaqueBindingId = `opaque-credential-binding:${effectContext.randomId()}`;
  const lifetimeMilliseconds = Number.isInteger(authority.lifetimeMilliseconds) && authority.lifetimeMilliseconds > 0
    ? authority.lifetimeMilliseconds
    : 120000;
  const createdAt = effectNow(effectContext).getTime();
  effectContext.credentialBindings.set(opaqueBindingId, {
    credential,
    invocationIdentity: payload.invocationIdentity,
    requestingCapabilityId: payload.requestingCapabilityId,
    endpointAuthorityDigest: payload.endpointAuthorityDigest,
    effectScope: payload.effectScope,
    credentialInjectionRuleId: authority.injectionRule.id,
    headerName: authority.injectionRule.headerName.toLowerCase(),
    expiresAt: createdAt + lifetimeMilliseconds
  });
  return credentialBindingEvidence(payload, context, "BOUND", {
    opaqueBindingId,
    credentialInjectionRuleId: authority.injectionRule.id,
    detail: "one-use external credential reference bound"
  });
}

export { unwrapEffectPayload };

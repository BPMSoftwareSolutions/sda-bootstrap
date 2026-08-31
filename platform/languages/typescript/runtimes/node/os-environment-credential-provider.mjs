import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const PROVIDER_ID = "os-environment-credential-provider.v1";
const PROVIDER_VERSION = "1.0.0";

function readRegistryScope(referenceName, hive) {
  try {
    const output = execFileSync("reg.exe", ["query", hive, "/v", referenceName], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 64 * 1024
    });
    for (const line of output.split(/\r?\n/)) {
      const match = line.match(/^\s+\S+\s+REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/);
      if (match) return { value: match[1], scope: hive.startsWith("HKCU") ? "OS_USER_SCOPE" : "OS_MACHINE_SCOPE" };
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveOsEnvironmentCredential(referenceName) {
  const fromProcess = process.env[referenceName];
  if (fromProcess !== undefined) return { value: fromProcess, scope: "PROCESS_ENVIRONMENT" };
  if (process.platform === "win32") {
    return readRegistryScope(referenceName, "HKCU\\Environment")
      ?? readRegistryScope(referenceName, "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment")
      ?? null;
  }
  return null;
}

function evidence(payload, context, disposition, details = {}) {
  return {
    contractId: "os-environment-credential-binding-evidence.v1",
    disposition,
    opaqueBindingId: details.opaqueBindingId ?? "none",
    referenceName: payload.credentialReference ?? "unavailable",
    invocationIdentity: payload.invocationIdentity ?? "unavailable",
    requestingCapabilityId: payload.requestingCapabilityId ?? "unavailable",
    endpointAuthorityDigest: payload.endpointAuthorityDigest ?? null,
    resolutionScope: details.resolutionScope ?? "NONE",
    credentialInjectionRuleId: details.credentialInjectionRuleId ?? "none",
    nonDisclosureVerified: true,
    effectLineage: [...(Array.isArray(payload.effectLineage) ? payload.effectLineage : []), context.rootExecutionId]
  };
}

export async function bindOsEnvironmentCredential(configuration, input, context) {
  const effectContext = { credentialBindings: new Map(), randomId: () => randomUUID() };
  const payload = input?.payload && typeof input.payload === "object" ? input.payload : (input ?? {});
  const required = ["credentialReference", "invocationIdentity", "requestingCapabilityId", "endpointAuthorityDigest", "effectScope"];
  if (required.some((field) => typeof payload[field] !== "string" || payload[field].length === 0)) {
    return evidence(payload, context, "CREDENTIAL_NOT_AVAILABLE", { detail: "required binding authority is absent" });
  }
  const authorities = Array.isArray(configuration?.credentialAuthorities) ? configuration.credentialAuthorities : [];
  const authority = authorities.find((entry) => entry.referenceName === payload.credentialReference);
  if (!authority) return evidence(payload, context, "UNAUTHORIZED_REFERENCE");
  const admittedCapabilities = authority.requestingCapabilityIds ?? [];
  const admittedDigests = authority.endpointAuthorityDigests ?? [];
  const admittedScopes = authority.effectScopes ?? [];
  if (!admittedCapabilities.includes(payload.requestingCapabilityId)
    || !admittedDigests.includes(payload.endpointAuthorityDigest)
    || !admittedScopes.includes(payload.effectScope)) {
    return evidence(payload, context, "IDENTITY_MISMATCH");
  }
  const resolved = resolveOsEnvironmentCredential(authority.referenceName);
  if (!resolved || typeof resolved.value !== "string" || resolved.value.length === 0) {
    return evidence(payload, context, "CREDENTIAL_NOT_AVAILABLE", { detail: "absent from every resolution scope" });
  }
  const opaqueBindingId = `opaque-os-credential-binding:${effectContext.randomId()}`;
  process.env[authority.referenceName] = resolved.value;
  effectContext.credentialBindings.set(opaqueBindingId, {
    credential: resolved.value,
    invocationIdentity: payload.invocationIdentity,
    requestingCapabilityId: payload.requestingCapabilityId,
    endpointAuthorityDigest: payload.endpointAuthorityDigest,
    effectScope: payload.effectScope,
    credentialInjectionRuleId: authority.injectionRule?.id ?? "none",
    headerName: (authority.injectionRule?.headerName ?? "authorization").toLowerCase(),
    expiresAt: Date.now() + (Number.isInteger(authority.lifetimeMilliseconds) && authority.lifetimeMilliseconds > 0 ? authority.lifetimeMilliseconds : 120000)
  });
  return evidence(payload, context, "BOUND", {
    opaqueBindingId,
    resolutionScope: resolved.scope,
    credentialInjectionRuleId: authority.injectionRule?.id ?? "none",
    detail: "one-use OS environment credential reference bound"
  });
}

export { PROVIDER_ID, PROVIDER_VERSION };

import crypto from "node:crypto";
import { createGovernedEffectContext, effectNow } from "./native-mechanic-primitives.mjs";
import { unwrapEffectPayload } from "./external-credential-reference-binding-provider.mjs";

function sha256Bytes(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function transportDispositionFor(error, reachedStage, timedOut, cancelled) {
  if (timedOut) return "timed-out";
  if (cancelled) return "cancelled";
  const code = error?.cause?.code ?? error?.code;
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) return "dns-failed";
  if (typeof code === "string" && (code.includes("CERT") || code.includes("TLS") || code.includes("SSL"))) return "tls-failed";
  if (["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) return "connect-failed";
  return reachedStage === "reading-response" ? "read-failed" : "transmission-failed";
}

function httpExchangeEvidence(payload, context, effectContext, values = {}) {
  const startedAt = values.startedAt ?? effectNow(effectContext);
  const completedAt = values.completedAt ?? effectNow(effectContext);
  return {
    contractId: "governed-http-exchange-evidence.v1",
    disposition: values.disposition ?? "transport-failed",
    exchangeKind: payload.exchangeKind ?? "transport-failure",
    transportDisposition: values.transportDisposition ?? "denied",
    httpStatus: values.httpStatus ?? 0,
    allowedResponseHeaders: values.allowedResponseHeaders ?? {},
    boundedBytes: values.boundedBytes ?? 0,
    requestBodyHash: values.requestBodyHash ?? null,
    responseBodyHash: values.responseBodyHash ?? null,
    responseBodyBytes: values.responseBodyBytes ?? null,
    reachedStage: values.reachedStage ?? "admission",
    exchangeCount: values.exchangeCount ?? 0,
    timing: {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMilliseconds: Math.max(0, completedAt.getTime() - startedAt.getTime())
    },
    redactionVerified: true,
    lineageId: payload.lineageId ?? "unavailable",
    effectLineage: [...(Array.isArray(payload.effectLineage) ? payload.effectLineage : []), context.rootExecutionId]
  };
}

function consumeCredentialBinding(effectContext, payload, rule) {
  const bindingId = payload.opaqueCredentialBinding?.bindingId;
  if (typeof bindingId !== "string" || bindingId.length === 0) return null;
  const binding = effectContext.credentialBindings.get(bindingId);
  if (!binding) return null;
  effectContext.credentialBindings.delete(bindingId);
  if (binding.expiresAt < effectNow(effectContext).getTime() ||
      binding.invocationIdentity !== payload.invocationIdentity ||
      binding.endpointAuthorityDigest !== payload.endpointAuthorityDigest ||
      binding.credentialInjectionRuleId !== payload.credentialInjectionRuleId ||
      payload.opaqueCredentialBinding.credentialInjectionRuleId !== payload.credentialInjectionRuleId ||
      binding.headerName !== rule.headerName.toLowerCase()) return null;
  return binding;
}

export async function observeGovernedHttpExchange(configuration, input, context, suppliedEffectContext) {
  const effectContext = suppliedEffectContext ?? createGovernedEffectContext();
  const payload = unwrapEffectPayload(input, "observe-governed-http-exchange-input.v1");
  const startedAt = effectNow(effectContext);
  let requestUrl;
  try { requestUrl = new URL(payload.requestUrl); }
  catch { return httpExchangeEvidence(payload, context, effectContext, { disposition: "rejected-endpoint", reachedStage: "endpoint-admission", startedAt }); }
  const loopbackConformance = effectContext.allowLoopbackHttpForConformance === true &&
    requestUrl.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(requestUrl.hostname);
  if (requestUrl.protocol !== "https:" && !loopbackConformance) {
    return httpExchangeEvidence(payload, context, effectContext, { disposition: "rejected-endpoint", reachedStage: "endpoint-admission", startedAt });
  }
  const endpoint = (configuration?.endpointAuthorities ?? []).find((entry) =>
    entry.endpointAuthorityDigest === payload.endpointAuthorityDigest &&
    (entry.urlPrefixes ?? []).some((prefix) => payload.requestUrl.startsWith(prefix)) &&
    (entry.methods ?? []).includes(payload.method));
  if (!endpoint) return httpExchangeEvidence(payload, context, effectContext, { disposition: "rejected-endpoint", reachedStage: "endpoint-admission", startedAt });
  if (typeof payload.requestBodyText !== "string" || !Number.isInteger(payload.timeoutMilliseconds) || payload.timeoutMilliseconds < 1 ||
      !Number.isInteger(payload.maxResponseBytes) || payload.maxResponseBytes < 1) {
    return httpExchangeEvidence(payload, context, effectContext, { disposition: "transport-failed", reachedStage: "request-admission", startedAt });
  }
  const safeHeaders = payload.safeHeaders && typeof payload.safeHeaders === "object" && !Array.isArray(payload.safeHeaders) ? payload.safeHeaders : {};
  const allowedRequestHeaders = new Set((endpoint.allowedRequestHeaders ?? []).map((name) => name.toLowerCase()));
  const credentialHeaderNames = new Set(["authorization", "proxy-authorization", "x-api-key", "x-goog-api-key"]);
  for (const [name, value] of Object.entries(safeHeaders)) {
    const normalized = name.toLowerCase();
    if (!allowedRequestHeaders.has(normalized) || credentialHeaderNames.has(normalized) || typeof value !== "string" || /[\r\n]/u.test(value)) {
      return httpExchangeEvidence(payload, context, effectContext, { disposition: "rejected-credential", reachedStage: "request-header-admission", startedAt });
    }
  }
  const allowedResponseHeaders = new Set((endpoint.allowedResponseHeaders ?? []).map((name) => name.toLowerCase()));
  if (!Array.isArray(payload.allowedResponseHeaders) || payload.allowedResponseHeaders.some((name) => !allowedResponseHeaders.has(String(name).toLowerCase()))) {
    return httpExchangeEvidence(payload, context, effectContext, { disposition: "transport-failed", reachedStage: "response-header-admission", startedAt });
  }
  const rule = (configuration?.credentialInjectionRules ?? []).find((entry) => entry.id === payload.credentialInjectionRuleId);
  if (rule && (typeof (rule.valuePrefix ?? "") !== "string" || /[\r\n]/u.test(rule.valuePrefix ?? ""))) {
    return httpExchangeEvidence(payload, context, effectContext, { disposition: "rejected-credential", reachedStage: "credential-rule-admission", startedAt });
  }
  const binding = rule ? consumeCredentialBinding(effectContext, payload, rule) : null;
  if (!binding) return httpExchangeEvidence(payload, context, effectContext, { disposition: "rejected-credential", reachedStage: "credential-binding", startedAt });
  const requestBody = Buffer.from(payload.requestBodyText, "utf8");
  const requestBodyHash = sha256Bytes(requestBody);
  if (context.signal?.aborted) {
    return httpExchangeEvidence(payload, context, effectContext, { disposition: "cancelled", transportDisposition: "cancelled", reachedStage: "pre-exchange-cancellation", requestBodyHash, startedAt });
  }
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;
  const onCancellation = () => { cancelled = true; controller.abort(context.signal?.reason); };
  context.signal?.addEventListener("abort", onCancellation, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(new DOMException("Timed out", "TimeoutError")); }, payload.timeoutMilliseconds);
  let reachedStage = "request-transmission";
  try {
    const response = await effectContext.fetch(payload.requestUrl, {
      method: payload.method,
      headers: { ...safeHeaders, [rule.headerName.toLowerCase()]: `${rule.valuePrefix ?? ""}${binding.credential}` },
      body: requestBody.length > 0 ? requestBody : undefined,
      redirect: "manual",
      signal: controller.signal
    });
    reachedStage = "reading-response";
    const chunks = [];
    let boundedBytes = 0;
    if (response.body) {
      for await (const chunk of response.body) {
        const bytes = Buffer.from(chunk);
        boundedBytes += bytes.length;
        if (boundedBytes > payload.maxResponseBytes) {
          return httpExchangeEvidence(payload, context, effectContext, {
            disposition: "oversized-response-rejected", transportDisposition: "oversized", httpStatus: response.status,
            boundedBytes: payload.maxResponseBytes, requestBodyHash, reachedStage: "response-bound", exchangeCount: 1, startedAt
          });
        }
        chunks.push(bytes);
      }
    }
    const responseBody = Buffer.concat(chunks);
    const retainedHeaders = {};
    for (const name of payload.allowedResponseHeaders) {
      const value = response.headers.get(name);
      if (value !== null) retainedHeaders[name.toLowerCase()] = value;
    }
    const redirected = response.status >= 300 && response.status < 400;
    return httpExchangeEvidence(payload, context, effectContext, {
      disposition: redirected ? "transport-failed" : response.status >= 200 && response.status < 300 ? "completed" : "retained-non-success",
      transportDisposition: redirected ? "redirection-limited" : "completed",
      httpStatus: response.status,
      allowedResponseHeaders: retainedHeaders,
      boundedBytes,
      requestBodyHash,
      responseBodyHash: sha256Bytes(responseBody),
      responseBodyBytes: responseBody.toString("base64"),
      reachedStage: redirected ? "redirect-policy" : "response-complete",
      exchangeCount: 1,
      startedAt
    });
  } catch (error) {
    const transportDisposition = transportDispositionFor(error, reachedStage, timedOut, cancelled);
    return httpExchangeEvidence(payload, context, effectContext, {
      disposition: transportDisposition === "timed-out" ? "timed-out" : transportDisposition === "cancelled" ? "cancelled" : "transport-failed",
      transportDisposition, requestBodyHash, reachedStage, exchangeCount: 1, startedAt
    });
  } finally {
    clearTimeout(timeout);
    context.signal?.removeEventListener("abort", onCancellation);
  }
}

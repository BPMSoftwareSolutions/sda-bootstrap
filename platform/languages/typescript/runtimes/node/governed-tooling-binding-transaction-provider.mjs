import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export async function transactGovernedToolingBinding(configuration, carrier, context, bindingUrl) {
  const required = ["bindingFileRef", "selectedResponsibilityId", "replacementProviderId", "lineageMode"];
  const missing = required.filter((key) => typeof configuration?.[key] !== "string" || configuration[key].length === 0);
  if (missing.length) throw new Error(`GOVERNED_BINDING_TRANSACTION_CONFIGURATION_MISSING: '${missing.join(",")}'`);
  if (configuration.lineageMode !== "retain-effect-lineage") throw new Error("GOVERNED_BINDING_TRANSACTION_LINEAGE_MODE_UNSUPPORTED");
  if (!carrier || typeof carrier !== "object" || Array.isArray(carrier)) throw new Error("GOVERNED_BINDING_TRANSACTION_CARRIER_REQUIRED");
  const phase = carrier.carrierType;
  if (phase === "governed-tooling-binding-transaction-request.v1") return {...structuredClone(carrier), carrierType:"bounded-governed-tooling-binding-transaction-context.v1", effectLineage:[...(carrier.effectLineage ?? []), context.rootExecutionId]};
  const fileUrl = new URL(configuration.bindingFileRef, bindingUrl);
  if (fileUrl.protocol !== "file:") throw new Error("GOVERNED_BINDING_TRANSACTION_LOCAL_FILE_AUTHORITY_REQUIRED");
  const file = fileURLToPath(fileUrl);
  const prior = Buffer.from(carrier.priorBytes ?? "", "base64");
  if (phase === "bounded-governed-tooling-binding-transaction-context.v1") {
    const current = fs.readFileSync(file);
    if (!current.equals(prior)) throw new Error("GOVERNED_BINDING_TRANSACTION_PRIOR_BYTES_MISMATCH");
    const document = JSON.parse(current.toString("utf8"));
    const bindings = Array.isArray(document.bindings) ? document.bindings : document.providerBindings;
    const selected = bindings?.filter((entry) => entry.responsibilityId === configuration.selectedResponsibilityId) ?? [];
    if (selected.length !== 1) throw new Error("GOVERNED_BINDING_TRANSACTION_SELECTED_BINDING_MISMATCH");
    selected[0].providerId = configuration.replacementProviderId;
    fs.writeFileSync(file, JSON.stringify(document));
    return {...structuredClone(carrier), carrierType:"staged-governed-tooling-binding-observation.v1", priorBytes: carrier.priorBytes, effectLineage:[...(carrier.effectLineage ?? []), context.rootExecutionId]};
  }
  if (phase === "staged-governed-tooling-binding-observation.v1") return {...structuredClone(carrier), carrierType:"governed-tooling-binding-gate-observation.v1", gateExitCode: 0, effectLineage:[...(carrier.effectLineage ?? []), context.rootExecutionId]};
  if (phase === "governed-tooling-binding-gate-observation.v1") {
    const retain = carrier.gateExitCode === 0;
    if (!retain) fs.writeFileSync(file, prior);
    const after = fs.readFileSync(file);
    return {carrierType:"governed-tooling-binding-transaction-evidence.v1", disposition:retain ? "RETAINED" : "RESTORED", responsibilityId:configuration.selectedResponsibilityId, beforeBytesHash:`sha256:${crypto.createHash("sha256").update(prior).digest("hex")}`, afterBytesHash:`sha256:${crypto.createHash("sha256").update(after).digest("hex")}`, effectLineage:[...(carrier.effectLineage ?? []), context.rootExecutionId]};
  }
  throw new Error("GOVERNED_BINDING_TRANSACTION_CARRIER_UNSUPPORTED");
}

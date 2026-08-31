import { fileURLToPath } from "node:url";

export async function invokeGovernedToolingMigrationOperation(configuration, input, context, bindingUrl) {
  const required = ["providerRef", "authorityRef", "operation"];
  const missing = required.filter((key) => typeof configuration?.[key] !== "string" || configuration[key].length === 0);
  if (missing.length) throw new Error(`GOVERNED_TOOLING_MIGRATION_CONFIGURATION_MISSING: '${missing.join(",")}'`);
  if (!["inventory", "verify", "promote", "run"].includes(configuration.operation)) {
    throw new Error(`GOVERNED_TOOLING_MIGRATION_OPERATION_UNSUPPORTED: '${configuration.operation}'`);
  }
  const providerUrl = new URL(configuration.providerRef, bindingUrl);
  const authorityUrl = new URL(configuration.authorityRef, bindingUrl);
  if (providerUrl.protocol !== "file:" || authorityUrl.protocol !== "file:") {
    throw new Error("GOVERNED_TOOLING_MIGRATION_LOCAL_AUTHORITY_REQUIRED");
  }
  const provider = await import(`${providerUrl.href}?execution=${encodeURIComponent(context.rootExecutionId)}`);
  if (typeof provider.executeToolingMigrationOperation !== "function") {
    throw new Error("GOVERNED_TOOLING_MIGRATION_PROVIDER_INVALID");
  }
  const outcome = await provider.executeToolingMigrationOperation({
    operation: configuration.operation,
    authorityPath: fileURLToPath(authorityUrl)
  }, structuredClone(input));
  return {
    ...outcome,
    effectLineage: [...(outcome.effectLineage ?? []), context.rootExecutionId]
  };
}

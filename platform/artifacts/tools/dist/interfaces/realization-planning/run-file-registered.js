import path from "node:path";
import { AjvSchemaAdmission } from "../../adapters/contracts/ajv-schema-admission.cjs";
import { loadFileSystemRealizationPlanningAuthority } from "../../adapters/realization-planning/file-system-realization-planning-authority.js";
import { ProfiledDigestRealizationProjector } from "../../adapters/realization-planning/profiled-digest-realization-projector.js";
import { ProfiledRealizationPolicyDecision } from "../../adapters/realization-planning/profiled-realization-policy-decision.js";
import { ConstructDeterministicRealizationPlanProvider } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/provider.js";
import { ResolveRegisteredRealizationPlanProvider } from "../../capabilities/realization-planning/resolve-registered-realization-plan/provider.js";
import { runRegisteredRealizationPlanning } from "./run-registered.js";
export async function runFileRegisteredRealizationPlanning(options) {
    const schemaAdmission = new AjvSchemaAdmission(path.join(options.repositoryRoot, "capabilities", "sda-tooling", "realization-planning", "contracts"));
    const authority = loadFileSystemRealizationPlanningAuthority({
        registryRoot: options.registryRoot,
        manifestRef: options.manifestRef,
        schemaAdmission
    });
    const policyProfile = authority.policyDecisionProfiles.resolve(options.policyDecisionProfile.authorityId, options.policyDecisionProfile.selector);
    if (!policyProfile)
        throw new Error("Configured policy-decision profile did not resolve to immutable authority.");
    const projectorProfile = authority.projectorProfiles.resolve(options.projectorProfile.authorityId, options.projectorProfile.selector);
    if (!projectorProfile)
        throw new Error("Configured projector profile did not resolve to immutable authority.");
    const compiler = new ConstructDeterministicRealizationPlanProvider(new ProfiledRealizationPolicyDecision(policyProfile.value), new ProfiledDigestRealizationProjector(projectorProfile.value));
    const provider = new ResolveRegisteredRealizationPlanProvider(authority.registries, compiler);
    const run = await runRegisteredRealizationPlanning({
        repositoryRoot: options.repositoryRoot,
        request: options.request,
        registries: authority.registries,
        provider,
        ...(options.executionId ? { executionId: options.executionId } : {})
    });
    return {
        ...run,
        authorityManifestDigest: authority.manifestDigest,
        policyDecisionProfileDigest: policyProfile.digest,
        projectorProfileDigest: projectorProfile.digest
    };
}

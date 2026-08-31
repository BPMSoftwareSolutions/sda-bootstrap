// @ts-ignore
import { executeCapability } from "../../../../../../capabilities/sda-tooling/projected-tools/admit-language-declaration/projected/node/capability-runtime.generated.mjs";
export class LanguageDeclarationProvider {
    responsibilityId = "validate-declared-implementation-identity-and-claim";
    async execute(input) {
        if (input && input.contractId === "language-declaration-admission-input.v1") {
            const result = await executeCapability(input);
            return result.outcome;
        }
        const bindingValidation = input.bindingValidation?.value;
        if (!input.manifest || !input.manifestValidation) {
            return {
                bindingValid: Boolean(bindingValidation?.valid),
                bindingErrors: bindingValidation?.valid ? [] : (bindingValidation?.errors?.map((e) => `${e.instancePath} ${e.message}`) ?? []),
                manifestPath: input.manifestPath,
                conformanceClaimValid: false,
                conformanceClaimErrors: ["conformance manifest not found"]
            };
        }
        const CONTENT_ARRAY_SCOPES = ["/semanticObjects", "/executionStepEmbodiments", "/dataAuthority"];
        const declarationErrors = (input.manifestValidation.value.errors || []).filter((error) => !CONTENT_ARRAY_SCOPES.some((prefix) => error.instancePath === prefix || error.instancePath.startsWith(`${prefix}/`)));
        return {
            bindingValid: Boolean(bindingValidation?.valid),
            bindingErrors: bindingValidation?.valid ? [] : (bindingValidation?.errors?.map((e) => `${e.instancePath} ${e.message}`) ?? []),
            manifestPath: input.manifestPath,
            conformanceClaimValid: declarationErrors.length === 0,
            conformanceClaimErrors: declarationErrors.map((error) => `${error.instancePath} ${error.message}`)
        };
    }
}

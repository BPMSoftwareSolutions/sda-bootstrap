export class KernelSpecificationAdmissionProvider {
    responsibilityId = "validate-canonical-kernel-specification";
    async execute(input) {
        if (!input.specification || !input.validation)
            return { specificationPath: input.specificationPath, found: false, valid: false, errors: ["kernel specification instance not found"] };
        return { specificationPath: input.specificationPath, found: true, valid: input.validation.value.valid, errors: input.validation.value.valid ? [] : input.validation.value.errors.map((error) => `${error.instancePath} ${error.message}`) };
    }
}

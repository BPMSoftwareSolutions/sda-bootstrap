export class ExecutionVectorAdmissionProvider {
    responsibilityId = "validate-canonical-execution-circuit";
    async execute(input) {
        if (!input.executionVector || !input.validation)
            return { executionVectorPath: input.executionVectorPath, found: false, valid: false, errors: ["execution vector instance not found"] };
        return { executionVectorPath: input.executionVectorPath, found: true, valid: input.validation.value.valid, errors: input.validation.value.valid ? [] : input.validation.value.errors.map((error) => `${error.instancePath} ${error.message}`) };
    }
}

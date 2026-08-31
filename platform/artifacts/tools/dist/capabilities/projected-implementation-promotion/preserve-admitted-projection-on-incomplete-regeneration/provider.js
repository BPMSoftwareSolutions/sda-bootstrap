export class PreserveAdmittedProjectionProvider {
    responsibilityId = "verify-admitted-bytes-survive-incomplete-regeneration";
    async execute(input) {
        return Object.freeze({ ...input, preserved: JSON.stringify(input.beforeDigests) === JSON.stringify(input.afterDigests) });
    }
}

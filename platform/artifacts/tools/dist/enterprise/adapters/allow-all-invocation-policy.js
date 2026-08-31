export class AllowAllInvocationPolicy {
    async decide(request, _bundle) {
        return {
            disposition: "ALLOW",
            decisionId: `${request.executionId}.allow`,
            reasonCodes: []
        };
    }
}

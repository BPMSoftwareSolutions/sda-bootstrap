export class ExecutionIdempotencyConflictError extends Error {
    existingExecutionId;
    code = "EXECUTION_IDEMPOTENCY_CONFLICT";
    constructor(existingExecutionId) {
        super(`Idempotency key is already bound to execution '${existingExecutionId}' with different admitted intent.`);
        this.existingExecutionId = existingExecutionId;
        this.name = "ExecutionIdempotencyConflictError";
    }
}

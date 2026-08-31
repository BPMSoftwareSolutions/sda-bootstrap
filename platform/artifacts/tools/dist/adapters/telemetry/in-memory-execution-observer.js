export class InMemoryExecutionObserver {
    observations = [];
    observe(observation) {
        this.observations.push(observation);
    }
}

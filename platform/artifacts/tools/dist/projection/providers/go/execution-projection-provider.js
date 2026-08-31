import { renderExecutionProjection } from "../execution-rendering.js";
export class GoExecutionProjectionProvider {
    target = "go";
    render(graph, profile) {
        return renderExecutionProjection(this.target, graph, profile);
    }
}

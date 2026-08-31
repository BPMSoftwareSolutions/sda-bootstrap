import { renderExecutionProjection } from "../execution-rendering.js";
export class PythonExecutionProjectionProvider {
    target = "python";
    render(graph, profile) {
        return renderExecutionProjection(this.target, graph, profile);
    }
}

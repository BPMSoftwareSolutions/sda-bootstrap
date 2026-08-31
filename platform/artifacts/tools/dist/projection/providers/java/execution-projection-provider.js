import { renderExecutionProjection } from "../execution-rendering.js";
export class JavaExecutionProjectionProvider {
    target = "java";
    render(graph, profile) {
        return renderExecutionProjection(this.target, graph, profile);
    }
}

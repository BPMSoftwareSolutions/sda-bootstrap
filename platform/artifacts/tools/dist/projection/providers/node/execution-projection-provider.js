import { renderExecutionProjection } from "../execution-rendering.js";
export class NodeExecutionProjectionProvider {
    target = "node";
    render(graph, profile) {
        return renderExecutionProjection(this.target, graph, profile);
    }
}

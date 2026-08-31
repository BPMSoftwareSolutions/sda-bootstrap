import { renderExecutionProjection } from "../execution-rendering.js";
export class CsharpExecutionProjectionProvider {
    target = "csharp";
    render(graph, profile) {
        return renderExecutionProjection(this.target, graph, profile);
    }
}

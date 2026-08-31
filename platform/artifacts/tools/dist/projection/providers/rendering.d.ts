import type { ProjectionPlanFile } from "../model/projection-plan.js";
import type { TargetTypeDefinition } from "../model/target-projection-graph.js";
export declare function projectionFile(relativePath: string, content: string, definition: TargetTypeDefinition): ProjectionPlanFile;
export declare function encodedLiteral(target: "csharp" | "go" | "java" | "node" | "python", value: string | number | boolean): string;

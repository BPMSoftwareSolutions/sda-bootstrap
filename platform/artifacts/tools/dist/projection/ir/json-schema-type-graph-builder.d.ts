import { type SchemaLoader } from "./schema-mechanics.js";
import type { CanonicalTypeGraph } from "../model/canonical-type-graph.js";
export declare class JsonSchemaTypeGraphBuilder {
    private readonly loadSchema;
    private readonly definitions;
    private readonly resolving;
    constructor(loadSchema: SchemaLoader);
    build(schemaRefs: readonly string[]): CanonicalTypeGraph;
    private buildDefinition;
    private buildNode;
    private buildObject;
}

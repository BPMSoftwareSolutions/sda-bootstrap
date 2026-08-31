import { JsonSchemaTypeGraphBuilder } from "../../../projection/ir/json-schema-type-graph-builder.js";
import { createSchemaLoader } from "../../../projection/ir/schema-mechanics.js";
export class DeriveCanonicalTypeGraphProvider {
    responsibilityId = "resolve-schemas-into-target-neutral-type-graph";
    async execute(input) {
        return new JsonSchemaTypeGraphBuilder(createSchemaLoader(input.schemas.value)).build(input.roots);
    }
}

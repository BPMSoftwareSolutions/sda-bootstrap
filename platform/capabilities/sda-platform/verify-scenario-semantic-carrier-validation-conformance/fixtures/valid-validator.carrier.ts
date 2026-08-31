import { defineCapability } from "../src/index.js";

export default defineCapability({
  schemaVersion: "scenario-semantic-carrier.v2",
  capability: {
    id: "validate-semantic-carrier",
    name: "Validate Semantic Carrier",
    version: "0.2.0-candidate",
    rootExperience: "A carrier receives a deterministic conformant or rejected disposition with explicit findings.",
    terminalDispositions: ["CONFORMANT", "CARRIER_NOT_CONFORMANT"],
  },
  feature: { id: "validate-semantic-carrier", name: "Validate a Scenario Semantic Carrier" },
  contracts: [
    {
      id: "semantic-carrier-source.v1", name: "Semantic Carrier Source v1", kind: "data",
      shape: { type: "string", description: "TypeScript-shaped carrier source admitted as data." },
    },
    {
      id: "carrier-validation-result.v1", name: "Carrier Validation Result v1", kind: "state",
      shape: { type: "object", description: "Classified validation state containing a carrier or exact findings." },
    },
    {
      id: "carrier-conformance.v1", name: "Carrier Conformance v1", kind: "product",
      shape: { type: "object", description: "One conformant or rejected disposition with deterministic findings." },
    },
  ],
  scenarios: [
    {
      id: "validate-carrier-source", name: "Validate carrier source",
      input: {
        id: "semantic-carrier-source", name: "Semantic Carrier Source",
        contractRef: "semantic-carrier-source.v1", gherkin: "Scenario Semantic Carrier source bytes",
      },
      event: {
        id: "validate-semantic-carrier", name: "Validate Semantic Carrier",
        responsibility: "Parse only the literal carrier grammar, admit its schema, resolve every identity, and classify the source without executing it.",
        gherkin: "the carrier is parsed and validated without executing it",
        execution: {
          operations: [
            {
              id: "parse-literal-carrier", name: "Parse Literal Carrier",
              predecessorRefs: [],
              mechanicRefs: ["typescript-ast-parsing", "hidden-meaning-detection"], providerBoundaryRefs: [], effectRefs: [],
            },
            {
              id: "admit-carrier-schema", name: "Admit Carrier Schema",
              predecessorRefs: ["parse-literal-carrier"],
              mechanicRefs: ["json-schema-admission"], providerBoundaryRefs: [], effectRefs: [],
            },
            {
              id: "resolve-semantic-references", name: "Resolve Semantic References",
              predecessorRefs: ["admit-carrier-schema"],
              mechanicRefs: ["semantic-reference-resolution"], providerBoundaryRefs: [], effectRefs: [],
            },
          ],
          mechanics: [
            {
              id: "typescript-ast-parsing", name: "TypeScript AST Parsing", kind: "native",
              config: { execution: "static-only", calls: "defineCapability-literal-only" },
            },
            {
              id: "hidden-meaning-detection", name: "Hidden Meaning Detection", kind: "classification",
              config: { reject: ["function", "call", "branch", "loop", "spread", "computed-property"] },
            },
            {
              id: "json-schema-admission", name: "JSON Schema Admission", kind: "classification",
              config: { schema: "scenario-semantic-carrier.v2", conformant: "success", rejected: "failure" },
            },
            {
              id: "semantic-reference-resolution", name: "Semantic Reference Resolution", kind: "classification",
              config: { resolved: "success", unresolved: "failure" },
            },
          ],
          providerBoundaries: [], effects: [],
        },
      },
      outcome: {
        id: "carrier-validation-classified", name: "Carrier Validation Classified",
        experience: "The source is classified as conforming or rejected from exact validation evidence.",
        product: { id: "carrier-validation-result", name: "Carrier Validation Result", contractRef: "carrier-validation-result.v1" },
        terminal: false, terminalDisposition: null,
        gherkin: "the carrier has an exact validation classification",
      },
      routes: [
        { id: "carrier-conformant-route", toScenarioRef: "return-conformant-carrier", when: { kind: "success", selector: null } },
        { id: "carrier-rejected-route", toScenarioRef: "return-carrier-rejection", when: { kind: "failure", selector: null } },
      ],
    },
    {
      id: "return-conformant-carrier", name: "Return conformant carrier",
      input: {
        id: "conformant-validation-result", name: "Conformant Validation Result",
        contractRef: "carrier-validation-result.v1", gherkin: "validation evidence with no findings",
      },
      event: {
        id: "bind-conformant-receipt", name: "Bind Conformant Receipt",
        responsibility: "Bind the admitted carrier and empty findings to the conformant receipt.",
        gherkin: "the conformant receipt is bound",
        execution: {
          operations: [{ id: "emit-conformant-receipt", name: "Emit Conformant Receipt", predecessorRefs: [], mechanicRefs: [], providerBoundaryRefs: [], effectRefs: [] }],
          mechanics: [], providerBoundaries: [], effects: [],
        },
      },
      outcome: {
        id: "carrier-conformant", name: "Carrier Conformant",
        experience: "The caller receives a conformant disposition with no findings.",
        product: { id: "conformant-carrier-receipt", name: "Conformant Carrier Receipt", contractRef: "carrier-conformance.v1" },
        terminal: true, terminalDisposition: "CONFORMANT",
        gherkin: "the CONFORMANT receipt is returned",
      },
      routes: [],
    },
    {
      id: "return-carrier-rejection", name: "Return carrier rejection",
      input: {
        id: "rejected-validation-result", name: "Rejected Validation Result",
        contractRef: "carrier-validation-result.v1", gherkin: "validation evidence with one or more findings",
      },
      event: {
        id: "bind-rejected-receipt", name: "Bind Rejected Receipt",
        responsibility: "Bind the exact findings to a fail-closed rejected receipt without producing a carrier.",
        gherkin: "the rejected receipt is bound",
        execution: {
          operations: [{ id: "emit-rejected-receipt", name: "Emit Rejected Receipt", predecessorRefs: [], mechanicRefs: [], providerBoundaryRefs: [], effectRefs: [] }],
          mechanics: [], providerBoundaries: [], effects: [],
        },
      },
      outcome: {
        id: "carrier-rejected", name: "Carrier Rejected",
        experience: "The caller receives a rejected disposition with deterministic findings and no carrier graph.",
        product: { id: "rejected-carrier-receipt", name: "Rejected Carrier Receipt", contractRef: "carrier-conformance.v1" },
        terminal: true, terminalDisposition: "CARRIER_NOT_CONFORMANT",
        gherkin: "the CARRIER_NOT_CONFORMANT receipt is returned",
      },
      routes: [],
    },
  ],
});

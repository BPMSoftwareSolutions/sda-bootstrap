import { defineCapability } from "../src/index.js";

export default defineCapability({
  schemaVersion: "scenario-semantic-carrier.v2",
  capability: {
    id: "extract-semantic-carrier-graph",
    name: "Extract Semantic Carrier Graph",
    version: "0.1.0-candidate",
    rootExperience: "One validated carrier becomes one canonical graph and an exact extraction receipt before carrier blackout.",
    terminalDispositions: ["EXTRACTED", "EXTRACTION_HELD"],
  },
  feature: { id: "semantic-carrier-graph-extraction", name: "Extract a canonical graph from one validated semantic carrier" },
  contracts: [
    { id: "semantic-carrier-extraction-request.v1", name: "Semantic Carrier Extraction Request v1", kind: "data", shape: { type: "object", description: "Exact carrier bytes and the exact conformant validator receipt bound to those bytes." } },
    { id: "semantic-carrier-extraction-stage.v1", name: "Semantic Carrier Extraction Stage v1", kind: "state", shape: { type: "object", description: "One success or held graph extraction classification without downstream projection." } },
    { id: "semantic-carrier-extraction-result.v1", name: "Semantic Carrier Extraction Result v1", kind: "product", shape: { type: "object", description: "Canonical graph and extraction receipt, or ordered held findings, with carrier blackout established." } },
  ],
  scenarios: [
    {
      id: "extract-canonical-carrier-graph", name: "Extract canonical carrier graph",
      input: { id: "validated-carrier-request", name: "Validated Carrier Request", contractRef: "semantic-carrier-extraction-request.v1", gherkin: "exact carrier bytes and their exact conformant validator receipt" },
      event: { id: "extract-canonical-carrier-graph", name: "Extract Canonical Carrier Graph", responsibility: "Verify validator lineage, map declared identities and relationships, normalize ordering, canonicalize and digest one graph, and establish carrier blackout.", gherkin: "the validated carrier is extracted into one canonical graph", execution: { operations: [{ id: "verify-validator-pass-receipt", name: "Verify Validator Pass Receipt", predecessorRefs: [], mechanicRefs: ["same-carrier-binding"], providerBoundaryRefs: [], effectRefs: [] }, { id: "build-canonical-graph", name: "Build Canonical Graph", predecessorRefs: ["verify-validator-pass-receipt"], mechanicRefs: ["canonical-graph-construction", "canonical-json", "sha256-digest"], providerBoundaryRefs: [], effectRefs: [] }, { id: "establish-carrier-blackout", name: "Establish Carrier Blackout", predecessorRefs: ["build-canonical-graph"], mechanicRefs: ["carrier-blackout-classification"], providerBoundaryRefs: [], effectRefs: [] }], mechanics: [{ id: "same-carrier-binding", name: "Same Carrier Binding", kind: "classification", config: { sameDigestAndLineage: "success", divergence: "failure" } }, { id: "canonical-graph-construction", name: "Canonical Graph Construction", kind: "native", config: { identities: "declared-only", relationships: "declared-only", ordering: "code-point" } }, { id: "canonical-json", name: "Canonical JSON", kind: "native", config: { keyOrdering: "code-point" } }, { id: "sha256-digest", name: "SHA-256 Digest", kind: "native", config: { algorithm: "sha256" } }, { id: "carrier-blackout-classification", name: "Carrier Blackout Classification", kind: "classification", config: { downstreamCarrierBytesAbsent: "success", carrierReachableDownstream: "failure" } }], providerBoundaries: [], effects: [] } },
      outcome: { id: "carrier-graph-extraction-classified", name: "Carrier Graph Extraction Classified", experience: "The caller receives either one canonical graph with exact receipt lineage or ordered attributable held findings; carrier bytes are absent downstream.", product: { id: "semantic-carrier-extraction-stage", name: "Semantic Carrier Extraction Stage", contractRef: "semantic-carrier-extraction-stage.v1" }, terminal: false, terminalDisposition: null, gherkin: "graph extraction is classified without downstream projection" },
      routes: [{ id: "graph-extracted-route", toScenarioRef: "return-extracted-graph", when: { kind: "success", selector: null } }, { id: "extraction-held-route", toScenarioRef: "return-extraction-held", when: { kind: "failure", selector: null } }],
    },
    {
      id: "return-extracted-graph", name: "Return extracted graph",
      input: { id: "extracted-graph-stage", name: "Extracted Graph Stage", contractRef: "semantic-carrier-extraction-stage.v1", gherkin: "one canonical graph and exact extraction lineage with blackout established" },
      event: { id: "bind-extracted-graph-receipt", name: "Bind Extracted Graph Receipt", responsibility: "Return only the canonical graph and exact receipt lineage.", gherkin: "the extracted graph receipt is returned", execution: { operations: [{ id: "emit-extracted-graph-receipt", name: "Emit Extracted Graph Receipt", predecessorRefs: [], mechanicRefs: [], providerBoundaryRefs: [], effectRefs: [] }], mechanics: [], providerBoundaries: [], effects: [] } },
      outcome: { id: "canonical-carrier-graph-extracted", name: "Canonical Carrier Graph Extracted", experience: "The caller receives one canonical graph and exact extraction receipt with no carrier bytes.", product: { id: "extracted-semantic-carrier-graph", name: "Extracted Semantic Carrier Graph", contractRef: "semantic-carrier-extraction-result.v1" }, terminal: true, terminalDisposition: "EXTRACTED", gherkin: "EXTRACTED is returned with carrier blackout" }, routes: [],
    },
    {
      id: "return-extraction-held", name: "Return extraction held",
      input: { id: "held-extraction-stage", name: "Held Extraction Stage", contractRef: "semantic-carrier-extraction-stage.v1", gherkin: "attributable validator-receipt, binding, or graph-extraction findings" },
      event: { id: "bind-extraction-held-receipt", name: "Bind Extraction Held Receipt", responsibility: "Return ordered attributable findings without a graph completion claim.", gherkin: "the extraction-held receipt is returned", execution: { operations: [{ id: "emit-extraction-held-receipt", name: "Emit Extraction Held Receipt", predecessorRefs: [], mechanicRefs: [], providerBoundaryRefs: [], effectRefs: [] }], mechanics: [], providerBoundaries: [], effects: [] } },
      outcome: { id: "semantic-carrier-extraction-held", name: "Semantic Carrier Extraction Held", experience: "The caller receives exact held evidence and no graph completion claim.", product: { id: "held-semantic-carrier-extraction", name: "Held Semantic Carrier Extraction", contractRef: "semantic-carrier-extraction-result.v1" }, terminal: true, terminalDisposition: "EXTRACTION_HELD", gherkin: "EXTRACTION_HELD is returned with ordered findings" }, routes: [],
    },
  ],
});

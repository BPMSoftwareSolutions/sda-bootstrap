import { defineManagedCapability } from "../src/managed-carrier.js";

export default defineManagedCapability({
  schemaVersion: "scenario-semantic-carrier.v3",
  capability: {
    id: "greet-by-name",
    name: "Greet By Name",
    version: "0.2.0-candidate",
    rootExperience: "personalized-greeting-from-name",
    terminalDispositions: ["COMPLETED"],
  },
  feature: {
    id: "greet-by-name",
    name: "Construct a greeting from one name input",
  },
  contracts: [
    {
      id: "personal-greeting-request.v1",
      name: "Personal Greeting Request v1",
      kind: "data",
      shape: {
        type: "object",
        description: "One admitted non-empty person name of at most 100 Unicode characters.",
      },
    },
    {
      id: "personal-greeting.v1",
      name: "Personal Greeting v1",
      kind: "product",
      shape: {
        type: "object",
        description: "One deterministic message formatted as Hello, {name}! from the exact admitted name.",
      },
    },
  ],
  scenarios: [
    {
      id: "greet-by-name",
      name: "Greet a caller by name",
      input: {
        id: "personal-greeting-request",
        name: "Personal Greeting Request",
        contractRef: "personal-greeting-request.v1",
        gherkin: "one admitted non-empty person name",
      },
      event: {
        id: "greet-by-name",
        name: "Greet By Name",
        responsibility: "Construct exactly Hello, {name}! from the admitted name without invoking an external effect.",
        gherkin: "a personalized greeting is requested",
        execution: {
          operations: [
            {
              id: "construct-personal-greeting",
              name: "Construct Personal Greeting",
              predecessorRefs: [],
              mechanicRefs: ["format-personal-greeting"],
              providerBoundaryRefs: [],
              effectRefs: [],
            },
          ],
          mechanics: [
            {
              id: "format-personal-greeting",
              name: "Format Personal Greeting",
              kind: "native",
              config: {
                transformationRef: "greet-by-name-transform.v1",
                template: "Hello, {name}!",
                nameSource: "input.payload.name",
                externalEffects: false,
              },
            },
          ],
          providerBoundaries: [],
          effects: [],
        },
      },
      outcome: {
        id: "personal-greeting",
        name: "Personal Greeting",
        experience: "The caller receives a deterministic greeting constructed from the exact admitted name.",
        product: {
          id: "personal-greeting",
          name: "Personal Greeting",
          contractRef: "personal-greeting.v1",
        },
        terminal: true,
        terminalDisposition: "COMPLETED",
        gherkin: "the exact greeting Hello, {name}! is returned without an external effect",
      },
      routes: [],
    },
  ],
  management: {
    profile: "sidefx-managed-capability.v1",
    workspaceProfile: "agentic-harness-local.v1",
    featureDescription: "A caller supplies one admitted name and receives one deterministic personalized greeting without an external effect.",
    userStory: {
      actor: "caller",
      intent: "request a personalized greeting by supplying one admitted name",
      outcome: "receive a deterministic greeting constructed from that exact name",
    },
    experience: {
      experienceId: "personalized-greeting-from-name.v1",
      actor: "caller",
      promise: "every admitted execution constructs exactly Hello, {name}! from the admitted name without external effects",
      observableConditions: [
        "one-name-input-required",
        "input-name-preserved-in-greeting",
        "deterministic-greeting-format",
        "no-external-effect-invoked",
      ],
    },
    projectionTargets: ["node"],
    interface: {
      interfaceId: "greet-by-name-cli",
      kind: "cli",
      platformCapabilityId: "sda-json-cli.v1",
    },
    requiredPlatformObligations: [
      "dynamic-semantic-execution",
      "domain-contract-admission",
    ],
    contractSchemas: [
      {
        contractRef: "personal-greeting-request.v1",
        fileName: "input.schema.json",
        schema: {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "https://schemas.agentic-harness.local/contracts/personal-greeting-request.v1.schema.json",
          type: "object",
          additionalProperties: false,
          required: ["contractId", "payload"],
          properties: {
            contractId: { const: "personal-greeting-request.v1" },
            payload: {
              type: "object",
              additionalProperties: false,
              required: ["name"],
              properties: {
                name: { type: "string", minLength: 1, maxLength: 100 },
              },
            },
          },
        },
      },
      {
        contractRef: "personal-greeting.v1",
        fileName: "outcome.schema.json",
        schema: {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "https://schemas.agentic-harness.local/contracts/personal-greeting.v1.schema.json",
          type: "object",
          additionalProperties: false,
          required: ["contractId", "payload"],
          properties: {
            contractId: { const: "personal-greeting.v1" },
            payload: {
              type: "object",
              additionalProperties: false,
              required: ["message"],
              properties: {
                message: { type: "string" },
              },
            },
          },
        },
      },
    ],
    transformations: [
      {
        id: "greet-by-name-transform.v1",
        expression: {
          op: "object",
          fields: {
            contractId: { op: "literal", value: "personal-greeting.v1" },
            payload: {
              op: "object",
              fields: {
                message: {
                  op: "format",
                  template: "Hello, {name}!",
                  values: {
                    name: { op: "path", from: "input", path: "payload.name" },
                  },
                },
              },
            },
          },
        },
      },
    ],
    eventBindings: [
      {
        eventRef: "greet-by-name",
        authorityId: "greet-by-name.v1",
        portId: "greet-by-name-port",
        platformCapabilityId: "sda-authority-transformation-port.v1",
        transformationRef: "greet-by-name-transform.v1",
      },
    ],
    routeBindings: [],
    routeGroups: [],
    fixtures: [
      {
        fixtureId: "constructs-greeting-for-sidney",
        input: {
          contractId: "personal-greeting-request.v1",
          payload: { name: "Sidney" },
        },
        expected: {
          disposition: "terminated",
          terminalScenarioId: "greet-by-name",
          scenarioSequence: ["greet-by-name"],
          outcomeAssertions: [
            { conditionId: "exact-contract", path: "contractId", operator: "equals", value: "personal-greeting.v1" },
            { conditionId: "exact-message", path: "payload.message", operator: "equals", value: "Hello, Sidney!" },
          ],
        },
      },
      {
        fixtureId: "preserves-multibyte-name",
        input: {
          contractId: "personal-greeting-request.v1",
          payload: { name: "Zoë" },
        },
        expected: {
          disposition: "terminated",
          terminalScenarioId: "greet-by-name",
          scenarioSequence: ["greet-by-name"],
          outcomeAssertions: [
            { conditionId: "exact-contract", path: "contractId", operator: "equals", value: "personal-greeting.v1" },
            { conditionId: "exact-message", path: "payload.message", operator: "equals", value: "Hello, Zoë!" },
          ],
        },
      },
    ],
    precedents: [
      {
        authorityId: "greet-by-name-published-capsule.v1",
        digest: "sha256:4ac70805f02ce3a57a24abe97bfcd4d5b9ea6423e19f9ae75102e8ed2563d323",
      },
      {
        authorityId: "sda-platform-capabilities.v1",
        digest: "sha256:0026ab28dd63fd04e73db75fdbaf12580c0e8931cff883445411ccdce44a8871",
      },
    ],
    realizations: [
      {
        obligationId: "one-name-input-required",
        finalPath: "input.payload.name",
        semantics: { type: "string", optionality: "required", cardinality: "one", encoding: "unicode-text", unit: "character-sequence" },
        source: "INPUT",
        authority: { authorityId: "greet-by-name-published-capsule.v1", digest: "sha256:4ac70805f02ce3a57a24abe97bfcd4d5b9ea6423e19f9ae75102e8ed2563d323" },
        sourcePath: "input.payload.name",
        derivation: [],
        targetSupport: [{ authorityId: "sda-platform-capabilities.v1", digest: "sha256:0026ab28dd63fd04e73db75fdbaf12580c0e8931cff883445411ccdce44a8871" }],
        effectEvidence: "Input contract admission rejects absent and empty names before execution.",
        falsification: [{ input: {} }, { input: { name: "" } }, { input: { name: "Ada" } }],
      },
      {
        obligationId: "input-name-preserved-in-greeting",
        finalPath: "outcome.payload.message",
        semantics: { type: "string", optionality: "required", cardinality: "one", encoding: "unicode-text", unit: "character-sequence" },
        source: "DERIVATION",
        authority: { authorityId: "greet-by-name-published-capsule.v1", digest: "sha256:4ac70805f02ce3a57a24abe97bfcd4d5b9ea6423e19f9ae75102e8ed2563d323" },
        sourcePath: "input.payload.name",
        derivation: ["greet-by-name-transform.v1", "format:Hello, {name}!"],
        targetSupport: [{ authorityId: "sda-platform-capabilities.v1", digest: "sha256:0026ab28dd63fd04e73db75fdbaf12580c0e8931cff883445411ccdce44a8871" }],
        effectEvidence: "The admitted format expression reads the exact name path once.",
        falsification: [{ name: "Sidney", expected: "Hello, Sidney!" }, { name: "Zoë", expected: "Hello, Zoë!" }],
      },
      {
        obligationId: "deterministic-greeting-format",
        finalPath: "observableCondition.deterministic-greeting-format",
        semantics: { type: "string", optionality: "required", cardinality: "one", encoding: "unicode-text", unit: "character-sequence" },
        source: "DERIVATION",
        authority: { authorityId: "greet-by-name-published-capsule.v1", digest: "sha256:4ac70805f02ce3a57a24abe97bfcd4d5b9ea6423e19f9ae75102e8ed2563d323" },
        sourcePath: "management.transformations.greet-by-name-transform.v1",
        derivation: ["literal-prefix:Hello, ", "input-path:payload.name", "literal-suffix:!"],
        targetSupport: [{ authorityId: "sda-platform-capabilities.v1", digest: "sha256:0026ab28dd63fd04e73db75fdbaf12580c0e8931cff883445411ccdce44a8871" }],
        effectEvidence: "Two identical inputs must produce byte-identical JSON outcomes.",
        falsification: [{ replay: 2, name: "Ada", expected: "Hello, Ada!" }],
      },
      {
        obligationId: "no-external-effect-invoked",
        finalPath: "event.execution.effects",
        semantics: { type: "array", optionality: "required", cardinality: "zero", encoding: "canonical-json", unit: "effect-count" },
        source: "CONSTANT",
        authority: { authorityId: "greet-by-name-published-capsule.v1", digest: "sha256:4ac70805f02ce3a57a24abe97bfcd4d5b9ea6423e19f9ae75102e8ed2563d323" },
        sourcePath: "scenarios.greet-by-name.event.execution.effects",
        derivation: [],
        targetSupport: [{ authorityId: "sda-platform-capabilities.v1", digest: "sha256:0026ab28dd63fd04e73db75fdbaf12580c0e8931cff883445411ccdce44a8871" }],
        effectEvidence: "The carrier declares zero effects and zero provider boundaries; the projected plan must bind only the pure transformation port.",
        falsification: [{ forbiddenPortKind: "effect" }, { expectedEffectCount: 0 }],
      },
    ],
    authorities: {
      architecture: { authorityId: "adr-001.v1", digest: "sha256:1299d2b7f0808b5c17842cedf132f41dd1276825441f032dbfa29d73ee36e1ee" },
      blueprintBinding: { authorityId: "adr-001-blueprint-binding.v1", digest: "sha256:1299d2b7f0808b5c17842cedf132f41dd1276825441f032dbfa29d73ee36e1ee" },
      observability: { authorityId: "adr-001-observability.v1", digest: "sha256:1299d2b7f0808b5c17842cedf132f41dd1276825441f032dbfa29d73ee36e1ee" },
      structuralMapping: { authorityId: "adr-001-structural-mapping.v1", digest: "sha256:1299d2b7f0808b5c17842cedf132f41dd1276825441f032dbfa29d73ee36e1ee" },
      serviceLevel: { authorityId: "adr-001-slo-authority-law.v1", digest: "sha256:1299d2b7f0808b5c17842cedf132f41dd1276825441f032dbfa29d73ee36e1ee" },
      crossApply: { authorityId: "adr-001-cross-apply.v1", digest: "sha256:1299d2b7f0808b5c17842cedf132f41dd1276825441f032dbfa29d73ee36e1ee" },
      asciiProjection: { authorityId: "sidefx-circuit-blueprint-ascii.v1", digest: "sha256:24d519356f8042619c643766167c93f9203ae3b5c5802d91352765c0b64252b5" },
      mermaidProjection: { authorityId: "sidefx-circuit-blueprint-mermaid.v1", digest: "sha256:6b6f13774f46f7b01c863c4b7b3f42b662e579a38dabe524e5b1c204482d98ab" },
    },
  },
});

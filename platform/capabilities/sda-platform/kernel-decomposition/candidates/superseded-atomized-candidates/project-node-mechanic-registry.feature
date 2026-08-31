@capability:project-node-mechanic-registry
@root-scenario:project-node-mechanic-registry
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#createNodeMechanicRegistry
Feature: Project the Node mechanic registry from admitted provider authority

  Adding a platform mechanic should be an act of admission, not an act of
  editing a source file. Today it is the second: a hand-written map enumerates
  every event port, which makes that file a shadow platform authority and makes
  every new mechanic a source-control event rather than a governed one.

  This capability inverts that. The admitted platform capability catalog and its
  provider bindings become the input, and the Node registry becomes a generated
  projection carrying the ordinary marks — projector identity, authority digest,
  input digest, artifact digest, and a do-not-edit marker.

  One property matters more than the generation itself, and it is the reason
  this capability exists. Each provider authority must pin only its own provider
  module, never the shared registry artifact. While authorities pin the shared
  registry, admitting any new mechanic changes a digest that every prior
  provider depends on, which invalidates every existing admission at once and
  cascades into decisions that must remain immutable. Projecting the registry
  without repinning would reproduce that coupling in generated form; repinning
  is what actually removes it.

  @scenario:project-node-mechanic-registry
  @input:node-mechanic-registry-projection-request
  @input-contract:node-mechanic-registry-projection-request.v1
  @event:node-mechanic-registry-projection-requested
  @event-authority:project-node-mechanic-registry.v1
  @outcome:node-mechanic-registry-projection
  @outcome-contract:node-mechanic-registry-projection.v1
  @outcome-terminal
  Scenario: Generate the registry so that admitting a mechanic disturbs no prior admission
    Given the admitted platform capability catalog, its provider bindings, and each provider pinning only its own module
    When the Node mechanic registry is projected from that authority
    Then the generated registry carries projector, authority, input, and artifact digests with a do-not-edit marker, and admitting a new mechanic changes no digest that any prior provider authority pins

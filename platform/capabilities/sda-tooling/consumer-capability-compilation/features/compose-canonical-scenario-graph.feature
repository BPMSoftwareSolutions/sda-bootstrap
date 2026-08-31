@capability:compose-canonical-scenario-graph
@root-scenario:compose-canonical-scenario-graph
# Legacy source: scenario-driven-architecture/tools/src/capabilities/consumer-capability-compilation/compose-canonical-scenario-graph/provider.ts
Feature: Compose canonical scenario graph

  A consumer author needs admitted Gherkin bindings and declared transitions
  composed into one canonical, traceable capability graph before any platform
  responsibility is resolved. The capability takes only admitted consumer
  authority as input and produces the single coherent behavioral graph that
  every later compilation stage depends on.

  Every scenario and transition in the resulting graph is explicit, valid,
  and traceable to the admitted authority that produced it; nothing is
  inferred or synthesized beyond what was declared. The capability does not
  resolve platform mechanics, plan artifacts, or publish anything — it only
  composes meaning that already exists in admitted authority.

  @scenario:compose-canonical-scenario-graph
  @input:admitted-consumer-authority
  @input-contract:compose-canonical-scenario-graph-input.v1
  @event:canonical-scenario-composition-requested
  @event-authority:canonical-consumer-scenario-composition.v1
  @outcome:canonical-scenario-graph-known
  @outcome-contract:canonical-consumer-scenario-graph-evidence.v1
  @outcome-terminal
  Scenario: Compose one traceable canonical scenario graph from admitted authority
    Given one set of admitted consumer authority documents
    When admitted Gherkin bindings and declared transitions are composed into one canonical consumer capability graph
    Then every scenario and transition is explicit, valid, and traceable to its admitted source with complete lineage, and no platform responsibility is resolved or artifact is planned

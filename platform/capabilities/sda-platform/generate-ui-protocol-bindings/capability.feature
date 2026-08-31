@capability:generate-ui-protocol-bindings
@root-scenario:generate-v3-ui-protocol-bindings
Feature: Generate UI protocol bindings from one canonical model

  @scenario:generate-v3-ui-protocol-bindings
  @input:ui-protocol-binding-model
  @input-contract:ui-protocol-binding-model.v1
  @event:generate-ui-protocol-bindings
  @outcome:generated-ui-protocol-bindings
  @outcome-terminal
  Scenario: Generate all language bindings
    Given one digest-bound v3 protocol binding model
    When bindings are generated for every registered language ecosystem
    Then TypeScript, C#, Java, Kotlin, Swift, C++, Python, and Go receive deterministic native contract sources

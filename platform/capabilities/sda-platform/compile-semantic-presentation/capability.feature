@capability:compile-semantic-presentation
@root-scenario:compile-canonical-semantic-presentation
Feature: Compile semantic presentation into normalized mechanics

  One admitted canonical semantic presentation is lowered deterministically
  into framework-neutral normalized presentation mechanics. The compiler owns
  no consumer meaning, provider selection, target framework, native control,
  physical host, or implicit presentation default.

  Unsupported or ambiguous semantic intent is returned as stable findings.
  Compilation cannot invent mechanics merely to produce an output.

  @scenario:compile-canonical-semantic-presentation
  @input:canonical-semantic-presentation
  @input-contract:sda-ui-semantic-presentation.v1
  @event:compile-semantic-presentation
  @event-authority:compile-semantic-presentation.v1
  @outcome:normalized-presentation-compilation-evidence
  @outcome-contract:semantic-presentation-compilation-evidence.v1
  @outcome-terminal
  Scenario: Compile one semantic presentation
    Given one admitted canonical semantic presentation and digest-bound compiler authority
    When its semantic relationships, interactions, adaptations, accessibility obligations, and profile references are lowered
    Then one canonical v3 presentation IR or stable rejection findings are returned without target selection or semantic invention

@capability:project-activation-binding
@root-scenario:project-activation-binding
Feature: Project activation binding

  A presentation capability projector needs one portable activation fact that
  retains the declared semantic element, semantic event, trigger, mechanic, and
  source lineage without choosing a framework callback or command API.

  @scenario:project-activation-binding
  @input:activation-binding-projection-facts
  @input-contract:project-activation-binding-input.v1
  @event:activation-binding-projection-requested
  @event-authority:activation-binding-projection.v1
  @outcome:activation-binding-projection-known
  @outcome-contract:activation-binding-projection-evidence.v1
  @outcome-terminal
  Scenario: Preserve activation semantics for multi-language projection
    Given one admitted activation instruction and its resolved capability binding
    When activation binding is projected
    Then its element, semantic event, trigger, mechanic, and lineage facts are preserved without a language callback decision

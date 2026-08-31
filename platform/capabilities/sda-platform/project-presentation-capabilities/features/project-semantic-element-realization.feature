@capability:project-semantic-element-realization
@root-scenario:project-semantic-element-realization
Feature: Project semantic element realization

  A presentation capability projector needs to preserve one declared semantic
  element as a target-neutral realization fact before any language renderer is
  selected. Semantic kind, role, content indirection, state references, event
  references, and source lineage remain unchanged and no native control name is
  invented.

  @scenario:project-semantic-element-realization
  @input:semantic-element-realization-facts
  @input-contract:project-semantic-element-realization-input.v1
  @event:semantic-element-realization-projection-requested
  @event-authority:semantic-element-realization-projection.v1
  @outcome:semantic-element-realization-projection-known
  @outcome-contract:semantic-element-realization-projection-evidence.v1
  @outcome-terminal
  Scenario: Preserve one semantic element for multi-language projection
    Given one admitted semantic element instruction and its resolved capability binding
    When semantic element realization is projected
    Then its kind, role, content, state, event, mechanic, and lineage facts are preserved without a language or native-control decision

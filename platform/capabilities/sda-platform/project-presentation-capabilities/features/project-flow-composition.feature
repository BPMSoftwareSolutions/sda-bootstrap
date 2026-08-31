@capability:project-flow-composition
@root-scenario:project-flow-composition
Feature: Project flow composition

  A presentation capability projector needs one portable flow-composition fact
  that retains axis, direction, wrapping, child nodes, semantic elements,
  mechanic binding, and source lineage without selecting a target container.

  @scenario:project-flow-composition
  @input:flow-composition-projection-facts
  @input-contract:project-flow-composition-input.v1
  @event:flow-composition-projection-requested
  @event-authority:flow-composition-projection.v1
  @outcome:flow-composition-projection-known
  @outcome-contract:flow-composition-projection-evidence.v1
  @outcome-terminal
  Scenario: Preserve flow mechanics for multi-language projection
    Given one admitted flow-composition instruction and its resolved capability binding
    When flow composition is projected
    Then its axis, direction, wrapping, children, elements, mechanic, and lineage facts are preserved without a language container decision

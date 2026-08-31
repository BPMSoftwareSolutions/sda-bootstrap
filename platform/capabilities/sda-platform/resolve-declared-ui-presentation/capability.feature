@capability:resolve-declared-ui-presentation
@root-scenario:produce-canonical-semantic-presentation
@authoring-profile:consumer-presentation-authority.v1
Feature: Resolve declared UI presentation

  User-interface presentation is derived only from admitted declarative UI
  authority. Nothing becomes part of the semantic presentation unless it is
  justified by declared information, interaction, experience, accessibility,
  adaptation, or presentation-profile authority.

  This capability is independent of every programming language, UI framework,
  markup language, rendering toolkit, operating system, control, and physical
  layout mechanism. An undeclared presentation fact remains absent.

  @scenario:produce-canonical-semantic-presentation
  @input:declared-ui-authority
  @input-contract:declared-ui-authority.v1
  @event:resolve-declared-ui-presentation
  @event-authority:resolve-declared-ui-presentation.v1
  @outcome:canonical-semantic-presentation
  @outcome-contract:sda-ui-semantic-presentation.v1
  @outcome-terminal
  Scenario: Produce canonical semantic presentation
    Given admitted declarative UI authority
    When its presentation meaning is resolved
    Then one canonical semantic presentation contains only justified, framework-neutral meaning

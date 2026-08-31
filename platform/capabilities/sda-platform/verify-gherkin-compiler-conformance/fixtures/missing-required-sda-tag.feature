@capability:fixture-missing-required-tag
@root-scenario:missing-event-authority
Feature: Missing required SDA tag

  @scenario:missing-event-authority
  @input:source-document
  @input-contract:canonical-gherkin-source.v1
  @event:source-document-received
  @outcome:annotation-rejected
  @outcome-contract:gherkin-annotation-result.v1
  @outcome-terminal
  Scenario: Reject a scenario without event authority
    Given one source document
    When annotations are evaluated
    Then a source-located rejection is returned

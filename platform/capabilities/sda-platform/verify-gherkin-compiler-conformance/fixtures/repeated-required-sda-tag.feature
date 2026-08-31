@capability:fixture-repeated-required-tag
@root-scenario:repeated-event-authority
Feature: Repeated required SDA tag

  @scenario:repeated-event-authority
  @input:source-document
  @input-contract:canonical-gherkin-source.v1
  @event:source-document-received
  @event-authority:first-event-authority.v1
  @event-authority:second-event-authority.v1
  @outcome:annotation-rejected
  @outcome-contract:gherkin-annotation-result.v1
  @outcome-terminal
  Scenario: Reject repeated singleton event authority
    Given one source document
    When annotations are evaluated
    Then both event authority occurrences are reported

@capability:fixture-forbidden-semantic-tags
@root-scenario:reject-forbidden-semantic-tags
Feature: Forbidden semantic tags

  @scenario:reject-forbidden-semantic-tags
  @input:source-document
  @input-contract:canonical-gherkin-source.v1
  @event:source-document-received
  @event-authority:reject-forbidden-semantic-tags.v1
  @outcome:annotation-rejected
  @outcome-contract:gherkin-annotation-result.v1
  @outcome-terminal
  @provider:example-provider
  @framework:example-framework
  @endpoint:https://example.invalid/semantic
  @executable:run-this-command
  Scenario: Reject implementation authority in semantic tags
    Given one source document
    When annotations are evaluated
    Then every forbidden tag is reported at its source location

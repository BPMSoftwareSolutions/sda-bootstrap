@capability:fixture-basic-annotated-sda
@root-scenario:accept-annotated-sda-fixture
Feature: Basic annotated SDA feature

  @scenario:accept-annotated-sda-fixture
  @input:source-document
  @input-contract:canonical-gherkin-source.v1
  @event:source-document-received
  @event-authority:accept-annotated-sda-fixture.v1
  @outcome:annotated-source-accepted
  @outcome-contract:gherkin-annotation-result.v1
  @outcome-terminal
  Scenario: Accept one annotated SDA source document
    Given one canonical source document
    When its SDA annotations are evaluated
    Then an annotated source result is returned

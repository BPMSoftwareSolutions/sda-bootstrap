@capability:fixture-reordered-discovery-a
@root-scenario:reproduction-first
Feature: Reordered discovery reproduction A

  @scenario:reproduction-first
  @input:reproduction-source
  @input-contract:canonical-gherkin-source.v1
  @event:reproduction-source-received
  @event-authority:reproduction-first.v1
  @outcome:reproduction-result
  @outcome-contract:gherkin-compilation-result.v1
  @outcome-terminal
  Scenario: Compile the first discovery member
    Given a deterministic source document
    When the corpus is discovered
    Then this member contributes its stable result

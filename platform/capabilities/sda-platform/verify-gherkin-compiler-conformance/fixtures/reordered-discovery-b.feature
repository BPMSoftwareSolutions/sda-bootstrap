@capability:fixture-reordered-discovery-b
@root-scenario:reproduction-second
Feature: Reordered discovery reproduction B

  @scenario:reproduction-second
  @input:reproduction-source
  @input-contract:canonical-gherkin-source.v1
  @event:reproduction-source-received
  @event-authority:reproduction-second.v1
  @outcome:reproduction-result
  @outcome-contract:gherkin-compilation-result.v1
  @outcome-terminal
  Scenario: Compile the second discovery member
    Given a deterministic source document
    When the corpus is discovered
    Then this member contributes its stable result

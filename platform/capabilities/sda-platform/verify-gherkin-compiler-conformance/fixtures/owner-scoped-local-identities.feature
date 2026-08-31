@capability:fixture-owner-scoped-local-identities
@root-scenario:first-owner
Feature: Owner-scoped local semantic identities

  @scenario:first-owner
  @input:shared-local-input
  @input-contract:shared-local-contract.v1
  @event:first-owner-received
  @event-authority:first-owner.v1
  @outcome:shared-local-outcome
  @outcome-contract:shared-local-outcome-contract.v1
  @outcome-terminal
  Scenario: Preserve the first owner local IDs
    Given the first scenario owner
    When its local identities are bound
    Then its local input and contract remain owned by the first scenario

  @scenario:second-owner
  @input:shared-local-input
  @input-contract:shared-local-contract.v1
  @event:second-owner-received
  @event-authority:second-owner.v1
  @outcome:shared-local-outcome
  @outcome-contract:shared-local-outcome-contract.v1
  @outcome-terminal
  Scenario: Preserve the second owner local IDs
    Given the second scenario owner
    When its local identities are bound
    Then its local input and contract remain owned by the second scenario

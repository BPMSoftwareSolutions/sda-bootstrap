Feature: Bind scenario semantic carrier validation

  Scenario: Validate a literal scenario semantic carrier without executing it
    Given exact carrier source bytes and a safe relative source identity
    And the admitted scenario semantic carrier grammar is digest-bound
    When the scenario semantic carrier validation port is invoked
    Then only the exported literal carrier object is observed
    And schema and semantic-reference closure are evaluated
    And the result is a deterministic conformant or not-conformant receipt

  Scenario: Reject hidden executable meaning
    Given carrier source containing calls, functions, computed values, or other executable meaning
    When the scenario semantic carrier validation port is invoked
    Then the carrier is not admitted
    And deterministic findings identify the rejected meaning

  Scenario: Preserve validator responsibility boundaries
    Given a conformant scenario semantic carrier
    When validation completes
    Then no canonical graph is extracted
    And no projection or provider resolution is performed

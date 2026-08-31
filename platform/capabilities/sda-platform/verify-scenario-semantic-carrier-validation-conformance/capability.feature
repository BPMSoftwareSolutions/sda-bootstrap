Feature: Verify scenario semantic carrier validation conformance

  Scenario: Admit a conformant literal carrier
    Given a fixture that exports exactly one literal scenario semantic carrier
    When the admitted Node validation provider evaluates the exact source bytes
    Then the carrier is conformant
    And the validation receipt is deterministic

  Scenario: Reject hidden executable meaning
    Given a carrier fixture whose exported value includes executable meaning
    When the admitted Node validation provider evaluates the exact source bytes
    Then the carrier is not conformant
    And hidden executable meaning is identified

  Scenario: Reject unresolved semantic references
    Given a literal carrier fixture with an unresolved contract reference
    When the admitted Node validation provider evaluates the exact source bytes
    Then the carrier is not conformant
    And the unresolved identity is identified

  Scenario: Prove the real runtime registration seam
    Given the admitted Node mechanic registry
    When the scenario semantic carrier validation event port is resolved and invoked
    Then the registered provider returns the same deterministic receipt

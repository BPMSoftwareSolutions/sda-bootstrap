@platform-capability-conformance:sda-scenario-semantic-carrier-extraction-port.v1
Feature: Prove canonical Scenario Semantic Carrier graph extraction

  Scenario: Prove deterministic graph extraction and blackout
    Given the admitted extractor provider, exact contracts, and governed fixtures
    When provider conformance executes twice and through the real registry
    Then graph bytes and receipts are identical and carrier bytes are unreachable downstream

  Scenario: Prove fail-closed lineage enforcement
    Given changed carrier bytes or an altered validator receipt
    When extraction is attempted
    Then extraction is held before graph creation with ordered attributable findings

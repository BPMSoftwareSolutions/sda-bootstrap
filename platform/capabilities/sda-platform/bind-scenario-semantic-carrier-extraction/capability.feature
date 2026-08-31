@platform-capability:sda-scenario-semantic-carrier-extraction-port.v1
Feature: Bind canonical Scenario Semantic Carrier graph extraction

  Exact carrier bytes with their exact conformant validator receipt become one canonical v2 or management-preserving v3 graph and extraction receipt before carrier blackout.

  Scenario: Extract one validated carrier
    Given exact carrier bytes and their exact conformant validator receipt
    When the canonical graph extraction provider is invoked
    Then one graph-bound EXTRACTED receipt is returned without carrier bytes

  Scenario: Hold mismatched validation lineage
    Given carrier bytes or validator receipt lineage that do not match
    When the canonical graph extraction provider is invoked
    Then EXTRACTION_HELD is returned without a graph completion claim

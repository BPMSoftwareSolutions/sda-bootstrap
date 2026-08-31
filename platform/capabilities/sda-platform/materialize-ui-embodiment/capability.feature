@sda-platform @ui-presentation @phase-h
Feature: Materialize a UI embodiment plan
  As the UI presentation platform
  I want reference providers to consume only a closed embodiment plan
  So that semantic authority remains above target-specific construction APIs

  Scenario: Apply one plan through a reference provider
    Given a digest-bound ui-embodiment-plan.v1
    And a provider admitted for the selected target kind
    When the provider applies every plan instruction
    Then semantic elements, composition, events, accessibility, and adaptation are projected without reopening source authority
    And structural testimony remains bound to the plan and provider digests

  Scenario: Reject an incomplete composition
    Given an embodiment plan whose root or element references cannot be resolved
    When a reference provider applies the plan
    Then projection fails without inventing a target-owned element, copy, or layout recipe

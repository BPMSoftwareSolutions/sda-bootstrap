@platform-capability:sda-scenario-semantic-carrier-evaluation-port.v1
Feature: Adjudicate independently manufactured Semantic Carrier compilation evidence

  Scenario: Admit an ordinary proof-complete subject
    Given complete graph-bound evidence manufactured outside the evaluator
    When the semantic-carrier evaluator is invoked
    Then REVIEW_READY_NON_EVALUATOR_SUBJECT is returned

  Scenario: Hold incomplete or divergent evidence
    Given missing, failing, divergent, or evaluator-manufactured evidence
    When the semantic-carrier evaluator is invoked
    Then EVALUATION_HELD is returned with ordered attributable findings

  Scenario: Divert evaluator replacement
    Given complete graph-bound evidence whose subject is the evaluator replacement
    When the semantic-carrier evaluator is invoked
    Then EVALUATOR_REPLACEMENT_REQUIRES_INDEPENDENT_ADJUDICATION is returned

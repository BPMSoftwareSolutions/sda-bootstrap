@capability:bind-semantic-transformation-evaluation
@root-scenario:bind-semantic-transformation-evaluation
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#evaluateExpression
Feature: Evaluate admitted transformation authority against a canonical corpus

  This is the evaluator that gives every declarative transformation its meaning,
  which makes it the one mechanic that cannot be projected away. Expressing the
  evaluator as transformation authority would require the evaluator to evaluate
  its own definition, so its body stays an irreducible native provider in the
  same way a filesystem read does. It sits at the physical floor, not above it.

  What must stop being native is the *meaning*. Today a Node switch statement
  decides what map, filter, let, and sha256 mean, and no other target is held to
  that decision. This capability moves the semantics into a canonical
  per-operation conformance corpus that every language provider must satisfy
  identically, so the corpus decides and the provider conforms.

  It also fixes the vocabulary's edge. An operation the corpus does not declare
  is refused as a missing platform capability rather than approximated, which is
  the signal that the operation wants a mechanic of its own instead of one more
  entry in an ever-widening expression language.

  @scenario:bind-semantic-transformation-evaluation
  @input:semantic-transformation-evaluation-request
  @input-contract:semantic-transformation-evaluation-request.v1
  @event:semantic-transformation-evaluation-requested
  @event-authority:bind-semantic-transformation-evaluation.v1
  @outcome:semantic-transformation-evaluation-record
  @outcome-contract:semantic-transformation-evaluation-record.v1
  @outcome-terminal
  Scenario: Evaluate declared operations against canonical semantics and refuse the undeclared
    Given an admitted transformation expression, its input carrier, and the canonical per-operation semantics corpus
    When each declared operation is evaluated according to the corpus rather than to a target-specific implementation
    Then the evaluated value is returned, every target evaluating the same expression agrees, and an operation absent from the corpus is refused as a missing platform capability

@capability:bind-profile-governed-proof-binding-evaluation
@root-scenario:bind-profile-governed-proof-binding-evaluation
Feature: Bind profile-governed proof-binding evaluation

  A source-neutral provider composes an externally supplied admitted profile,
  declared evaluation contracts, subject binding candidates, and current admitted
  evidence under a deterministic evaluation order and canonical reproduction
  material. The provider does not own consumer-domain meaning and never derives a
  relationship from a prohibited basis.

  @scenario:bind-profile-governed-proof-binding-evaluation
  @input:profile-governed-proof-binding-evaluation-input
  @input-contract:profile-governed-proof-binding-evaluation-input.v1
  @event:profile-governed-proof-binding-evaluation-requested
  @event-authority:profile-governed-proof-binding-evaluator.v1
  @outcome:profile-governed-proof-binding-evaluation-record
  @outcome-contract:profile-governed-proof-binding-evaluation-record.v1
  @outcome-terminal
  Scenario: Compose current admitted proof-binding evidence
    Given an admitted proof-binding profile current subject binding candidates and current passing evidence
    When profile-governed evaluation applies the profile evaluation order
    Then one disposition-bound record satisfies the obligation without findings

  @scenario:hold-stale-or-mixed-proof-binding-lineage
  @input:profile-governed-proof-binding-evaluation-input
  @input-contract:profile-governed-proof-binding-evaluation-input.v1
  @event:stale-or-mixed-proof-binding-lineage-received
  @event-authority:profile-governed-proof-binding-evaluator.v1
  @outcome:open-profile-governed-proof-binding-evaluation-record
  @outcome-contract:profile-governed-proof-binding-evaluation-record.v1
  @outcome-terminal
  Scenario: Hold stale or mismatched proof-binding evidence
    Given required subject binding or evidence is absent or stale
    When profile-governed evaluation applies the profile evaluation order
    Then the obligation remains not observable without combining stale and current evidence

  @scenario:reject-prohibited-proof-binding-basis
  @input:profile-governed-proof-binding-evaluation-input
  @input-contract:profile-governed-proof-binding-evaluation-input.v1
  @event:prohibited-proof-binding-basis-requested
  @event-authority:profile-governed-proof-binding-evaluator.v1
  @outcome:rejected-profile-governed-proof-binding-evaluation-record
  @outcome-contract:profile-governed-proof-binding-evaluation-record.v1
  @outcome-terminal
  Scenario: Reject a prohibited proof-binding basis
    Given a binding candidate justified only by a prohibited basis or stale lineage
    When profile-governed evaluation evaluates the binding candidates
    Then the binding is rejected with the basis named and no relationship is derived

  @scenario:issue-content-addressed-proof-binding-evaluation-record
  @input:profile-governed-proof-binding-evaluation-input
  @input-contract:profile-governed-proof-binding-evaluation-input.v1
  @event:proof-binding-evaluation-record-requested
  @event-authority:profile-governed-proof-binding-evaluator.v1
  @outcome:profile-governed-proof-binding-evaluation-record
  @outcome-contract:profile-governed-proof-binding-evaluation-record.v1
  @outcome-terminal
  Scenario: Issue a content-addressed evaluation record
    Given complete ordered evaluation input and an admitted canonical material policy
    When evaluation record material is canonicalized and digested
    Then the record carries the ordered input digest and reproduction disposition and makes no provider-conformance claim

  @scenario:reproduce-profile-governed-proof-binding-evaluation
  @input:profile-governed-proof-binding-evaluation-input
  @input-contract:profile-governed-proof-binding-evaluation-input.v1
  @event:profile-governed-proof-binding-evaluation-reproduction-requested
  @event-authority:profile-governed-proof-binding-evaluator.v1
  @outcome:reproduced-profile-governed-proof-binding-evaluation-record
  @outcome-contract:profile-governed-proof-binding-evaluation-record.v1
  @outcome-terminal
  Scenario: Reproduce an evaluation record across discovery orders
    Given identical admitted profile contract input and two declared candidate discovery orders
    When independent evaluation attempts derive canonical candidate order and record material
    Then findings order and ordered input digest and record content match exactly
@capability:bind-execution-evidence-evaluation
@root-scenario:bind-execution-evidence-evaluation
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#expected-execution-trace.v1,artifact-binding-observation.v1,projected-origin-observation.v1
Feature: Reconcile expected execution facts against observed execution facts

  Conformance is set reconciliation, not inspection. This capability compares
  what an execution plan declared would happen against what telemetry recorded
  actually happened, and reports the difference rather than a verdict assembled
  from impressions. An expected step with no observed counterpart is a named
  missing relationship; an observed step outside the permitted set is a named
  unpermitted one.

  It carries the three evidence forms the runtime currently evaluates in place:
  expected-versus-observed execution trace, artifact binding observation, and
  projected origin observation. Keeping them here rather than in the kernel is
  what lets the same reconciliation run against any target's testimony, so
  cross-target equivalence becomes a query over normalized fact sets instead of
  a claim about implementations.

  @scenario:bind-execution-evidence-evaluation
  @input:execution-evidence-evaluation-request
  @input-contract:execution-evidence-evaluation-request.v1
  @event:execution-evidence-evaluation-requested
  @event-authority:bind-execution-evidence-evaluation.v1
  @outcome:execution-evidence-evaluation-record
  @outcome-contract:execution-evidence-evaluation-record.v1
  @outcome-terminal
  Scenario: Report the difference between expected and observed semantic facts
    Given the expected execution facts declared by a plan and the observed facts recorded by telemetry
    When the two fact sets are reconciled under the declared evidence evaluators
    Then expected facts with no observed counterpart and observed facts outside the permitted set are each named, and closure is reported only when both difference sets are empty

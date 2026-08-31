@capability:bind-governed-target-execution-observation
@root-scenario:bind-governed-target-execution-observation
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#observeGovernedTargetExecution
Feature: Observe a declared target execution without trusting its own report

  Running a target and believing whatever it prints is not evidence. This
  capability executes only declared targets with declared fixtures, bounds the
  execution, and then observes what actually changed rather than accepting the
  target's self-report. Exit status, captured streams, and artifact drift are
  each recorded separately, so a target that claims success while mutating an
  artifact it was not permitted to touch is visible as drift rather than as a
  pass.

  A target that is not declared is refused before any process is spawned.

  @scenario:bind-governed-target-execution-observation
  @input:governed-target-execution-observation-request
  @input-contract:governed-target-execution-observation-request.v1
  @event:governed-target-execution-observation-requested
  @event-authority:bind-governed-target-execution-observation.v1
  @outcome:governed-target-execution-observation
  @outcome-contract:governed-target-execution-observation.v1
  @outcome-terminal
  Scenario: Separate target self-report from observed change
    Given declared targets, declared fixtures, and the admitted execution bounds
    When each declared target is executed within its bounds and the resulting artifact state is observed independently
    Then execution testimony and observed artifact drift are reported separately and an undeclared target is refused before execution

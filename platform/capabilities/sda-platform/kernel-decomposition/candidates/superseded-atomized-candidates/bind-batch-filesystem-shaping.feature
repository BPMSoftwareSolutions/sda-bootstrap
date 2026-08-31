@capability:bind-batch-filesystem-shaping
@root-scenario:bind-batch-filesystem-shaping
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#invokeBatchFsShaper
Feature: Apply one declared batch of filesystem shaping operations

  A batch of filesystem changes is the easiest place for an estate to acquire
  files nobody declared. This capability applies only the operations a request
  declares, only beneath an admitted root, in the declared order, and reports
  each operation's outcome individually so a partially applied batch is visible
  as such rather than reported as a single success.

  The batch does not invent directories, does not remove what it was not asked
  to remove, and refuses any path that escapes the admitted root before applying
  any operation in the batch.

  @scenario:bind-batch-filesystem-shaping
  @input:batch-filesystem-shaping-request
  @input-contract:batch-filesystem-shaping-request.v1
  @event:batch-filesystem-shaping-requested
  @event-authority:bind-batch-filesystem-shaping.v1
  @outcome:batch-filesystem-shaping-observation
  @outcome-contract:batch-filesystem-shaping-observation.v1
  @outcome-terminal
  Scenario: Apply declared operations in order and report each outcome
    Given a declared batch of shaping operations beneath an admitted root
    When the batch is validated in full and then applied in declared order
    Then each operation reports its own outcome, a partially applied batch is visible as partial, and a path outside the admitted root refuses the batch before anything is applied

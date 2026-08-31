@capability:bind-projected-capability-invocation
@root-scenario:bind-projected-capability-invocation
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#sda-projected-capability-invocation-port.v1,v2
Feature: Invoke one projected capability under pinned identity

  Composition is where an estate silently drifts: a caller believes it invoked a
  particular capability, and nothing checks. This capability makes the belief
  verifiable. Before the nested capability runs, its application binding digest
  and its capability authority digest are both recomputed and compared to what
  the caller pinned, and a mismatch refuses the invocation rather than executing
  a different capability than the one that was admitted.

  It also keeps the nested execution honest about lineage. The nested run
  retains its own execution identity beneath the caller's root, so a composed
  circuit reads back as a tree of attributable executions rather than as one
  flat claim, and a recursive invocation is refused instead of being allowed to
  unwind at runtime.

  @scenario:bind-projected-capability-invocation
  @input:projected-capability-invocation-request
  @input-contract:projected-capability-invocation-request.v1
  @event:projected-capability-invocation-requested
  @event-authority:bind-projected-capability-invocation.v1
  @outcome:projected-capability-invocation-testimony
  @outcome-contract:projected-capability-invocation-testimony.v1
  @outcome-terminal
  Scenario: Refuse any invocation whose pinned identity does not recompute
    Given a pinned binding digest, a pinned capability authority digest, and the declared carrier path
    When both digests are recomputed before the nested capability is executed
    Then a mismatch refuses the invocation, a recursive invocation is refused, and a successful nested execution retains its own lineage beneath the caller's root

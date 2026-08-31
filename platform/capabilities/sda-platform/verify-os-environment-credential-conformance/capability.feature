@capability:verify-os-environment-credential-conformance
@root-scenario:verify-os-environment-credential-conformance
Feature: Verify the OS environment credential mechanic admission

  The governed model invocation needs its credential reference to resolve
  regardless of the process spawn environment. The mechanic declares a
  fixed resolution order — process environment, then operating-system user
  scope, then operating-system machine scope — with non-disclosure across
  every observable channel. This conformance capability checks that the
  mechanic is declared in the admitted effect family with its contracts and
  conformance references, that the node registry pins the current family
  digest, and that the per-language lowering is honestly held until the
  language projector admits it. No credential material appears in any
  authority or receipt.

  @scenario:verify-os-environment-credential-conformance
  @input:os-environment-credential-conformance-request
  @input-contract:os-environment-credential-conformance-request.v1
  @event:os-environment-credential-conformance-requested
  @event-authority:verify-os-environment-credential-conformance.v1
  @outcome:os-environment-credential-conformance
  @outcome-contract:os-environment-credential-conformance.v1
  @outcome-terminal
  Scenario: Verify the OS environment credential mechanic declaration and held lowering
    Given the admitted effect mechanic family and the node mechanic registry, each pinned by exact bytes
    When declaration, resolution order, non-disclosure, and lowering state are evaluated in order
    Then exactly one conformance disposition and its ordered partitions are retained, with the lowering held and named rather than approximated

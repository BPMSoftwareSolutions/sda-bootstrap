@capability:verify-proof-binding-evaluation-conformance
@root-scenario:verify-proof-binding-evaluation-conformance
Feature: Verify proof-binding evaluation provider conformance

  Provider conformance is a source-neutral platform claim. It is issued only
  when all twelve exact proof partitions are satisfied against current provider,
  authority, contract, and fixture identities. A proposed provider produces an
  open receipt rather than invented evidence.

  @scenario:verify-proof-binding-evaluation-conformance
  @input:proof-binding-evaluation-provider-conformance-request
  @input-contract:proof-binding-evaluation-provider-conformance-request.v1
  @event:proof-binding-evaluation-provider-conformance-requested
  @event-authority:verify-proof-binding-evaluation-conformance.v1
  @outcome:proof-binding-evaluation-provider-conformance
  @outcome-contract:proof-binding-evaluation-provider-conformance.v1
  @outcome-terminal
  Scenario: Satisfy every exact conformance partition
    Given current provider profile contracts and fixture evidence for all twelve required partitions
    When provider conformance is evaluated
    Then conformance is satisfied only when every partition is satisfied with attributable evidence and no findings

  @scenario:hold-unobservable-proof-binding-evaluation-provider
  @input:proof-binding-evaluation-provider-conformance-request
  @input-contract:proof-binding-evaluation-provider-conformance-request.v1
  @event:unobservable-proof-binding-evaluation-provider-received
  @event-authority:verify-proof-binding-evaluation-conformance.v1
  @outcome:open-proof-binding-evaluation-provider-conformance
  @outcome-contract:proof-binding-evaluation-provider-conformance.v1
  @outcome-terminal
  Scenario: Hold an absent or unobservable provider
    Given declarative profiles and fixtures but no executable provider proof
    When provider conformance is evaluated
    Then every unexecuted partition remains not observable and the receipt remains open

  @scenario:reject-failing-proof-binding-evaluation-provider
  @input:proof-binding-evaluation-provider-conformance-request
  @input-contract:proof-binding-evaluation-provider-conformance-request.v1
  @event:failing-proof-binding-evaluation-provider-received
  @event-authority:verify-proof-binding-evaluation-conformance.v1
  @outcome:rejected-proof-binding-evaluation-provider-conformance
  @outcome-contract:proof-binding-evaluation-provider-conformance.v1
  @outcome-terminal
  Scenario: Reject a provider with a failed partition
    Given attributable evidence that at least one required partition is not satisfied
    When provider conformance is evaluated
    Then the receipt is rejected with at least one typed finding and cannot claim conformance

  @scenario:reproduce-proof-binding-evaluation-provider-conformance
  @input:proof-binding-evaluation-provider-conformance-request
  @input-contract:proof-binding-evaluation-provider-conformance-request.v1
  @event:proof-binding-evaluation-provider-conformance-reproduction-requested
  @event-authority:verify-proof-binding-evaluation-conformance.v1
  @outcome:reproduced-proof-binding-evaluation-provider-conformance
  @outcome-contract:proof-binding-evaluation-provider-conformance.v1
  @outcome-terminal
  Scenario: Reproduce the provider conformance receipt
    Given identical current provider profile contract fixture and evidence digests
    When two independent conformance evaluations are performed
    Then partitions evidence order findings and receipt digest match exactly
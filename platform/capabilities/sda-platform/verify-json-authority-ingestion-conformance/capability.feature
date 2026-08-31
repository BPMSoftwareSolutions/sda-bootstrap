@capability:verify-json-authority-ingestion-conformance
@root-scenario:verify-json-authority-ingestion-conformance
Feature: Verify JSON authority ingestion provider conformance

  Provider conformance is a source-neutral platform claim. It is issued only
  when all twelve exact proof partitions are satisfied against current provider,
  authority, contract, and fixture identities. A proposed provider produces an
  open receipt rather than invented evidence.

  @scenario:verify-json-authority-ingestion-conformance
  @input:json-authority-ingestion-provider-conformance-request
  @input-contract:json-authority-ingestion-provider-conformance-request.v1
  @event:json-authority-ingestion-provider-conformance-requested
  @event-authority:verify-json-authority-ingestion-conformance.v1
  @outcome:json-authority-ingestion-provider-conformance
  @outcome-contract:json-authority-ingestion-provider-conformance.v1
  @outcome-terminal
  Scenario: Satisfy every exact conformance partition
    Given current provider subordinate authorities contracts and fixture evidence for all twelve required partitions
    When provider conformance is evaluated
    Then conformance is satisfied only when every partition is satisfied with attributable evidence and no findings

  @scenario:hold-unobservable-json-authority-ingestion-provider
  @input:json-authority-ingestion-provider-conformance-request
  @input-contract:json-authority-ingestion-provider-conformance-request.v1
  @event:unobservable-json-authority-ingestion-provider-received
  @event-authority:verify-json-authority-ingestion-conformance.v1
  @outcome:open-json-authority-ingestion-provider-conformance
  @outcome-contract:json-authority-ingestion-provider-conformance.v1
  @outcome-terminal
  Scenario: Hold an absent or unobservable provider
    Given declarative authorities and fixtures but no executable provider proof
    When provider conformance is evaluated
    Then every unexecuted partition remains not observable and the receipt remains open

  @scenario:reject-failing-json-authority-ingestion-provider
  @input:json-authority-ingestion-provider-conformance-request
  @input-contract:json-authority-ingestion-provider-conformance-request.v1
  @event:failing-json-authority-ingestion-provider-received
  @event-authority:verify-json-authority-ingestion-conformance.v1
  @outcome:rejected-json-authority-ingestion-provider-conformance
  @outcome-contract:json-authority-ingestion-provider-conformance.v1
  @outcome-terminal
  Scenario: Reject a provider with a failed partition
    Given attributable evidence that at least one required partition is not satisfied
    When provider conformance is evaluated
    Then the receipt is rejected with at least one typed finding and cannot claim conformance

  @scenario:reproduce-json-authority-ingestion-provider-conformance
  @input:json-authority-ingestion-provider-conformance-request
  @input-contract:json-authority-ingestion-provider-conformance-request.v1
  @event:json-authority-ingestion-provider-conformance-reproduction-requested
  @event-authority:verify-json-authority-ingestion-conformance.v1
  @outcome:reproduced-json-authority-ingestion-provider-conformance
  @outcome-contract:json-authority-ingestion-provider-conformance.v1
  @outcome-terminal
  Scenario: Reproduce the provider conformance receipt
    Given identical current provider authority contract fixture and evidence digests
    When two independent conformance evaluations are performed
    Then partitions evidence order findings and receipt digest match exactly

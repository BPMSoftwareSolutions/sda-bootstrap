@capability:bind-profile-governed-json-authority-ingestion
@root-scenario:bind-profile-governed-json-authority-ingestion
Feature: Bind profile-governed JSON authority ingestion

  A source-neutral provider composes exact-byte parsing, declared schema
  authority, admitted content-reference closure, classification constraints,
  and canonical receipt material under externally supplied admitted profiles and
  policies. The provider does not own consumer-domain meaning.

  @scenario:bind-profile-governed-json-authority-ingestion
  @input:profile-governed-json-authority-ingestion-request
  @input-contract:profile-governed-json-authority-ingestion-request.v1
  @event:profile-governed-json-authority-ingestion-requested
  @event-authority:profile-governed-json-authority-ingestor.v1
  @outcome:profile-governed-json-authority-ingestion-receipt
  @outcome-contract:profile-governed-json-authority-ingestion-receipt.v1
  @outcome-terminal
  Scenario: Compose current admitted ingestion evidence
    Given exact manifest profile policy schema scope parser resolver and provider authorities
    When profile-governed ingestion evaluates every declared resource
    Then one digest-bound receipt retains exact resource identity and only admits resources whose required closures are satisfied

  @scenario:hold-stale-json-ingestion-authority
  @input:profile-governed-json-authority-ingestion-request
  @input-contract:profile-governed-json-authority-ingestion-request.v1
  @event:stale-json-ingestion-authority-received
  @event-authority:profile-governed-json-authority-ingestor.v1
  @outcome:open-profile-governed-json-authority-ingestion-receipt
  @outcome-contract:profile-governed-json-authority-ingestion-receipt.v1
  @outcome-terminal
  Scenario: Hold stale or mismatched authority evidence
    Given any supplied digest does not match its exact manifest profile policy schema scope or subordinate authority
    When profile-governed ingestion evaluates the request
    Then the receipt remains open without combining stale and current evidence

  @scenario:reject-json-source-class-escalation
  @input:profile-governed-json-authority-ingestion-request
  @input-contract:profile-governed-json-authority-ingestion-request.v1
  @event:json-source-class-escalation-requested
  @event-authority:profile-governed-json-authority-ingestor.v1
  @outcome:rejected-profile-governed-json-authority-ingestion-receipt
  @outcome-contract:profile-governed-json-authority-ingestion-receipt.v1
  @outcome-terminal
  Scenario: Reject content-based source-class escalation
    Given evidence projection or testimony content that resembles canonical authority
    When profile-governed ingestion evaluates classification authority and content
    Then the original class is retained and an attempted escalation is rejected under the supplied profile

  @scenario:issue-content-addressed-json-ingestion-receipt
  @input:profile-governed-json-authority-ingestion-request
  @input-contract:profile-governed-json-authority-ingestion-request.v1
  @event:json-ingestion-receipt-requested
  @event-authority:profile-governed-json-authority-ingestor.v1
  @outcome:profile-governed-json-authority-ingestion-receipt
  @outcome-contract:profile-governed-json-authority-ingestion-receipt.v1
  @outcome-terminal
  Scenario: Issue a content-addressed operational receipt
    Given complete ordered resource evidence and an admitted canonicalization policy
    When receipt material is encoded and digested
    Then the receipt digest covers the canonical receipt excluding only its receiptDigest field and makes no provider-conformance claim

  @scenario:reproduce-profile-governed-json-authority-ingestion
  @input:profile-governed-json-authority-ingestion-request
  @input-contract:profile-governed-json-authority-ingestion-request.v1
  @event:profile-governed-json-authority-ingestion-reproduction-requested
  @event-authority:profile-governed-json-authority-ingestor.v1
  @outcome:reproduced-profile-governed-json-authority-ingestion-receipt
  @outcome-contract:profile-governed-json-authority-ingestion-receipt.v1
  @outcome-terminal
  Scenario: Reproduce a receipt across discovery orders
    Given identical admitted authorities resources and two declared discovery orders
    When independent ingestion attempts derive canonical resource order and receipt material
    Then resource evidence findings order and receipt digest match exactly

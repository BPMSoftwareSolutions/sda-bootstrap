@capability:verify-gherkin-compiler-conformance
@root-scenario:verify-gherkin-compiler-conformance
Feature: Verify Gherkin compiler conformance

  Official grammar fixtures, annotated SDA fixtures, source-byte round trips,
  source maps, advanced constructs, localized dialects, adversarial loss cases,
  deterministic reproduction, and compiler/profile identity are evaluated as
  one admission gate. A missing or stale partition leaves the gate open.

  @scenario:verify-gherkin-compiler-conformance
  @input:gherkin-compiler-conformance-corpus
  @input-contract:gherkin-compiler-conformance-request.v1
  @event:gherkin-compiler-conformance-verification-requested
  @event-authority:verify-gherkin-compiler-conformance.v1
  @outcome:gherkin-semantic-ingestion-conformance
  @outcome-contract:gherkin-semantic-ingestion-conformance.v1
  @outcome-terminal
  Scenario: Prove lossless deterministic grammar and profile behavior
    Given one pinned compiler, official grammar binding, admitted SDA profile, and complete digest-bound fixture corpus
    When every preservation, profile, diagnostic, source-map, and repeated-build partition is evaluated
    Then GHERKIN_SEMANTIC_INGESTION_CONFORMANT is returned only when every required partition is current and satisfied

  @scenario:hold-incomplete-gherkin-conformance-corpus
  @input:gherkin-compiler-conformance-corpus
  @input-contract:gherkin-compiler-conformance-request.v1
  @event:incomplete-gherkin-conformance-verification-requested
  @event-authority:hold-incomplete-gherkin-conformance-corpus.v1
  @outcome:open-gherkin-semantic-ingestion-conformance
  @outcome-contract:gherkin-semantic-ingestion-conformance.v1
  @outcome-terminal
  Scenario: Keep the gate open when a required proof partition is absent
    Given a fixture corpus missing any official grammar, SDA profile, byte round-trip, source-map, adversarial loss, dialect, advanced construct, diagnostic, or reproduction partition
    When compiler conformance is evaluated
    Then GHERKIN_SEMANTIC_INGESTION_OPEN names every NOT_OBSERVABLE partition without converting absence into failure or success

  @scenario:reject-stale-gherkin-conformance-evidence
  @input:gherkin-compiler-conformance-corpus
  @input-contract:gherkin-compiler-conformance-request.v1
  @event:stale-gherkin-conformance-verification-requested
  @event-authority:reject-stale-gherkin-conformance-evidence.v1
  @outcome:rejected-gherkin-semantic-ingestion-conformance
  @outcome-contract:gherkin-semantic-ingestion-conformance.v1
  @outcome-terminal
  Scenario: Reject stale compiler, grammar, profile, fixture, or test evidence
    Given complete-looking evidence that names a different compiler, grammar, profile, fixture set, projected test, or proof input digest
    When freshness and subject lineage are verified
    Then the gate is rejected with exact stale subjects and no prior conformance receipt is relabeled current

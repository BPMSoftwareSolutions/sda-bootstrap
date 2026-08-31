@capability:semantic-corpus-artifact-repository
@root-scenario:publish-immutable-semantic-corpus-artifact
Feature: Operate a semantic corpus artifact repository

  Semantic corpus snapshots, catalogs, graphs, indexes, and receipts are stored
  and read by canonical content address. Mutable environment selection is a
  separate compare-and-swap pointer operation permitted only after candidate
  closure. Old referenced snapshots remain readable. Storage never changes
  semantic identity or meaning.

  @scenario:publish-immutable-semantic-corpus-artifact
  @input:semantic-corpus-artifact-publication-request
  @input-contract:semantic-corpus-artifact-publication-request.v1
  @event:semantic-corpus-artifact-publication-requested
  @event-authority:publish-immutable-semantic-corpus-artifact.v1
  @outcome:semantic-corpus-artifact-publication-evidence
  @outcome-contract:semantic-corpus-artifact-publication-evidence.v1
  @outcome-terminal
  Scenario: Publish one canonical immutable artifact
    Given one canonical artifact, declared artifact kind, expected digest, and bounded repository authority
    When the artifact is published atomically at its content address
    Then exact bytes are retained once or matched idempotently without overwrite, pointer movement, semantic interpretation, or mixed generation

  @scenario:reject-semantic-corpus-artifact-publication-conflict
  @input:semantic-corpus-artifact-publication-request
  @input-contract:semantic-corpus-artifact-publication-request.v1
  @event:conflicting-semantic-corpus-artifact-publication-requested
  @event-authority:reject-semantic-corpus-artifact-publication-conflict.v1
  @outcome:rejected-semantic-corpus-artifact-publication-evidence
  @outcome-contract:semantic-corpus-artifact-publication-evidence.v1
  @outcome-terminal
  Scenario: Reject digest mismatch or occupied-address byte conflict
    Given supplied bytes do not match the expected digest or an occupied content address contains different bytes
    When publication admission is evaluated
    Then publication is rejected without overwrite, partial artifact, pointer movement, or reinterpretation of either digest

  @scenario:read-immutable-semantic-corpus-artifact
  @input:semantic-corpus-artifact-read-request
  @input-contract:semantic-corpus-artifact-read-request.v1
  @event:semantic-corpus-artifact-read-requested
  @event-authority:read-immutable-semantic-corpus-artifact.v1
  @outcome:semantic-corpus-artifact-read-evidence
  @outcome-contract:semantic-corpus-artifact-read-evidence.v1
  @outcome-terminal
  Scenario: Read and verify one content-addressed artifact
    Given one authorized artifact digest and bounded repository authority
    When the exact stored artifact is read and its digest and canonical form are verified
    Then the exact artifact or an attributable missing, corrupted, or unauthorized finding is returned without fallback to current or latest state

  @scenario:retain-referenced-semantic-corpus-snapshot
  @input:semantic-corpus-artifact-read-request
  @input-contract:semantic-corpus-artifact-read-request.v1
  @event:retained-semantic-corpus-snapshot-read-requested
  @event-authority:retain-referenced-semantic-corpus-snapshot.v1
  @outcome:semantic-corpus-artifact-read-evidence
  @outcome-contract:semantic-corpus-artifact-read-evidence.v1
  @outcome-terminal
  Scenario: Read an older snapshot retained by receipt lineage
    Given a non-current snapshot digest is still referenced by a retained query, publication, or authoring receipt
    When that exact content address is read
    Then its original bytes and digest are returned independently of the current pointer generation

  @scenario:update-current-semantic-corpus-pointer
  @input:semantic-corpus-current-pointer-update-request
  @input-contract:semantic-corpus-current-pointer-update-request.v1
  @event:semantic-corpus-current-pointer-update-requested
  @event-authority:update-current-semantic-corpus-pointer.v1
  @outcome:semantic-corpus-current-pointer-update-evidence
  @outcome-contract:semantic-corpus-current-pointer-update-evidence.v1
  @outcome-terminal
  Scenario: Compare and swap the current pointer after corpus closure
    Given one expected current digest, one published closed candidate snapshot, and a current closure receipt
    When the environment pointer is updated through one atomic compare-and-swap
    Then it advances exactly one generation or returns a conflict without changing any artifact, old pointer, or retained snapshot

  @scenario:reject-open-semantic-corpus-pointer-update
  @input:semantic-corpus-current-pointer-update-request
  @input-contract:semantic-corpus-current-pointer-update-request.v1
  @event:open-semantic-corpus-pointer-update-requested
  @event-authority:reject-open-semantic-corpus-pointer-update.v1
  @outcome:rejected-semantic-corpus-current-pointer-update-evidence
  @outcome-contract:semantic-corpus-current-pointer-update-evidence.v1
  @outcome-terminal
  Scenario: Reject a pointer update without current corpus closure
    Given the candidate snapshot is missing, corrupted, open, rejected, or bound to a stale closure receipt
    When pointer advancement is requested
    Then the current pointer is unchanged and every missing, stale, or rejected subject is returned as an attributable finding

  @scenario:reproduce-semantic-corpus-artifact-address
  @input:semantic-corpus-artifact-publication-request
  @input-contract:semantic-corpus-artifact-publication-request.v1
  @event:semantic-corpus-artifact-address-reproduction-requested
  @event-authority:reproduce-semantic-corpus-artifact-address.v1
  @outcome:semantic-corpus-artifact-publication-evidence
  @outcome-contract:semantic-corpus-artifact-publication-evidence.v1
  @outcome-terminal
  Scenario: Reproduce one content address from identical canonical bytes
    Given byte-identical canonical artifacts are published in different process and discovery orders
    When their content addresses and publication evidence are derived
    Then artifact digests and immutable address identities are identical without timestamp, machine, user, or path input

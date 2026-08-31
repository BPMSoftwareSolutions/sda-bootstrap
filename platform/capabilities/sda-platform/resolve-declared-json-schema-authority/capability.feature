@capability:resolve-declared-json-schema-authority
@root-scenario:resolve-declared-json-schema-authority
Feature: Resolve declared JSON Schema authority

  A source-neutral provider resolves a declared schema only from an admitted,
  digest-bound catalog. Schema dialect, version policy, exact schema bytes, and
  transitive schema references remain explicit authority inputs.

  @scenario:resolve-declared-json-schema-authority
  @input:declared-json-schema-authority-resolution-request
  @input-contract:declared-json-schema-authority-resolution-request.v1
  @event:declared-json-schema-authority-resolution-requested
  @event-authority:declared-json-schema-authority-resolver.v1
  @outcome:declared-json-schema-authority-resolution-evidence
  @outcome-contract:declared-json-schema-authority-resolution-evidence.v1
  @outcome-terminal
  Scenario: Resolve an exact admitted declared schema
    Given a schema reference digest dialect and version present in an admitted schema catalog
    When the declared schema authority resolver evaluates the declaration
    Then the exact schema bytes and transitive schema reference closure are bound as admitted evidence

  @scenario:hold-missing-declared-json-schema
  @input:declared-json-schema-authority-resolution-request
  @input-contract:declared-json-schema-authority-resolution-request.v1
  @event:missing-declared-json-schema-received
  @event-authority:declared-json-schema-authority-resolver.v1
  @outcome:open-declared-json-schema-authority-resolution-evidence
  @outcome-contract:declared-json-schema-authority-resolution-evidence.v1
  @outcome-terminal
  Scenario: Hold a missing declared schema
    Given a declared schema reference absent from admitted catalog scope
    When the declared schema authority resolver evaluates the declaration
    Then resolution remains open with JSON_SCHEMA_MISSING and no fallback schema is inferred

  @scenario:hold-unsupported-json-schema-version
  @input:declared-json-schema-authority-resolution-request
  @input-contract:declared-json-schema-authority-resolution-request.v1
  @event:unsupported-json-schema-version-received
  @event-authority:declared-json-schema-authority-resolver.v1
  @outcome:open-declared-json-schema-authority-resolution-evidence
  @outcome-contract:declared-json-schema-authority-resolution-evidence.v1
  @outcome-terminal
  Scenario: Hold an unsupported declared version or dialect
    Given a declared document version or schema dialect outside admitted policy
    When the declared schema authority resolver evaluates the declaration
    Then resolution remains open with a typed unsupported-version finding

  @scenario:reject-json-schema-invalid-instance
  @input:declared-json-schema-authority-resolution-request
  @input-contract:declared-json-schema-authority-resolution-request.v1
  @event:json-schema-instance-validation-requested
  @event-authority:declared-json-schema-authority-resolver.v1
  @outcome:rejected-declared-json-schema-authority-resolution-evidence
  @outcome-contract:declared-json-schema-authority-resolution-evidence.v1
  @outcome-terminal
  Scenario: Reject an instance that does not satisfy its admitted schema
    Given lossless parse evidence and a fully resolved admitted schema
    When schema validation evaluates the decoded JSON value
    Then schema disposition is rejected with stable instance and schema pointers without changing source bytes

  @scenario:reproduce-declared-json-schema-authority-resolution
  @input:declared-json-schema-authority-resolution-request
  @input-contract:declared-json-schema-authority-resolution-request.v1
  @event:declared-json-schema-authority-reproduction-requested
  @event-authority:declared-json-schema-authority-resolver.v1
  @outcome:reproduced-declared-json-schema-authority-resolution-evidence
  @outcome-contract:declared-json-schema-authority-resolution-evidence.v1
  @outcome-terminal
  Scenario: Reproduce schema resolution and validation evidence
    Given identical parse evidence schema catalog version policy and resolver authority
    When two independent resolution attempts are evaluated
    Then schema identities closure order findings and evidence digest match exactly

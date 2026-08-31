@capability:resolve-admitted-json-reference-closure
@root-scenario:resolve-admitted-json-reference-closure
Feature: Resolve admitted JSON reference closure

  A source-neutral provider closes declared content references only against an
  explicit, digest-bound admitted scope. Content references and JSON Schema
  references are separate namespaces and neither may trigger ambient network or
  filesystem discovery.

  @scenario:resolve-admitted-json-reference-closure
  @input:admitted-json-reference-closure-request
  @input-contract:admitted-json-reference-closure-request.v1
  @event:admitted-json-reference-closure-requested
  @event-authority:admitted-json-reference-closure-resolver.v1
  @outcome:admitted-json-reference-closure-evidence
  @outcome-contract:admitted-json-reference-closure-evidence.v1
  @outcome-terminal
  Scenario: Close references from exact admitted scope
    Given declared content references whose exact subjects exist in admitted scope
    When the admitted reference closure resolver evaluates them
    Then every reference is resolved to one digest-bound subject in deterministic order

  @scenario:hold-dangling-json-content-reference
  @input:admitted-json-reference-closure-request
  @input-contract:admitted-json-reference-closure-request.v1
  @event:dangling-json-content-reference-received
  @event-authority:admitted-json-reference-closure-resolver.v1
  @outcome:open-admitted-json-reference-closure-evidence
  @outcome-contract:admitted-json-reference-closure-evidence.v1
  @outcome-terminal
  Scenario: Hold a dangling content reference
    Given a declared content reference absent from admitted scope
    When the admitted reference closure resolver evaluates it
    Then closure remains open with JSON_REFERENCE_DANGLING and no proximity-based subject is inferred

  @scenario:reject-ambient-json-reference-resolution
  @input:admitted-json-reference-closure-request
  @input-contract:admitted-json-reference-closure-request.v1
  @event:ambient-json-reference-resolution-requested
  @event-authority:admitted-json-reference-closure-resolver.v1
  @outcome:rejected-admitted-json-reference-closure-evidence
  @outcome-contract:admitted-json-reference-closure-evidence.v1
  @outcome-terminal
  Scenario: Reject ambient network or filesystem resolution
    Given a reference that is unavailable from admitted scope but resembles a URL or path
    When the admitted reference closure resolver evaluates it
    Then resolution is rejected without network access filesystem crawling or inferred aliases

  @scenario:apply-declared-json-reference-cycle-policy
  @input:admitted-json-reference-closure-request
  @input-contract:admitted-json-reference-closure-request.v1
  @event:cyclic-json-reference-closure-requested
  @event-authority:admitted-json-reference-closure-resolver.v1
  @outcome:admitted-json-reference-closure-evidence
  @outcome-contract:admitted-json-reference-closure-evidence.v1
  @outcome-terminal
  Scenario: Apply the declared cycle policy
    Given admitted references containing a self edge or cycle
    When reference closure evaluates the declared cycle policy
    Then the evidence records the exact cycle and its admitted or rejected disposition without unbounded traversal

  @scenario:reproduce-admitted-json-reference-closure
  @input:admitted-json-reference-closure-request
  @input-contract:admitted-json-reference-closure-request.v1
  @event:admitted-json-reference-closure-reproduction-requested
  @event-authority:admitted-json-reference-closure-resolver.v1
  @outcome:reproduced-admitted-json-reference-closure-evidence
  @outcome-contract:admitted-json-reference-closure-evidence.v1
  @outcome-terminal
  Scenario: Reproduce admitted reference closure
    Given identical declared references admitted scope cycle policy and resolver authority
    When two independent closure attempts are evaluated
    Then resolved subjects open references findings order and evidence digest match exactly

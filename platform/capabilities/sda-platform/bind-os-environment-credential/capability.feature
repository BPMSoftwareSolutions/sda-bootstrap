@capability:bind-os-environment-credential
@root-scenario:bind-os-environment-credential
Feature: Bind one OS environment credential reference

  A governed model invocation needs its credential reference to resolve
  regardless of the process spawn environment. This capability binds one
  admitted credential reference in the fixed resolution order declared by
  the read-os-environment-credential mechanic — process environment, then
  operating-system user scope, then operating-system machine scope — and
  exposes only an opaque effect-scoped binding. Credential bytes remain
  inside the admitted platform effect provider; they never enter scenario
  carriers, logs, hashes, receipts, retrieval units, model prompts, or
  durable artifacts.

  @scenario:bind-os-environment-credential
  @input:os-environment-credential-binding-request
  @input-contract:os-environment-credential-binding-request.v1
  @event:os-environment-credential-binding-requested
  @event-authority:bind-os-environment-credential.v1
  @outcome:os-environment-credential-binding
  @outcome-contract:os-environment-credential-binding-evidence.v1
  @outcome-terminal
  Scenario: Bind one authorized OS environment credential reference
    Given one admitted credential reference name and one matching invocation identity
    When the reference is bound in the fixed resolution order
    Then an opaque invocation-scoped binding and secret-free availability lineage are returned without exposing the credential value

  @scenario:hold-missing-os-environment-credential
  @input:os-environment-credential-binding-request
  @input-contract:os-environment-credential-binding-request.v1
  @event:missing-os-environment-credential-binding-requested
  @event-authority:hold-missing-os-environment-credential.v1
  @outcome:os-environment-credential-not-available
  @outcome-contract:os-environment-credential-binding-evidence.v1
  @outcome-terminal
  Scenario: Hold a reference absent from every resolution scope
    Given an admitted credential reference whose value is absent from the process environment and every operating-system scope
    When the reference is bound
    Then CREDENTIAL_NOT_AVAILABLE and secret-free reference lineage are returned without creating a binding, reading alternatives, or authorizing an HTTP exchange

  @scenario:reject-unauthorized-os-environment-credential-reference
  @input:os-environment-credential-binding-request
  @input-contract:os-environment-credential-binding-request.v1
  @event:unauthorized-os-environment-credential-binding-requested
  @event-authority:reject-unauthorized-os-environment-credential-reference.v1
  @outcome:os-environment-credential-not-available
  @outcome-contract:os-environment-credential-binding-evidence.v1
  @outcome-terminal
  Scenario: Reject a reference name outside the admitted credential authority
    Given a request naming a reference the credential authority does not declare
    When credential-reference authorization is evaluated
    Then the unauthorized reference is rejected without attempting to read it or enumerating nearby credentials

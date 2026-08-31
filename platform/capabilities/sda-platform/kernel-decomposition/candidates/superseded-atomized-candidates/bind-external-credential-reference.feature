@capability:bind-external-credential-reference
@root-scenario:bind-external-credential-reference
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#bindExternalCredentialReference
Feature: Bind a credential by reference for one declared use

  A credential must never become a value that flows through the estate. This
  capability binds a credential only by reference, only for the capability that
  requested it, only within the declared effect scope, and only for a single
  use that expires. The secret itself is never returned, never digested into a
  receipt, and never retained beyond the binding.

  What the receipt does retain is everything needed to audit the act without
  reproducing it: which capability requested the binding, against which endpoint
  authority, under which scope, and whether the binding was consumed or expired
  unused.

  @scenario:bind-external-credential-reference
  @input:external-credential-reference-request
  @input-contract:external-credential-reference-request.v1
  @event:external-credential-reference-requested
  @event-authority:bind-external-credential-reference.v1
  @outcome:external-credential-reference-binding
  @outcome-contract:external-credential-reference-binding.v1
  @outcome-terminal
  Scenario: Issue a single-use reference that never reveals the secret
    Given a declared credential authority, a requesting capability, an endpoint authority digest, and a declared effect scope
    When a single-use binding is issued within that scope
    Then the binding is referenced rather than valued, its use and expiry are recorded, and the secret appears in no outcome, receipt, or digest

@capability:bind-governed-tooling-binding-transaction
@root-scenario:bind-governed-tooling-binding-transaction
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#transactGovernedToolingBinding
Feature: Move a tooling responsibility binding transactionally or not at all

  A binding that is half-moved is worse than one that never moved, because the
  estate then disagrees with itself about which provider is responsible. This
  capability transacts a binding change as a single act: either the new binding
  is in place and observable, or the prior binding is retained exactly as it was.

  There is no third state, and a failure mid-transaction restores rather than
  reports partial progress.

  @scenario:bind-governed-tooling-binding-transaction
  @input:governed-tooling-binding-transaction-request
  @input-contract:governed-tooling-binding-transaction-request.v1
  @event:governed-tooling-binding-transaction-requested
  @event-authority:bind-governed-tooling-binding-transaction.v1
  @outcome:governed-tooling-binding-transaction-record
  @outcome-contract:governed-tooling-binding-transaction-record.v1
  @outcome-terminal
  Scenario: Commit the new binding or retain the prior one exactly
    Given a declared prior binding and the declared replacement binding
    When the transaction is applied
    Then either the replacement is in place and observable or the prior binding is retained byte-for-byte, and no partial binding state is ever reported as success

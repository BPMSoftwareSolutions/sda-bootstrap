@capability:bind-governed-tooling-migration-operation
@root-scenario:bind-governed-tooling-migration-operation
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#invokeGovernedToolingMigrationOperation
Feature: Execute one declared tooling migration operation

  A migration conveyor moves real bindings, so the mechanic beneath it must be
  the narrowest possible: one declared operation, against one declared migration
  authority, producing one attributable result. This capability refuses an
  operation the migration authority does not declare, and never widens an
  operation's scope to make it succeed.

  Its outcome is a record of what the operation did, which the conveyor above it
  admits or rejects. The mechanic itself decides nothing about promotion.

  @scenario:bind-governed-tooling-migration-operation
  @input:governed-tooling-migration-operation-request
  @input-contract:governed-tooling-migration-operation-request.v1
  @event:governed-tooling-migration-operation-requested
  @event-authority:bind-governed-tooling-migration-operation.v1
  @outcome:governed-tooling-migration-operation-record
  @outcome-contract:governed-tooling-migration-operation-record.v1
  @outcome-terminal
  Scenario: Execute exactly one declared operation and attribute its result
    Given a declared migration authority and one declared operation within it
    When that operation alone is executed
    Then one attributable operation record is returned, an undeclared operation is refused, and no promotion or admission is claimed by the mechanic

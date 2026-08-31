@capability:bind-schema-contract-admission
@root-scenario:bind-schema-contract-admission
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#createSchemaAdmission,matchesSchema
Feature: Admit or reject a candidate value against its declared contract

  Schema admission is the boundary that decides what is even a member of the
  semantic state space. This capability admits a candidate value only against
  the contract the request declares, resolved from the admitted contract
  catalog, and returns either the admitted value or a rejection naming what
  failed and where.

  It never coerces. A value that is close to its contract is not admitted with
  adjustments, a missing required member is not defaulted, and an unknown member
  is not dropped to make the value fit. The validation engine beneath this
  capability is an irreducible native provider; what belongs to the capability
  is the decision that a contract governs the value at all, and which contract
  that is.

  @scenario:bind-schema-contract-admission
  @input:schema-contract-admission-request
  @input-contract:schema-contract-admission-request.v1
  @event:schema-contract-admission-requested
  @event-authority:bind-schema-contract-admission.v1
  @outcome:schema-contract-admission-record
  @outcome-contract:schema-contract-admission-record.v1
  @outcome-terminal
  Scenario: Admit against the declared contract or reject with the reason
    Given a candidate value and its declared contract resolved from the admitted catalog
    When the value is validated against that contract alone
    Then it is admitted unchanged or rejected with the failing location and reason, and nothing is coerced, defaulted, or dropped to make it fit

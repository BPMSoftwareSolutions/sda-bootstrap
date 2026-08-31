@capability:bind-governed-serial-execution
@root-scenario:bind-governed-serial-execution
@lifecycle:CANDIDATE
@extracted-from:node-native-mechanic-providers.mjs#invokeGovernedSerialExecution
Feature: Compose declared executions serially and stop at the first failure

  Serial composition exists so that a downstream step never compensates for an
  upstream finding. This capability executes declared steps strictly in their
  declared order, carries the admitted outcome of each step into the next, and
  stops at the first non-success instead of continuing with a degraded carrier.

  Every step retains its own lineage under the root execution, so a composed run
  can be read back as the sequence it actually was rather than as one opaque
  result.

  @scenario:bind-governed-serial-execution
  @input:governed-serial-execution-request
  @input-contract:governed-serial-execution-request.v1
  @event:governed-serial-execution-requested
  @event-authority:bind-governed-serial-execution.v1
  @outcome:governed-serial-execution-record
  @outcome-contract:governed-serial-execution-record.v1
  @outcome-terminal
  Scenario: Carry each admitted outcome forward and halt on first non-success
    Given declared execution steps in a declared order
    When each step is executed in order and its admitted outcome becomes the next step's carrier
    Then execution stops at the first non-success, every step retains its own lineage, and no later step compensates for an earlier finding

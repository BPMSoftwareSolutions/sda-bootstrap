@capability:execute-composed-scenario-authority
@root-scenario:execute-composed-scenario-authority
Feature: Execute one composed scenario authority

  A projected SDA consumer may declare a root execution authority containing
  ordered invoke-scenario operations. Each referenced scenario remains an
  independent kernel responsibility with its own admitted input, event
  authority, outcome contract, telemetry, and disposition.

  Composition does not flatten the referenced scenarios into anonymous port
  calls. The immutable outcome of each completed scenario becomes the carrier
  submitted to the next declared scenario only when the connector contracts
  match or an admitted binding authority performs the declared projection.
  Every nested execution retains the root execution identity and adds its own
  execution lineage.

  Unknown scenario identities, recursive composition, contract mismatch,
  unadmitted binding authority, rejected intermediate input, failed event
  authority, and rejected intermediate outcome terminate composition with the
  exact governed disposition. No later scenario may execute after that point.

  The composed outcome is the last successfully admitted scenario outcome.
  Composition cannot reinterpret intermediate facts, bypass contract
  admission, hide a nested disposition, or claim behavioral closure from the
  declaration alone.

  @scenario:execute-composed-scenario-authority
  @input:composed-scenario-execution-context
  @input-contract:composed-scenario-execution-context.v1
  @event:execute-declared-scenario-composition
  @event-authority:execute-declared-scenario-composition.v1
  @outcome:composed-scenario-execution-testimony
  @outcome-contract:composed-scenario-execution-testimony.v1
  @outcome-terminal
  Scenario: Execute an ordered composition through independent kernel scenarios
    Given one admitted root scenario, its ordered invoke-scenario authority, every referenced canonical scenario, and the initial carrier
    When the declared scenario composition is executed
    Then each referenced scenario is admitted and executed exactly once in declared order until termination, and the final carrier, exact nested dispositions, and complete root-preserving lineage are returned without reinterpretation

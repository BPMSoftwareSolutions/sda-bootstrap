@capability:construct-consumer-projection-plan
@root-scenario:construct-consumer-projection-plan
# Legacy source: scenario-driven-architecture/tools/src/capabilities/consumer-capability-compilation/construct-consumer-projection-plan/provider.ts
Feature: Construct one complete consumer projection plan

  A consumer author needs one deterministic, target-neutral file plan before
  any projected artifact is published. The planning facts contain admitted
  consumer source authority, the canonical scenario graph, resolved platform
  responsibilities, requested projection targets, and any admitted output that
  must be preserved.

  The plan retains every canonical scenario and transition, every contract and
  platform binding, every requested interface, expected telemetry, conformance
  query, source lineage, and target artifact. Each execution-authority
  operation remains typed. An invoke-port operation retains its admitted
  mechanic binding; an invoke-scenario operation retains the referenced
  scenario node and adds that scenario's reachable execution closure to the
  plan without flattening it into a port call.

  Recursive scenario invocation, unknown scenario identities, unresolved
  mechanics, unsupported operation kinds, duplicate artifact paths,
  incomplete target coverage, and non-deterministic bytes produce exact
  planning findings. Planning remains an in-memory pure responsibility: it
  neither writes projected files nor claims behavioral acceptance, publication,
  or promotion.

  @scenario:construct-consumer-projection-plan
  @input:consumer-projection-planning-facts
  @input-contract:construct-consumer-projection-plan-input.v1
  @event:consumer-projection-planning-requested
  @event-authority:consumer-projection-planning.v1
  @outcome:consumer-projection-plan-known
  @outcome-contract:consumer-projection-plan-evidence.v1
  @outcome-terminal
  Scenario: Construct a deterministic plan for every requested consumer artifact
    Given admitted consumer authority, one canonical scenario graph, resolved platform responsibilities, and requested projection targets
    When a complete in-memory consumer projection plan is constructed
    Then every requested shared and target artifact has stable bytes, a unique path, exact source lineage, and typed invoke-port or invoke-scenario execution operations without publication or acceptance claims

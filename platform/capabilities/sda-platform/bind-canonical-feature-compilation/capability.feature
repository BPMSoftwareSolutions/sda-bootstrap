@capability:bind-canonical-feature-compilation
@root-scenario:bind-canonical-feature-compilation
Feature: Bind one canonical feature compilation

  Exact source observation, lossless syntax, deterministic cases, SDA profile
  admission, compiler identity, grammar identity, locations, diagnostics, and
  their canonical digests are bound into one immutable compilation receipt.
  The binding cannot claim projection, execution, behavioral conformance, or
  companion-authority closure.

  @scenario:bind-canonical-feature-compilation
  @input:canonical-feature-compilation-components
  @input-contract:canonical-feature-compilation-binding-request.v1
  @event:canonical-feature-compilation-binding-requested
  @event-authority:bind-canonical-feature-compilation.v1
  @outcome:canonical-gherkin-compilation
  @outcome-contract:canonical-gherkin-compilation.v1
  @outcome-terminal
  Scenario: Bind exact compiler lineage into an immutable compilation
    Given one mutually consistent source observation, syntax document, case compilation, and profile admission
    When compiler, grammar, profile, AST, case, diagnostic, and full-compilation subjects are canonicalized and digested
    Then one immutable canonical compilation or typed inconsistency finding is returned without downstream authority claims

  @scenario:reject-inconsistent-feature-compilation-components
  @input:canonical-feature-compilation-components
  @input-contract:canonical-feature-compilation-binding-request.v1
  @event:inconsistent-feature-compilation-binding-requested
  @event-authority:reject-inconsistent-feature-compilation-components.v1
  @outcome:rejected-canonical-gherkin-compilation
  @outcome-contract:canonical-gherkin-compilation.v1
  @outcome-terminal
  Scenario: Reject source, AST, case, profile, or diagnostic mismatch
    Given compilation components that do not name identical source, grammar, AST, cases, profile, or diagnostic subjects
    When their lineage is compared before binding
    Then the compilation is rejected with every mismatched digest and no component is repaired, replaced, or silently preferred

  @scenario:reject-stale-feature-compilation-authority
  @input:canonical-feature-compilation-components
  @input-contract:canonical-feature-compilation-binding-request.v1
  @event:stale-feature-compilation-binding-requested
  @event-authority:reject-stale-feature-compilation-authority.v1
  @outcome:stale-canonical-gherkin-compilation
  @outcome-contract:canonical-gherkin-compilation.v1
  @outcome-terminal
  Scenario: Reject stale compiler, grammar, or profile authority
    Given mutually consistent components whose compiler, grammar, or profile identity no longer matches admitted authority
    When freshness is evaluated
    Then the compilation is rejected as stale without recompiling under latest, changing its source basis, or issuing an admission receipt

  @scenario:reproduce-canonical-feature-compilation
  @input:canonical-feature-compilation-components
  @input-contract:canonical-feature-compilation-binding-request.v1
  @event:canonical-feature-compilation-reproduction-requested
  @event-authority:reproduce-canonical-feature-compilation.v1
  @outcome:reproduced-canonical-gherkin-compilation
  @outcome-contract:canonical-gherkin-compilation.v1
  @outcome-terminal
  Scenario: Reproduce the full compilation digest
    Given byte-identical components and authority identities in different discovery orders
    When the full compilation is canonicalized repeatedly
    Then AST, case, diagnostic, profile, and compilation digests are byte-identical

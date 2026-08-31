@capability:compile-canonical-gherkin-cases
@root-scenario:compile-canonical-gherkin-cases
Feature: Compile canonical Gherkin cases

  One lossless parsed Gherkin document is compiled through the same admitted
  grammar into deterministic executable case testimony. Background, rule,
  scenario-outline, examples, tag, step-argument, and AST-node lineage remain
  explicit. Case compilation does not admit SDA meaning or execute a case.

  @scenario:compile-canonical-gherkin-cases
  @input:lossless-gherkin-parse-evidence
  @input-contract:canonical-gherkin-case-compilation-request.v1
  @event:canonical-gherkin-case-compilation-requested
  @event-authority:compile-canonical-gherkin-cases.v1
  @outcome:canonical-gherkin-case-compilation-evidence
  @outcome-contract:canonical-gherkin-case-compilation-evidence.v1
  @outcome-terminal
  Scenario: Compile deterministic cases with complete syntax lineage
    Given one digest-valid lossless parse result and the exact grammar identity used to produce it
    When scenarios, backgrounds, outlines, and examples are compiled into ordered cases
    Then every case retains exact AST and source lineage with deterministic identities and digests without execution or semantic admission claims

  @scenario:compile-background-and-outline-cases
  @input:lossless-gherkin-parse-evidence
  @input-contract:canonical-gherkin-case-compilation-request.v1
  @event:background-and-outline-compilation-requested
  @event-authority:compile-background-and-outline-cases.v1
  @outcome:expanded-gherkin-case-compilation-evidence
  @outcome-contract:canonical-gherkin-case-compilation-evidence.v1
  @outcome-terminal
  Scenario: Preserve background, outline, and examples lineage in expanded cases
    Given one parsed document containing backgrounds, outlines, examples, tags, tables, or doc strings
    When official case compilation expands its executable cases
    Then every expanded step and argument names all contributing AST nodes, example rows, source locations, and grammar identity

  @scenario:reject-stale-gherkin-parse-for-case-compilation
  @input:lossless-gherkin-parse-evidence
  @input-contract:canonical-gherkin-case-compilation-request.v1
  @event:stale-gherkin-parse-compilation-requested
  @event-authority:reject-stale-gherkin-parse-for-case-compilation.v1
  @outcome:rejected-gherkin-case-compilation-evidence
  @outcome-contract:canonical-gherkin-case-compilation-evidence.v1
  @outcome-terminal
  Scenario: Reject parse, source, or grammar digest drift
    Given parse evidence whose source, AST, grammar, or binding digest is absent, malformed, or no longer current
    When case compilation admission is evaluated
    Then compilation is rejected before expansion with exact stale or mismatched subjects and no mixed-generation cases

  @scenario:reproduce-canonical-gherkin-cases
  @input:lossless-gherkin-parse-evidence
  @input-contract:canonical-gherkin-case-compilation-request.v1
  @event:canonical-gherkin-case-reproduction-requested
  @event-authority:reproduce-canonical-gherkin-cases.v1
  @outcome:reproduced-gherkin-case-compilation-evidence
  @outcome-contract:canonical-gherkin-case-compilation-evidence.v1
  @outcome-terminal
  Scenario: Reproduce ordered cases and digest
    Given equivalent admitted parse facts presented in different ambient orders
    When case identities, AST lineage, steps, arguments, and tags are canonicalized repeatedly
    Then ordered case evidence and its digest are byte-identical without locale, time, or random identity input

@capability:parse-canonical-gherkin-document
@root-scenario:parse-canonical-gherkin-document
Feature: Parse a canonical Gherkin document without loss

  Exact declared source bytes are parsed through one admitted official Gherkin
  grammar binding. The result retains the source, dialect, complete AST,
  comments, narratives, tags, source locations, step arguments, and typed parse
  diagnostics. Parsing observes syntax only; it does not admit the SDA profile,
  invent semantic identity, compile executable cases, or claim projection.

  @scenario:parse-canonical-gherkin-document
  @input:canonical-gherkin-source
  @input-contract:canonical-gherkin-parse-request.v1
  @event:canonical-gherkin-parse-requested
  @event-authority:parse-canonical-gherkin-document.v1
  @outcome:canonical-gherkin-parse-evidence
  @outcome-contract:canonical-gherkin-parse-evidence.v1
  @outcome-terminal
  Scenario: Parse exact Gherkin source into a lossless syntax document
    Given exact source bytes, source identity, media type, declared dialect, and one admitted grammar binding
    When the official grammar parses the source without normalization or source repair
    Then the exact bytes, complete located syntax tree, ordered comments, and typed diagnostics are retained without semantic admission or projection claims

  @scenario:retain-advanced-gherkin-constructs
  @input:canonical-gherkin-source
  @input-contract:canonical-gherkin-parse-request.v1
  @event:advanced-gherkin-parse-requested
  @event-authority:retain-advanced-gherkin-constructs.v1
  @outcome:advanced-gherkin-parse-evidence
  @outcome-contract:canonical-gherkin-parse-evidence.v1
  @outcome-terminal
  Scenario: Retain advanced and localized grammar constructs
    Given exact source containing rules, backgrounds, outlines, examples, tables, doc strings, comments, narratives, or a declared localized dialect
    When the admitted grammar parses the source
    Then every supported grammar node and source location is retained without the parser deciding whether the SDA profile admits it

  @scenario:reject-malformed-gherkin-source
  @input:canonical-gherkin-source
  @input-contract:canonical-gherkin-parse-request.v1
  @event:malformed-gherkin-parse-requested
  @event-authority:reject-malformed-gherkin-source.v1
  @outcome:rejected-gherkin-parse-evidence
  @outcome-contract:canonical-gherkin-parse-evidence.v1
  @outcome-terminal
  Scenario: Reject malformed syntax with exact source locations
    Given exact bytes that the declared grammar cannot parse
    When parsing is attempted without source repair
    Then the source bytes and all official parse diagnostics are retained with exact locations and a rejected disposition

  @scenario:reject-invalid-gherkin-source-carrier
  @input:canonical-gherkin-source
  @input-contract:canonical-gherkin-parse-request.v1
  @event:invalid-gherkin-source-carrier-received
  @event-authority:reject-invalid-gherkin-source-carrier.v1
  @outcome:rejected-gherkin-source-carrier-evidence
  @outcome-contract:canonical-gherkin-parse-evidence.v1
  @outcome-terminal
  Scenario: Reject invalid bytes, media type, dialect, or grammar binding
    Given non-canonical base64, invalid UTF-8, an unsupported media type, an unknown dialect, or a stale grammar binding
    When the source carrier is admitted for parsing
    Then it is rejected before grammar execution with attributable findings and no repaired or inferred source

  @scenario:reproduce-canonical-gherkin-parse
  @input:canonical-gherkin-source
  @input-contract:canonical-gherkin-parse-request.v1
  @event:canonical-gherkin-parse-reproduction-requested
  @event-authority:reproduce-canonical-gherkin-parse.v1
  @outcome:reproduced-canonical-gherkin-parse-evidence
  @outcome-contract:canonical-gherkin-parse-evidence.v1
  @outcome-terminal
  Scenario: Reproduce byte-identical parse evidence
    Given identical exact bytes and identical pinned grammar inputs observed in different discovery orders
    When parsing and canonical node identity projection are repeated
    Then the normalized syntax document, node identities, diagnostics, and AST digest are byte-identical

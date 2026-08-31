@capability:parse-lossless-json-document
@root-scenario:parse-lossless-json-document
Feature: Parse a lossless JSON document

  A source-neutral ingestion provider must observe exact source bytes before
  producing a decoded JSON representation. Parsing preserves lexical evidence
  needed to reject duplicate keys and prevent numeric or Unicode information
  from being silently replaced by host-language values.

  @scenario:parse-lossless-json-document
  @input:lossless-json-parse-request
  @input-contract:lossless-json-parse-request.v1
  @event:lossless-json-parse-requested
  @event-authority:lossless-json-parser.v1
  @outcome:lossless-json-parse-evidence
  @outcome-contract:lossless-json-parse-evidence.v1
  @outcome-terminal
  Scenario: Preserve exact bytes and JSON lexical evidence
    Given exact source bytes with a declared digest encoding and source locator
    When the admitted lossless JSON parser evaluates the source
    Then parse evidence retains the exact bytes digest locator tokens and decoded member names without normalizing the source

  @scenario:reject-malformed-json-or-utf8
  @input:lossless-json-parse-request
  @input-contract:lossless-json-parse-request.v1
  @event:malformed-json-source-received
  @event-authority:lossless-json-parser.v1
  @outcome:rejected-lossless-json-parse-evidence
  @outcome-contract:lossless-json-parse-evidence.v1
  @outcome-terminal
  Scenario: Reject malformed JSON or disallowed UTF-8
    Given source bytes that are not admitted UTF-8 JSON under the declared byte-order-mark policy
    When the admitted lossless JSON parser evaluates the source
    Then parsing is rejected with a typed source-located diagnostic and no repaired replacement document

  @scenario:reject-decoded-equivalent-duplicate-json-keys
  @input:lossless-json-parse-request
  @input-contract:lossless-json-parse-request.v1
  @event:duplicate-json-object-member-received
  @event-authority:lossless-json-parser.v1
  @outcome:rejected-lossless-json-parse-evidence
  @outcome-contract:lossless-json-parse-evidence.v1
  @outcome-terminal
  Scenario: Reject duplicate object members after JSON string decoding
    Given an object whose member names decode to the same Unicode scalar sequence
    When the admitted lossless JSON parser evaluates the object
    Then parsing is rejected as a duplicate key while both lexical member locations remain attributable

  @scenario:retain-json-number-lexemes
  @input:lossless-json-parse-request
  @input-contract:lossless-json-parse-request.v1
  @event:json-number-lexeme-received
  @event-authority:lossless-json-parser.v1
  @outcome:lossless-json-parse-evidence
  @outcome-contract:lossless-json-parse-evidence.v1
  @outcome-terminal
  Scenario: Retain number lexemes without host numeric coercion
    Given valid JSON numbers including exponent negative zero and integers beyond binary floating point exactness
    When the admitted lossless JSON parser evaluates the source
    Then every number token retains its exact lexical bytes and no numeric identity is derived from a lossy host value

  @scenario:reproduce-lossless-json-parse-evidence
  @input:lossless-json-parse-request
  @input-contract:lossless-json-parse-request.v1
  @event:lossless-json-parse-reproduction-requested
  @event-authority:lossless-json-parser.v1
  @outcome:reproduced-lossless-json-parse-evidence
  @outcome-contract:lossless-json-parse-evidence.v1
  @outcome-terminal
  Scenario: Reproduce lossless parse evidence
    Given the same exact bytes source locator parser authority and request contract
    When two independent parse attempts are evaluated
    Then tokens diagnostics source locations and evidence digests match exactly

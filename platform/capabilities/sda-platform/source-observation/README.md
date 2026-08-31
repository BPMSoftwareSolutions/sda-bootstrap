# Source observation platform capability

This package owns the interface contracts between UI source acquisition and
consumer semantic interpretation. It is outside the Scenario Kernel.

The current reference profile formalizes the existing cross-language file
selection envelope and the result of observing admitted text-bearing media. It
does not define consumer headings, classifications, vocabulary, aggregation,
or presentation structure.

The dependency-free `sda-node-text-source-observation.v1` provider admits
`text/*` and `application/json` and decodes UTF-8. The independently composed
`sda-node-document-text-source-observation.v1` provider admits DOCX and PDF and
projects decoded text. Both enforce canonical Base64 and a bounded source size,
and both publish digest-only evidence alongside the observation. Neither
provider interprets consumer meaning; consumer-owned semantic transformation
authority performs that projection after observation.

## Contracts

- `ui-file-source-envelope.v1`: the exact value emitted by file-selection
  controls in React, WPF, and JavaFX;
- `consumer-source-observation.v1`: normalized source content supplied to a
  consumer-owned semantic read-model transformation; and
- `consumer-source-observation-evidence.v1`: provider and content-digest
  testimony that intentionally excludes source text.

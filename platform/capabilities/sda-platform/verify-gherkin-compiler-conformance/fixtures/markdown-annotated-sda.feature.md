`@capability:fixture-markdown-annotated-sda` `@root-scenario:accept-markdown-annotated-sda-fixture`
# Feature: Markdown annotated SDA feature

  An SDA compiler preserves the exact Markdown source bytes while applying the
  official Gherkin-in-Markdown grammar selected by the declared media type.

`@scenario:accept-markdown-annotated-sda-fixture` `@input:markdown-source-document` `@input-contract:canonical-gherkin-source.v1` `@event:markdown-source-document-received` `@event-authority:accept-markdown-annotated-sda-fixture.v1` `@outcome:markdown-source-accepted` `@outcome-contract:gherkin-annotation-result.v1` `@outcome-terminal`
## Scenario: Accept one annotated SDA source document in Markdown

* Given one canonical source document with media type text/x.cucumber.gherkin+markdown
* When its exact bytes are parsed with the declared English Gherkin-in-Markdown grammar
* Then the SDA annotations and Markdown source identity are retained

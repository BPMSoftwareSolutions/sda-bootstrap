Feature: Malformed Gherkin syntax

  Scenario: Reject an unclosed doc string
    Given a malformed structured argument
      """
      this doc string never closes

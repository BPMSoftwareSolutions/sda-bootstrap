# language: fr
@capability:fixture-localized-french
@root-scenario:compiler-un-document-localise
Fonctionnalité: Document Gherkin localisé

  @scenario:compiler-un-document-localise
  @input:document-source
  @input-contract:canonical-gherkin-source.v1
  @event:document-localise-recu
  @event-authority:compiler-un-document-localise.v1
  @outcome:document-localise-compile
  @outcome-contract:gherkin-compilation-result.v1
  @outcome-terminal
  Scénario: Compiler un document français
    Soit un document Gherkin français
    Quand le document est analysé
    Alors son dialecte est conservé

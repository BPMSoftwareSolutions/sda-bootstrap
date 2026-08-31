# Resolve declared UI presentation

This platform capability is the authority boundary between admitted declarative
UI meaning and all later presentation compilation. It produces
`sda-ui-semantic-presentation.v1`; it does not select controls, layouts,
frameworks, toolkits, languages, operating systems, or visual defaults.

The semantic canvas is empty unless authority declares observable meaning. Each
element and relationship carries nonempty lineage. A promise requiring an
observable or operable experience cannot close against an empty presentation.
An explicit no-presentation promise can close as `VALID_EMPTY_PRESENTATION`.

## Owned artifacts

- `capability.feature`: canonical root scenario;
- `resolve-declared-ui-presentation.authority.json`: deterministic event authority;
- `contracts/declared-ui-authority.v1.schema.json`: admitted source manifest;
- `contracts/declared-ui-source-admission-evidence.v1.schema.json`: identity, digest, and uniqueness admission;
- `contracts/sda-ui-semantic-presentation.v1.schema.json`: canonical semantic outcome;
- `contracts/semantic-presentation-lineage-evidence.v1.schema.json`: no-unjustified-surface evidence;
- `contracts/presentation-closure-evidence.v1.schema.json`: promised-experience and zero-opinion evidence; and
- `contracts/semantic-presentation-resolution-evidence.v1.schema.json`: ordered child-stage closure evidence; and
- `fixtures/`: empty, minimal, deletion, missing-presentation, and unjustified-surface acceptance vectors.

The reference pure resolver lives at
`tools/src/ui-presentation/application/declared-ui-presentation-resolver.ts`.
Its output ordering and digest are independent of source array order.

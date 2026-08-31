# Import legacy UI presentation

This Phase G compatibility capability accepts frozen
`consumer-ui-authority.v1` or `sda-ui-presentation-ir.v2` inputs without making
either format a new-authoring surface.

An unrepaired legacy input produces `SEMANTIC_ORIGIN_UNRESOLVED` evidence and a
digest-bound editable workbench. A
`legacy-ui-semantic-origin-manifest.v1` may bind every legacy semantic fact path
to a separately admitted `declared-ui-authority.v1`. Only those explicit
mappings can enter `sda-ui-semantic-presentation.v1` and the v3 compiler.

Every layout, token, visual intent, target recipe, and other physical
presentation leaf is retained with its source path and value digest as a
legacy presentation fact. None of those values selects a semantic role,
relationship, importance, state, or promised experience.

## Dispositions

- `LOSSLESS`: every semantic fact is mapped and no residual legacy presentation fact remains;
- `ADMITTED_WITH_LEGACY_PRESENTATION_FACTS`: semantic conversion closes while physical or visual facts remain explicitly legacy;
- `SEMANTIC_ORIGIN_UNRESOLVED`: one or more semantic facts require repair mappings; and
- `INCOMPATIBLE`: the source, repair identity, digest, mapping, or successor compilation is invalid.

The pure reference importer lives at
`tools/src/ui-presentation/application/legacy-ui-compatibility-compiler.ts`.
It changes neither frozen schemas nor existing v1/v2 providers.

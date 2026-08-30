# sda-bootstrap

Portable Node.js bootstrap CLI for operating a SideFX capability capsule estate.

## Usage

Run commands from the root of the consuming Harness repository:

```bash
sda-bootstrap verify
sda-bootstrap expand <disposable-target>
```

The consuming repository must provide `bootstrap/bootstrap.manifest.json` and
the capsule estate referenced by that manifest. Expansion requires an explicit
target and rejects the consuming repository itself as the destination.

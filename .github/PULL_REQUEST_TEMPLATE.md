## What does this PR do?

<!-- One sentence: what behavior changes and why. -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Migration (schema change)
- [ ] Package model / service change
- [ ] MCP server change
- [ ] Docs / config only

---

## Cross-boundary checklist

Fill this in when the change touches a public API, a published export, or anything the saiqa-server reads from this package.

**Public package API check**
- [ ] Did any public model or service method change its return shape?
  - If yes: saiqa-server `lib/checkops-wrapper.js` or `checkops-form-enricher.js` updated?
  - If yes: saiqa-server enrichment tests updated (`checkops-enrichment-paths.test.js`)?
- [ ] Did any field that saiqa-server maps to an API response change (e.g. `requireAll`, `target_unit_id`)?
  - If yes: saiqa-server step file and contract test updated?
  - If yes: `saiqa-contracts` shared schema updated to match new nullability?

**Migration check**
- [ ] Is this migration backward-compatible with the currently-deployed package version?
- [ ] Is the migration reversible (`down` step present and tested)?
- [ ] Does `npm run migrate` run cleanly?

**Dual identifier check**
- [ ] Does this change affect UUIDs (operational identity) or SIDs (human-readable display)?
- [ ] Are both identifiers preserved in any changed model or service output?

---

## Ownership — which repos are affected?

| Repo | Changed | Tests updated | Validation run |
|------|---------|---------------|----------------|
| `saiqa-contracts` | [ ] | [ ] | [ ] |
| `saiqa-server` | [ ] | [ ] | `npm test` [ ] |
| `saiqa-client` | [ ] | [ ] | `npm run test` [ ] |
| `checkops` | [ ] | [ ] | `npm run test:all` [ ] |

> **Ownership rules:**
> - `checkops`: forms/submissions/findings package internals, package migrations, MCP server.
> - `saiqa-server`: enrichment helpers that map checkops output to API responses.
> - `saiqa-contracts`: any shared contract that the server output and client parsing must agree on.
> - `saiqa-client`: client schemas that parse checkops-backed server responses.

---

## Release checklist (for changes touching more than one repo)

- [ ] All affected repos have been updated in this PR or have a linked companion PR.
- [ ] All linked PRs are mergeable (no unresolved conflicts, all checks green).
- [ ] Merge order is documented if one repo must be deployed before another.
- [ ] `npm publish` readiness: version bumped, CHANGELOG updated, `npm run test:all` green.
- [ ] DB migrations are backward-compatible with the currently-running code version.

---

## Validation summary

<!-- What command did you run to verify this change? Paste the output or a link. -->

```
# Example:
cd checkops && npm run test:all
# Tests: all passed
```

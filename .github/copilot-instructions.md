This repo is a published ESM npm package.

Stack:

- Node.js ESM
- PostgreSQL
- service and model layers
- Jest for tests
- ESLint and Prettier
- GitHub Actions for test and publish automation
- MCP server binary

Key locations:

- `src/index.js`: package entry point
- `src/models/`: persistence models
- `src/services/`: business logic
- `src/config/database.js`: database lifecycle
- `migrations/`: package schema
- `bin/mcp-server.js`: MCP server entry point

Repo-specific rules:

- Protect public package behavior and exported interfaces.
- Preserve dual-ID semantics: UUID for operations, SID for human display.
- Keep service-model layering consistent.
- Update migrations and docs together when schema behavior changes.
- When changing form-question storage or enrichment assumptions, verify downstream server and client implications.

Integration facts:

- The package stores simplified question references and downstream consumers may enrich them.
- The server wrapper and client schemas rely on stable package behavior.
- GitHub Actions in this repo are the only existing CI in the broader workspace.

Useful commands:

- `npm run test:unit`
- `npm run test:integration`
- `npm run test:all`
- `npm run migrate`
- `npm run lint`
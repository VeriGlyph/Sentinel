# Repository Guidelines

This repo will house the indexer service; keep changes small, reviewed, and runnable end to end.

## Project Structure & Module Organization
- Runtime code lives in `src/`: `src/index.ts` (entry), `src/services/` (external integrations), `src/db/` (persistence), `src/jobs/` (schedulers), `src/lib/` (helpers), and `src/types/` (shared types).
- Mirror code under `tests/` (e.g., `tests/services/*`) with fixtures in `tests/fixtures/`. Temporary artifacts go in `tmp/` (ignored by IDE defaults).
- Store config defaults in `.env.example` or `config/`; keep diagrams/runbooks in `docs/`.

## Build, Test, and Development Commands
- `npm install` — install dependencies; commit the lockfile.
- `npm run dev` — watch mode for `src/index.ts` via `nodemon` (or similar).
- `npm run lint` — ESLint/Prettier for style and formatting.
- `npm test` — Jest suite; `npm test -- --runInBand` for flaky integration cases.
- `npm run build` — emit production output to `dist/`; `npm start` should run the build. Keep scripts in `package.json` aligned with these expectations.

## Coding Style & Naming Conventions
- Target Node.js LTS; prefer TypeScript with `strict` mode. Use 2-space indents, semicolons, single quotes.
- CamelCase for variables/functions, PascalCase for classes/types, kebab-case for filenames (`account-service.ts`, except `index.ts`/`main.ts`). Favor named exports.
- Keep modules cohesive; isolate side effects (I/O, network) in service layers; keep helpers pure. Run `npm run lint` before pushing; add comments only where intent is non-obvious.

## Testing Guidelines
- Use Jest for unit/integration tests. Name files `*.spec.ts` or `*.test.ts` alongside mirrored paths in `tests/`.
- Mock external services; gate long-running integrations with tags or `it.skip` until stable.
- Aim for >80% statement coverage and include failure modes (timeouts, invalid payloads, retries). Keep deterministic fixtures in `tests/fixtures/`.

## Commit & Pull Request Guidelines
- Prefix commits with Conventional Commit types (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`); keep them focused.
- PRs need a summary, what/why, manual verification notes, linked issues, and any config/doc updates. Add logs or screenshots when behavior changes.
- Require passing lint/tests before review; update `.env.example` whenever environment variables change.

## Environment & Security Notes
- Do not commit secrets; use `.env` locally and `.env.example` placeholders. Parameterize configs instead of hard-coding.
- Validate external inputs; add timeouts/backoff to network or chain calls. Avoid logging sensitive fields—scrub or mask as needed.

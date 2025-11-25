# Project Requirements — CIP-88 Certificate Indexer

## Goal & Scope
- Build a Cardano CIP-88 certificate indexer that watches metadata key `867`, parses certificates, classifies type, and reports validity.
- Provide an HTTP API and a Vue 3 + Vuetify frontend to browse certificates.
- Use modular blockchain providers, starting with Blockfrost, with a path to Koios or DB-Sync.

## Functional Requirements
- Continuously ingest transactions containing metadata key `867`, normalize to an internal certificate model, and enqueue parsing/validation jobs.
- Parse certificate payloads to identify type (per CIP-88) and validate signatures/structures; mark outcomes as `valid`, `invalid`, or `unparsed`.
- Persist every observed certificate with source tx/hash, timestamps, provider origin, validation status, and parsed fields.
- Expose an API to query certificates by status, type, TX hash, policy/subject IDs, and to fetch details and errors.
- Emit logs/metrics for ingestion lag, validation failures, and provider health.

## Architecture & Technology
- Language: TypeScript across backend and frontend.
- Backend: Node.js service with modular data sources (`src/providers/{blockfrost,koios,dbsync}.ts`) feeding a queue/worker for parsing/validation.
- Frontend: Vue 3 + Vuetify app for dashboard/search.
- Configuration: `.env` + `config/` for provider keys, network, polling intervals.
- Testing: Jest for unit/integration with fixtures for provider payloads and sample CIP-88 certificates.

## Data Sources & Ingestion
- Initial provider: Blockfrost (requires API key and rate-limit handling).
- Abstraction: provider interface for fetching new blocks/txs, extracting metadata key `867`, and yielding standardized payloads.
- Future providers: Koios API and direct DB-Sync queries sharing the same interface.

## Persistence Model
- Recommended tables/collections:
  - `certificates`: `id`, `tx_hash`, `block_height`, `slot`, `provider`, `metadata_key`, `raw_payload`, `parsed_payload`, `certificate_type`, `status` (`valid`/`invalid`/`unparsed`), `validation_errors`, `observed_at`, `validated_at`.
- Indices on `tx_hash`, `certificate_type`, `status`, and `observed_at` for query performance.

## API Surface (initial)
- `GET /certificates`: filter by `status`, `type`, `tx`, `provider`, date range; paginate.
- `GET /certificates/:id`: detailed view, parsed fields, validation errors.
- `GET /health`: provider/queue status; `GET /metrics` (Prometheus) optional.

## Validation Rules (outline)
- Confirm metadata key is `867` and payload conforms to CIP-88 schema.
- Verify signatures/addresses if present; check required fields per certificate type.
- Gracefully handle unknown/partial payloads; mark as `unparsed` with reasons.

## Non-Functional
- Reliability: continue indexing after restarts; persist checkpoints per provider.
- Observability: structured logs, minimal metrics; alert on provider errors or high lag.
- Security: no secret leakage in logs; store API keys via env vars; restrict admin endpoints.

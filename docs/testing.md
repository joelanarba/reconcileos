# First-Slice Verification

The application is under development. This record distinguishes executed checks from remaining work.

## Executed Before Import Feedback

- Python 3.14.3 virtual environment dependency installation completed, including SQLAlchemy and Psycopg binary wheels.
- Local SQLite Alembic upgrade completed. Tests also migrate fresh isolated databases and compare the resulting schema with ORM metadata.
- Backend: 52 tests passed. These cover exact parsing, currency precision, deterministic rules, imports, errors, duplicate-file prevention, provenance, atomic import rollback, exact matching, ambiguity, duplicates, missing/unmatched and partial payments, currency/status exclusions, snapshot repeatability, active allocation uniqueness, failed result rollback, source evidence, restart persistence, safe errors, explicit CORS/hosts, and audit object guards.
- Foreign-key checks include the active SQLite pragma, a clean foreign_key_check result, and a rejected orphan insert.
- pip check reports no broken requirements.
- Frontend: 6 tests passed for exact monetary formatting, large integers, currency separation, invalid import gating, valid confirmation, and understandable backend errors.
- Frontend production build completed with TypeScript and Vite.

The installed Starlette TestClient emits a deprecation warning about its HTTPX transport. The listed backend run passed with that warning; it is not represented as a warning-free execution.

## Browser Check

The Playwright test uses the installed Microsoft Edge, actual FastAPI/Vite services, a dedicated ignored SQLite file, and the small synthetic CSVs. It covers invalid preview gating, templates, real import confirmation, run calculation, the independently expected values, filters, source evidence, reload persistence, a mobile viewport, and browser script errors.

The real-service Microsoft Edge workflow passed: 1 test, 19.6 seconds including service startup and shutdown. Desktop reconciliation and evidence screenshots and the 390px mobile import view were inspected. The browser check verifies that the narrow document width does not exceed its viewport while tables remain independently scrollable. No browser script errors were recorded by the test.

Earlier attempts exposed a Windows executable-path issue in test startup, an Edge response-inspection issue, a test race when a previous run was already visible, and narrow-page overflow from a visually hidden table heading. The launcher, state-based waits, and table containing block were corrected before the passing run. These failed attempts are not counted as passing checks.

From frontend, run npm.cmd run test:e2e. The configuration starts backend and frontend test services on ports 8011 and 5174 and migrates backend/data/browser-check.db. Ordinary development uses ports 8000 and 5173 and backend/data/reconcileos.db.

## Import UX Revision

The learner reported real import friction and requested ordinary CSV and Excel acceptance without system-specific headings. The revision implements automatic CSV encoding/separator recognition, real XLSX/XLS reading, common-header detection, column mapping, visible locale/default settings, explicit status interpretation, preview corrections, and reasoned exclusions. Original source cells remain inspectable, and confirmed imports cannot be remapped.

Executed after this revision: 68 backend tests passed, 8 frontend tests passed, the production build passed, and 3 real Edge browser tests passed. The browser checks include existing CSV column mapping, an inline correction with its original cell preserved, genuine XLSX and XLS uploads, the independent financial fixture, source evidence, and narrow-viewport layout. The final browser run completed in 54.3 seconds including test-service lifecycle. Updated mapping and row-review screenshots were inspected.

Tests also cover exact minor-unit interpretation, ambiguous separators, currency hints that cannot silently become GHS, unknown payment statuses, source-preserving corrections, exclusion reasons, stale previews, immutable confirmed imports, native Excel dates, multiple sheets, and formula handling. Macro execution and formula recalculation are not performed.

## Remaining

The learner reported early import feedback and the requested revision is implemented. A learner retry remains part of final review. Settlement reconciliation, the larger synthetic dataset, case review actions, CSV reports, AI validation, full final review, and the learning wrap-up belong to subsequent checklist work.

PostgreSQL migrations and integration tests, public deployment, and live LLM calls have not run. No SQLite or controlled-response check establishes those outcomes.

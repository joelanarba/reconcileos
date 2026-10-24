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

From frontend, run npm.cmd run test:e2e. The configuration starts backend and frontend test services on ports 8011 and 5174. The first milestone used backend/data/browser-check.db; current runs use uniquely named databases as described below. Ordinary development uses ports 8000 and 5173 and backend/data/reconcileos.db.

## Import UX Revision

The learner reported real import friction and requested ordinary CSV and Excel acceptance without system-specific headings. The revision implements automatic CSV encoding/separator recognition, real XLSX/XLS reading, common-header detection, column mapping, visible locale/default settings, explicit status interpretation, preview corrections, and reasoned exclusions. Original source cells remain inspectable, and confirmed imports cannot be remapped.

Executed after this revision: 68 backend tests passed, 8 frontend tests passed, the production build passed, and 3 real Edge browser tests passed. The browser checks include existing CSV column mapping, an inline correction with its original cell preserved, genuine XLSX and XLS uploads, the independent financial fixture, source evidence, and narrow-viewport layout. The final browser run completed in 54.3 seconds including test-service lifecycle. Updated mapping and row-review screenshots were inspected.

Tests also cover exact minor-unit interpretation, ambiguous separators, currency hints that cannot silently become GHS, unknown payment statuses, source-preserving corrections, exclusion reasons, stale previews, immutable confirmed imports, native Excel dates, multiple sheets, and formula handling. Macro execution and formula recalculation are not performed.

## Three-source Milestone

The completed engine passes 85 backend tests, including actual settlement import, configured fees, missing rules, ambiguous settlements, identity and currency differences, exact net arithmetic, and the independent 100-order/100-payment/90-settlement manifest. All 8 frontend tests and the production build pass. The full three-source Edge workflow passed after correcting navigation wrapping at 390px. The CSV/Excel recognition browser checks also passed in the preceding run. The original first-slice fixture now has a separate complete-engine manifest because absent settlement evidence adds three cases; its historical oracle is preserved.

Browser tests now initialize a uniquely named ignored database for each invocation. Ordinary development data is not reset or reused. The synthetic fee configuration is explicitly supplied only to the test service. Test-service ports remain 8011 and 5174.

## Review and Reporting Milestone

Executed verification passed 97 backend tests, 10 frontend tests, and the production build. The extended real-service Edge workflow passed in 41.8 seconds of browser actions, covering notes, candidate approval, resolve, reopen, explicit reversal, reload, and downloading an exact summary CSV. Desktop case and report screenshots were inspected. The longer browser journey uses a 90-second test budget; individual assertions still have their normal short waits.

After the browser services stopped, a separate Uvicorn process reopened the same isolated test database on port 8012. API checks verified case version 6, five persisted audit actions, one note, no active manual allocation after reversal, and unchanged original/current matched value. That verification process was stopped. The ordinary development database was not modified.

## Remaining Work

The learner reported early import feedback and the requested revision is implemented. A learner retry remains part of final review. AI validation is complete with controlled responses. Final learner review and the learning wrap-up remain open.

PostgreSQL migrations and integration tests, public deployment, and live LLM calls have not run. No SQLite or controlled-response check establishes those outcomes.

## Final Local Verification

Executed on Windows with Python 3.14.3, Node.js 24.13.1, npm 11.8.0, and installed Microsoft Edge:

- Backend: 120 tests passed. The final run completed in 58.79 seconds with the recorded Starlette TestClient HTTPX deprecation warning.
- Dependency consistency: pip check found no broken requirements.
- Frontend: 12 tests passed across five files, including reason/version guards and explicit AI evidence consent with provider failure.
- Production frontend build: TypeScript and Vite passed.
- Real-service browser suite: 4 tests passed, covering the offline source guide with scripts disabled, ordinary CSV interpretation and source-preserving correction, genuine XLSX/XLS reading, and the complete three-source reconciliation/review/export journey. The final suite completed in approximately 1.4 minutes including service lifecycle. The financial browser journey itself took 35.6 seconds.
- Independent synthetic oracle: exact summaries and source relationships passed for 100 orders, 100 payment records, and 90 settlements. The manifest was not derived from the engine.
- Actual process restart: the separate Uvicorn check described above verified persisted review and monetary state after reopening the browser database.
- Ordinary development service: a stale backend process was restarted without resetting its database. Port 8000 then reported all three source types, the complete rule scope, a 10 MiB upload limit, an available Dashboard endpoint, and unconfigured AI. The frontend on port 5173 returned HTTP 200. A browser refresh is necessary to discard old client state.
- Source guide: source anchors were checked, the standalone HTML rendered with JavaScript disabled, and the screenshot was inspected. No completed learner tour is implied.

AI tests use HTTPX controlled responses. They cover valid persistence, wrong-case and unsupported/duplicate IDs, extra fields, invalid confidence, context limits, untrusted prompt-like descriptions, missing configuration, provider errors, response size, invalid envelopes, redirects, request deadlines, and a concurrent case change. No live provider request was made. The independently runnable PostgreSQL verification script is prepared but unexecuted.

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

The learner retried other files and confirmed the revised importer works, then confirmed reconciliation, case review, and report export also work. No further core-workflow change was requested. This is learner confirmation, separate from the recorded automated checks. The learner selected OpenAI and added its key locally. Actual synthetic OpenAI verification and browser inspection are complete as recorded below. The learner has not yet reported trying the newly enabled AI control; final readiness and the learning wrap-up remain open. Another request to verify the same core screens is unnecessary.

PostgreSQL migrations and integration tests and public deployment have not run. Actual live OpenAI checks are separately recorded below; SQLite or controlled responses alone would not establish those outcomes.

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

AI unit tests use HTTPX controlled responses. They cover valid persistence, wrong-case and unsupported/duplicate IDs, extra fields, invalid confidence, context limits, untrusted prompt-like descriptions, missing configuration, provider errors, response size, invalid envelopes, redirects, request deadlines, and a concurrent case change. No live provider request was made during that initial milestone; the later real requests are recorded below. The independently runnable PostgreSQL verification script is prepared but unexecuted.

The final reconciliation screen also exposes the backend's review-status filter explicitly. Its production build passed, and the complete Edge journey passed again with assertions for resolved/open filtering before continuing through review and export. That supplemental browser journey took 47.4 seconds; it is a repeat of the existing workflow, not an additional unique test counted above.

## OpenAI Configuration Check

After the learner selected OpenAI, the complete backend suite passed 131 tests with the same recorded TestClient deprecation warning. New checks cover the documented completion-limit parameter, strict output schema with allowed case/record IDs, disabled completion storage, credential/access errors, usage limits, refusals, incomplete choices, and actual API persistence safeguards through both compatible-provider and OpenAI controlled transports. The standalone synthetic verification command passed Python compilation and help/argument checks. At that configuration checkpoint the key was not yet present, so no live execution was claimed. The subsequent credential and live-check results follow.

## Live OpenAI Verification

The learner added the key locally. Only its presence was checked; the key was never displayed, returned to the frontend, or staged. Two bounded requests were executed with gpt-5.4-mini-2026-03-17 through the actual adapter and real OpenAI transport. TestClient exercised the actual API, migrations, imports, snapshot engine, investigation persistence, and audit creation in new isolated databases containing two entirely synthetic records.

| Trial | Isolated database | Result |
| --- | --- | --- |
| Initial request | ai-check-20261024T204733-615416b6.db | Transport, structured output, evidence IDs, persisted note, and unchanged financial output passed. Inspection found an incorrect prose amount: 12550 minor units was described as GHS 12,550. This was not accepted as explanation accuracy. The original isolated result is preserved. |
| Corrected request | ai-check-20261024T205140-6f6d7ffb.db | The hypothesis correctly used GHS 125.50. Supporting IDs validated, the note and audit event persisted, and case status, snapshot hash, original summary, and current financial summary remained unchanged. |

The correction uses a shared integer-based decimal formatter for reports and AI context. Each monetary fact now has explicit precision, minor-unit text, exact decimal text, and display text. GHS, JPY, KWD, zero, negative display, integers above JavaScript's exact numeric range, and rejected floating-point coercion have automated coverage. The complete backend suite passed 144 tests in 36.95 seconds with the previously recorded TestClient warning.

A new Uvicorn process opened the second database on port 8012. An isolated Vite service on 5174 and actual headless Edge loaded its persisted explanation. The browser verified the GHS 125.50 hypothesis, both exact source amounts, provider/model details, and a request button disabled until explicit evidence consent. No extra AI request or browser script error occurred. A screenshot was inspected. The temporary services and browser were stopped. The ordinary backend on 8000 was restarted and reports complete OpenAI configuration; its financial database was not used for provider verification.

These are two real requests and one inspected synthetic scenario, not broad model-quality evidence. Regular automated tests use controlled transports and do not spend API credits. PostgreSQL and deployment remain unexecuted.

## Hosted Access Preparation

After the AWS deployment request, the complete backend suite passed 162 tests, with the same TestClient deprecation warning. Eighteen added checks exercise fail-closed hosted configuration, fabricated HTTP headers, missing or wrong account/API context, token type, issuer/client/subject, expired and non-finite expiry, scope, operator group encodings, and authenticated review audit actors. Gateway context is injected only by a controlled test wrapper; these tests do not validate a real JWT signature or establish an AWS deployment.

The frontend suite passed 19 tests across six files. Seven new checks cover one-time callback redemption with PKCE, state/age/verifier rejection, bounded tab sessions without persisted refresh tokens, missing-session request denial, bearer headers and 401 cleanup, and refusal to send tokens to another API origin. The TypeScript/Vite production build passed. The full real-service Edge workflow passed again, including authenticated-fetch-compatible template and CSV export controls, all three source imports, reconciliation, review, audit history, and reload. This browser run used local mode, not a real Cognito pool. No PostgreSQL or AWS integration run has occurred.

## AWS Package and Template Preparation

On October 25, 2026, STS verified the existing Builder-challenges profile. The selected region is us-east-1. The default profile's invalid token was not repaired or replaced. Read-only RDS queries confirmed PostgreSQL 18.3 with db.t4g.micro and 20 GB gp3 as an available combination. Pricing was read from AWS's catalog. The account-guarded deployment helper reported that the application stack does not exist. No provisioning operation has run.

Both templates passed CloudFormation syntax validation and cfn-lint 1.58.0 schema/dependency checks after correcting the Cognito MFA property. The Windows builder installed Python 3.12 Linux wheels and produced an approximately 33.4 MB ZIP with 81.6 MB uncompressed contents. The older manylinux2014-only target lacked the pinned greenlet wheel; adding verified Amazon Linux 2023-compatible targets fixed that selection. Project migrations are packaged separately from the installed Alembic library. The builder excludes private environment/database files and Windows executables/extensions, checks size, and records artifact and public CA hashes in ignored local metadata. This is build evidence, not Linux runtime or PostgreSQL execution.

The complete backend suite passed 173 tests with the same TestClient warning. Eleven added controlled checks cover credential URL escaping and TLS arguments, refusal to run the Lambda adapter in local mode, actual Mangum event transport of operator identity, denial without trusted authorizer claims, maintenance action/confirmation guards, wrong-account denial, and missing/non-finite/unreviewed budget denial. These optional adapter/tool checks require requirements-aws.txt; without those dependencies they are explicitly skipped, not evidence of AWS verification. The 162 existing local checks remain available from requirements.txt alone. The frontend's 19 tests and production build passed after exposing configured row limits. Pip check reported no broken requirements.

Real Lambda imports, IPv6 egress, Cognito browser sign-in, Gateway signature checks, PostgreSQL migrations/integration, hosted financial workflow, and backup restore remain unexecuted while recurring-cost approval is pending. See the [deployment runbook](../deploy/README.md) for explicit phases and verification limits.

A final AWS documentation review corrected the subject guard: Cognito identifiers are opaque and are not guaranteed RFC UUID values. Two additional checks accept a short opaque subject and preserve a stable bounded actor for a longer subject. The full backend suite then passed 175 tests. The deployment ZIP was rebuilt with this correction. No real Cognito identity is claimed by these controlled checks.

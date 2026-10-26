# ReconcileOS

ReconcileOS helps finance officers compare order, payment, and settlement exports, investigate differences, and document their decisions. The initial audience is small and medium-sized businesses in Ghana that accept payments through several channels.

The October 26 refinement improves typography, dashboard priorities, evidence comparison, saved AI investigations, results navigation, and reporting. It is deployed to the existing AWS demonstration after explicit approval. See the [audit](docs/refinement-audit.md), [verification record](docs/testing.md), and [two-minute demonstration](docs/release-demo.md).

This proof of concept supports order, payment, and settlement CSV/Excel imports, format recognition, column mapping, reasoned preview corrections, deterministic reconciliation, fee checks, a dashboard, source evidence, and durable persistence. Human investigation notes, review decisions, explicit manual reversal, application audit history, and CSV reports are implemented. Optional OpenAI investigation assistance returns validated hypotheses that remain subject to human review.

Open [ReconcileOS](https://dbedhac79djfv.cloudfront.net) for the public introduction, then choose [Try the demo](https://dbedhac79djfv.cloudfront.net/demo). The read-only demo uses a separate synthetic database with 100 orders, 100 payment records, and 90 settlement records. Visitors can inspect computed matches, source evidence, a saved OpenAI hypothesis when available, and download reports without an account. Approved operators use the site's sign-in form for imports, review decisions, and new AI requests. Their workspace stays protected by Cognito and API Gateway. Local Windows startup remains available below.

## Current Workflow

1. Select Orders, Payment transactions, or Settlement records and upload an existing CSV, TSV, XLSX, XLS, or XLSM export.
2. Review recognized headings and source rows. Adjust column mapping or date/number settings when needed. Correct or explicitly exclude problem rows in the preview with a reason; original cells remain unchanged.
3. Confirm the selected validated records. All selected rows commit together or none do. Interpretation choices and exclusions remain in provenance.
4. Start reconciliation against a stored input snapshot.
5. Search accepted relationships and unresolved cases, inspect rules, and open original source values and provenance.
6. Open Investigations to add notes, approve or reject supported associations, resolve or reopen cases, and inspect audit history. Case disposition does not prove payment or settlement.
7. Use Reports to export the original and current summaries or case evidence as formula-neutralized CSV.

Local mode uses one workspace and a clearly labeled local operator without authentication. The AWS mode uses real Cognito sign-in, API Gateway JWT verification, and operator-group authorization. Neither mode connects to payment providers, accesses bank accounts, or moves money. Provider names identify source labels in imported files.

## Financial Rules

An automatic order-payment match requires a unique candidate on both sides, equal order reference, equal currency, equal amount, a successful payment status, and no conflicting allocation. Cancelled orders are excluded. Multiple candidates remain unresolved. Partial payments are not combined automatically.

Repeated provider transaction references are retained and all members are excluded from automatic allocation pending review. Eligible payment totals disclose those exclusions. Original rows and their provenance remain available.

Money is stored in integer minor units. Decimal parsing rejects unsupported precision rather than rounding silently. The supported precision table is GHS, USD, EUR, and GBP at two digits, JPY at zero, and KWD at three. Monetary API values are integer strings, formatted with BigInt in the browser. Currencies are never combined or implicitly converted.

Affected recorded value groups connected unresolved source evidence and values each group at one level per currency: orders first, otherwise distinct provider transaction keys, otherwise settlement evidence. It is not a financial-loss calculation. See [reconciliation rules](docs/reconciliation-rules.md) for the implemented definitions.

## Run on Windows

Prerequisites: Python 3.11 or newer and a current Node.js runtime supported by the pinned Vite version. The installation and checks for this application use Python 3.14.3, Node.js 24.13.1, and npm 11.8.0. Other runtime combinations have not been verified here.

No Docker, WSL, virtualization changes, or PostgreSQL installation is needed.

From the repository root, start the backend:

```powershell
cd backend
py -m venv .venv
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe prepare_demo.py
$env:PUBLIC_DEMO_DATABASE_URL = 'sqlite:///./data/public-demo.db'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Use Copy-Item only when creating a new local environment file; preserve any existing settings. Direct invocation of the virtual environment's Python avoids activation-policy issues. Activation with .\.venv\Scripts\Activate.ps1 is optional and requires no system-wide policy change.

In a second terminal, from the repository root:

```powershell
cd frontend
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:5173. The API is at http://127.0.0.1:8000/api and its interactive documentation is at http://127.0.0.1:8000/docs. Both services bind to loopback. npm.cmd avoids PowerShell blocking npm.ps1. The frontend uses a strict port; resolve a port conflict rather than silently using an origin absent from CORS configuration.

The root page introduces the product. Choose Try the demo for the separate read-only sample, or Local operator workspace in the footer to work with your own local imports. prepare_demo.py preserves an existing sample database; it never clears the operator store. Its optional database setting can also be saved in the ignored backend/.env. Local preparation does not call OpenAI or create a saved AI response.

DATABASE_URL defaults to sqlite:///./data/reconcileos.db, resolved relative to backend. The resulting file is backend/data/reconcileos.db. Configure the browser API root with VITE_API_BASE_URL in frontend/.env. Secret environment files, database files, dependencies, and personal learner context are ignored by Git.

## Try the Synthetic Fixtures

The small files in [sample-data/slice1](sample-data/slice1/README.md) contain four fictional orders and five payment rows. Import orders.csv as Orders and payments.csv as Payment transactions, confirming each. Then start reconciliation.

With the complete engine and no settlement file, this small fixture produces one order match, nine unresolved cases, GHS 125.50 matched order value, GHS 305.50 eligible payment value, and GHS 510.50 affected recorded value. Three cases identify missing settlement evidence. The extra notification count is one; both rows in that reference group are excluded from automatic allocation. The independent [current manifest](sample-data/slice1/expected-results-complete.json) records the expected counts, values, and exact relationship.

Use invalid-orders.csv to inspect a financial value needing attention. Review the row in the application rather than rewriting the file. Unresolved selected rows prevent confirmation. Re-importing an identical file or reconfirming its batch does not insert another set of records.

These are synthetic records, not evidence of real receipts, completed settlements, or provider integrations. For the complete three-source demonstration, use the three files in sample-data/demo in a fresh workspace with FEE_RULES_PATH=../sample-data/fee-rules.json. Those fee rules are explicitly synthetic. The independent manifest expects 79 order matches, 80 settlement matches, and 54 review cases. See [scenarios](sample-data/demo/README.md). Do not mix demonstration files with real records. The original first-slice manifest remains historical evidence for rule order-payment-1.

## Tests

Backend, from backend:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pip check
```

Frontend, from frontend:

```powershell
npm.cmd test
npm.cmd run build
```

Browser workflow, from frontend, using the installed Microsoft Edge:

```powershell
npm.cmd run test:e2e
```

The browser configuration starts separate local services on ports 8011 and 5174 and creates a uniquely named ignored backend/data/browser-check-<timestamp>.db database for each invocation. It does not use the ordinary local application's database. Fixtures are idempotent, and the verification database must remain dedicated to these synthetic scenarios. Test artifacts are written to ignored frontend/test-results.

Backend tests use actual Alembic migrations on isolated temporary SQLite databases. Engine tests use smaller independent inputs, and API tests compare the persisted results against the manually specified synthetic manifest. Frontend component tests use controlled HTTP responses; the browser test uses real services. See [testing](docs/testing.md) for executed results and remaining checks.

## AI Boundaries

OpenAI is the selected investigation provider. The prepared backend configuration uses https://api.openai.com/v1, the pinned gpt-5.4-mini-2026-03-17 model, and strict JSON schema output. The API key must be added locally to LLM_API_KEY in the ignored backend/.env file; no credential is bundled or exposed to the frontend. Restart the backend after changing settings. Provider/model selection does not establish live availability.

The operator explicitly consents before sending a selected case's evidence. The adapter sends at most 20 relevant records and 16 KiB, treats source text as untrusted, and validates the case, schema, and every returned supporting record ID. Monetary evidence includes explicit precision, minor units, exact decimal values, and formatted displays. Only a validated hypothesis is saved. Provider failures preserve manual work and deterministic results. AI cannot create transactions, change amounts, approve matches, resolve cases, or determine financial truth.

Controlled HTTP tests pass for the generic and OpenAI request paths. Two real OpenAI requests were checked against a synthetic scenario. The first exposed an amount-unit wording error; explicit monetary formatting corrected it, and the follow-up response correctly used GHS 125.50. Saved evidence IDs, unchanged financial summaries, restart persistence, and browser rendering were verified. The current backend suite passes 188 tests. This is not a general model-accuracy claim. From backend, run .\.venv\Scripts\python.exe verify_ai.py --confirm-synthetic-request only when authorizing another bounded request using a separate synthetic database. See [AI configuration](docs/ai-configuration.md) for setup, safeguards, primary documentation, and actual verification status.

## Architecture and Database Portability

The backend is a FastAPI modular monolith using SQLAlchemy ORM models, explicit Alembic migrations, centralized database configuration, UTC timestamps, and integer money. The engine is a pure Python function over a stored snapshot and has no database, clock, network, or model calls. The frontend uses React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, locally served Inter, and Lucide icons.

SQLite foreign keys are enabled on every connection. Explicit transaction handling and a workspace write revision serialize financial writes. Database constraints enforce active allocation uniqueness. Imports and completed results persist atomically. Source records are not edited through the API.

PostgreSQL configuration uses postgresql+psycopg://USER:PASSWORD@HOST:5432/reconcileos with Psycopg 3. This example is not a credential. Migrations, schema parity, the independent 100/100/90-record synthetic oracle, review history, CSV export, and allocation uniqueness passed against real RDS PostgreSQL 18.3. The main hosted workflow was separately verified through the browser. Changing DATABASE_URL does not transfer SQLite data; carrying over existing history requires a separately verified transfer process.

The AWS demonstration was deployed after explicit cost approval in us-east-1. CloudFront serves private S3 assets, API Gateway verifies Cognito tokens, and Lambda connects to encrypted private RDS through verified TLS. Database and OpenAI credentials stay in Secrets Manager. The hosted workflow uses synthetic data; the original local database was not transferred or reset. The current limits are 4 MiB/1,000 rows hosted and 10 MiB/10,000 rows locally. See the [AWS runbook](deploy/README.md) and [hosting verification](docs/production-readiness.md) for costs, operations, and remaining limitations. Backup restoration and production capacity have not been verified.

See [architecture](docs/architecture.md) and [known limitations](docs/limitations.md).

## Devpost Learn Workflow

The installed Build With AI: Basics Learn Skill Pack is sourced from challengepost/learn-ai-basics, with installation provenance recorded in skills-lock.json. The actual 1-start interview, 2-scope, 3-prd, and 4-spec reviews produced the approved planning documents in [devpost](devpost/). Their public entry points are [scope.md](scope.md), [prd.md](prd.md), and [spec.md](spec.md).

The learner approved the ordered [5-build checklist](devpost/checklist.md) and fast mode. All four implementation slices are implemented and mechanically checked. Early hands-on feedback produced the flexible importer revision. The learner retry, final review, and learning wrap-up remain tracked there. Personal learner context is excluded from commits. AI-assisted development is documented truthfully through this workflow; application AI functionality is described separately above.

The source repository is public under joelanarba/reconcileos. The demo video, learner-written submission fields, final learning wrap-up, and learner submission remain pending. A factual [preparation checklist](docs/submission-checklist.md) and [demo operations guide](docs/demo.md) are included. The refined AWS release was deployed and verified after approval. No Devpost submission is claimed.

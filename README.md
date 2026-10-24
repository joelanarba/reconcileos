# ReconcileOS

ReconcileOS helps finance officers compare order, payment, and settlement exports, investigate differences, and document their decisions. The initial audience is small and medium-sized businesses in Ghana that accept payments through several channels.

Development is in progress. The application supports order, payment, and settlement CSV/Excel imports, format recognition, column mapping, reasoned preview corrections, deterministic reconciliation, fee checks, a dashboard, source evidence, and local persistence. Case review actions, report exports, and AI assistance are the remaining approved build work.

## Current Workflow

1. Select Orders, Payment transactions, or Settlement records and upload an existing CSV, TSV, XLSX, XLS, or XLSM export.
2. Review recognized headings and source rows. Adjust column mapping or date/number settings when needed. Correct or explicitly exclude problem rows in the preview with a reason; original cells remain unchanged.
3. Confirm the selected validated records. All selected rows commit together or none do. Interpretation choices and exclusions remain in provenance.
4. Start reconciliation against a stored input snapshot.
5. Search exact matches and unresolved cases, inspect decision rules, and open original source values and import provenance.

The application runs in clearly labeled local single-workspace mode. It does not authenticate operators, connect to payment providers, access bank accounts, or move money. Provider names identify the source labels in CSV files.

## Financial Rules

An automatic order-payment match requires a unique candidate on both sides, equal order reference, equal currency, equal amount, a successful payment status, and no conflicting allocation. Cancelled orders are excluded. Multiple candidates remain unresolved. Partial payments are not combined automatically.

Repeated provider transaction references are retained and all members are excluded from automatic allocation pending review. Eligible payment totals disclose those exclusions. Original rows and their provenance remain available.

Money is stored in integer minor units. Decimal parsing rejects unsupported precision rather than rounding silently. The supported precision table is GHS, USD, EUR, and GBP at two digits, JPY at zero, and KWD at three. Monetary API values are integer strings, formatted with BigInt in the browser. Currencies are never combined or implicitly converted.

Affected recorded value groups connected unresolved source evidence and values each group at one level per currency: orders first, otherwise distinct provider transaction keys, otherwise settlement evidence. It is not a financial-loss calculation. See [reconciliation rules](docs/reconciliation-rules.md) for the implemented definitions.

## Run on Windows

Prerequisites: Python 3.11 or newer and a current Node.js runtime supported by the pinned Vite version. The installation and checks for this working slice use Python 3.14.3, Node.js 24.13.1, and npm 11.8.0. Other runtime combinations have not been verified here.

No Docker, WSL, virtualization changes, or PostgreSQL installation is needed.

From the repository root, start the backend:

```powershell
cd backend
py -m venv .venv
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
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

The browser configuration starts separate local services on ports 8011 and 5174 and uses the ignored backend/data/browser-check.db database. It does not use the ordinary local application's database. Fixtures are idempotent, and the verification database must remain dedicated to these synthetic scenarios. Test artifacts are written to ignored frontend/test-results.

Backend tests use actual Alembic migrations on isolated temporary SQLite databases. Engine tests use smaller independent inputs, and API tests compare the persisted results against the manually specified synthetic manifest. Frontend component tests use controlled HTTP responses; the browser test uses real services. See [testing](docs/testing.md) for executed results and remaining checks.

## AI Boundaries

The current slice does not call an LLM. The approved later AI investigation feature will send only bounded evidence for a selected case, validate structured responses and record IDs, and label explanations as hypotheses. AI will not create transactions, change amounts, approve matches, resolve cases, or determine financial truth. Provider credentials will stay server-side. Live-provider behavior is unverified until configured and executed.

## Architecture and Database Portability

The backend is a FastAPI modular monolith using SQLAlchemy ORM models, explicit Alembic migrations, centralized database configuration, UTC timestamps, and integer money. The engine is a pure Python function over a stored snapshot and has no database, clock, network, or model calls. The frontend uses React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, locally served Inter, and Lucide icons.

SQLite foreign keys are enabled on every connection. Explicit transaction handling and a workspace write revision serialize financial writes. Database constraints enforce active allocation uniqueness. Imports and completed results persist atomically. Source records are not edited through the API.

PostgreSQL configuration uses postgresql+psycopg://USER:PASSWORD@HOST:5432/reconcileos with the included Psycopg driver. This example is not a credential. PostgreSQL migrations, integration behavior, and deployment have not been executed. Changing DATABASE_URL does not transfer SQLite data. A future empty database can be migrated and source files deliberately re-imported; carrying over review history requires a separately verified transfer process.

AWS resources and credentials are not accessed. Authentication, access controls, TLS, secret management, and independent PostgreSQL checks are prerequisites for a later public financial service. The current local operator label is not authentication.

See [architecture](docs/architecture.md) and [known limitations](docs/limitations.md).

## Devpost Learn Workflow

The installed Build With AI: Basics Learn Skill Pack is sourced from challengepost/learn-ai-basics, with installation provenance recorded in skills-lock.json. The actual 1-start interview, 2-scope, 3-prd, and 4-spec reviews produced the approved planning documents in [devpost](devpost/). Their public entry points are [scope.md](scope.md), [prd.md](prd.md), and [spec.md](spec.md).

The learner approved the ordered [5-build checklist](devpost/checklist.md) and fast mode. Implementation is in its first slice; the early hands-on feedback checkpoint, subsequent slices, final review, and learning wrap-up remain tracked there. Personal learner context is excluded from commits. AI-assisted development is documented truthfully through this workflow; application AI functionality is described separately above.

The 6-ship workflow, public repository publishing, demo video, learner-written submission fields, and final submission checklist remain pending. No submission or deployment is claimed.

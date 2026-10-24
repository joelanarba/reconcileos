# PostgreSQL and Future Hosting

Local development uses native Windows tooling and SQLite. No AWS resources, AWS credentials, Docker, WSL, virtual machines, or local PostgreSQL installation were used for this build. This document prepares future verification; it is not deployment evidence.

DATABASE_URL is resolved centrally. SQLAlchemy models use portable string IDs, JSON, integer minor units, UTC conversion, constraints, and parameterized expressions. SQLite enables foreign keys, explicit transactions, and a busy timeout. PostgreSQL uses its native transactions and the included Psycopg 3 driver. Concurrent review writes serialize on a workspace update; allocation uniqueness remains a database constraint. UTC binding differs between SQLite's naive storage and PostgreSQL's timezone-aware connection representation, with an aware UTC application interface.

## Independent PostgreSQL Check

Migrations and integration behavior have not run against PostgreSQL. Do not infer compatibility from SQLite checks. When a dedicated server is explicitly authorized, create an empty test database outside this application. From backend, set POSTGRES_TEST_DATABASE_URL to that database's postgresql+psycopg connection URL in the process environment, then run:

```powershell
.\.venv\Scripts\python.exe verify_postgres.py --confirm-dedicated-test-database
```

The script refuses a database with existing tables. It applies Alembic migrations, checks model/schema parity, imports the synthetic three-source dataset through the real API, verifies its independent manifest, checks persisted review history, parses an export, and verifies allocation uniqueness. It retains synthetic test records for inspection and never clears another database. Credentials should come from an approved secret source and must not be committed. This opt-in path is prepared and has not been executed.

## Data Initialization and Transfer

Changing DATABASE_URL selects another database; it does not copy SQLite records. For a fresh demonstration, apply migrations and deliberately re-import synthetic files into an empty destination. Runs and review history are newly created. Real history transfer requires a separate, tested export/import process preserving IDs, provenance, source checksums, allocation constraints, UTC timestamps, and audit chronology. Compare row counts, source hashes, per-currency integer totals, relationships, and histories before cutover. No automated historical transfer tool is implemented.

## Before Public Hosting

The current API is unauthenticated local single-workspace software and binds to loopback. A public financial-data service requires real authentication, authorization, access controls, TLS, secret management, narrow CORS/hosts, private database connectivity, backups with restore checks, and operator retention/privacy decisions. The current APP_MODE intentionally accepts local only. A future hosting change must implement and verify those controls first.

When deployment is requested, evaluate AWS static hosting and backend compute choices against current cost, operating effort, and security. PostgreSQL can be hosted through several architectures; no AWS service or account is selected here. Provider pricing, supported runtimes, deployment commands, and security settings must be checked against current primary documentation then. No paid provisioning or public exposure is authorized by these preparation notes.

# PostgreSQL and AWS Hosting

The [authenticated demonstration](https://dbedhac79djfv.cloudfront.net) was deployed to us-east-1 on October 25, 2026 after the user approved the estimated USD 20-30 monthly setup. The existing Builder-challenges profile was verified and used explicitly; no global AWS configuration was changed. Local Windows development still uses SQLite, and its existing records were preserved. This document distinguishes executed checks from remaining production work.

DATABASE_URL is resolved centrally. SQLAlchemy models use portable string IDs, JSON, integer minor units, UTC conversion, constraints, and parameterized expressions. SQLite enables foreign keys, explicit transactions, and a busy timeout. PostgreSQL uses its native transactions and the included Psycopg 3 driver. Concurrent review writes serialize on a workspace update; allocation uniqueness remains a database constraint. UTC binding differs between SQLite's naive storage and PostgreSQL's timezone-aware connection representation, with an aware UTC application interface.

## Independent PostgreSQL Check

Migrations and the independent integration scenario passed on real RDS PostgreSQL 18.3 through the private maintenance function. Checks covered schema parity, the 100-order/100-payment/90-settlement oracle, review/audit persistence, CSV export, and active-allocation uniqueness. This is verified behavior for that configuration, not a claim that every PostgreSQL version or concurrency workload has been tested. To run the same script on another explicitly authorized empty database, set POSTGRES_TEST_DATABASE_URL from an approved secret source and run from backend:

```powershell
.\.venv\Scripts\python.exe verify_postgres.py --confirm-dedicated-test-database
```

The script refuses a database with existing tables. It retains synthetic records for inspection and never clears another database. The executed AWS check uses the separate reconcileos_verification database. Main workspace data is independent. Credentials must not be committed or printed.

## Data Initialization and Transfer

Changing DATABASE_URL selects another database; it does not copy SQLite records. For a fresh demonstration, apply migrations and deliberately re-import synthetic files into an empty destination. Runs and review history are newly created. Real history transfer requires a separate, tested export/import process preserving IDs, provenance, source checksums, allocation constraints, UTC timestamps, and audit chronology. Compare row counts, source hashes, per-currency integer totals, relationships, and histories before cutover. No automated historical transfer tool is implemented.

## Hosted Access Preparation

APP_MODE=local preserves the existing loopback single-workspace workflow. Its operator label is not authentication. APP_MODE=aws requires PostgreSQL with Psycopg, sslmode=verify-full, a CA certificate path, explicit hosts and HTTPS origins, Cognito issuer/client/group, and account/API identifiers. Actual Lambda initialization and hosted requests successfully used these settings, including database TLS certificate and hostname verification.

All financial routes share the operator dependency. Hosted requests must contain a trusted Lambda/Gateway context from the configured account and HTTP API, an access-token identity for the configured pool/client, a live expiry, the reserved user-admin OAuth scope, and membership in reconcileos-operators. Request headers cannot supply an actor or group. Audit actors use the authenticated Cognito subject. Health remains a minimal database-readiness response. Interactive API documentation is disabled in hosted mode.

Cognito subjects are treated as opaque identifiers, following [AWS attribute guidance](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html). Short subjects use the cognito: prefix directly. Subjects longer than 64 characters use cognito:h: followed by their SHA-256 digest so the persisted actor fits the existing 80-character field without truncating identity. This is an identity representation, not a claim that audit history is cryptographically immutable.

The deployed API Gateway JWT authorizer validates tokens before invoking Lambda, with invocation permission restricted to this API/account. Live checks accepted a real Cognito access token and rejected unauthenticated and tampered-signature requests with HTTP 401. The browser completed authorization-code/PKCE sign-in and sign-out. The application's operator dependency is not a standalone JWT verifier; starting Uvicorn with APP_MODE=aws does not create the required infrastructure. Direct AWS administrators remain inside the trusted administrative boundary.

Hosted frontend configuration uses VITE_AUTH_MODE=cognito, VITE_API_BASE_URL=/api, VITE_COGNITO_DOMAIN, and VITE_COGNITO_CLIENT_ID. Sign-in uses the Cognito authorization-code flow with S256 PKCE and one-time state validation. A bounded access token stays in sessionStorage for that tab, is sent only to the same-origin /api route, and is removed on expiry, rejected authentication, or sign-out. Refresh tokens are not persisted. Report and template downloads use authenticated fetch requests. The app clears its in-memory query cache when a session ends. Signing out clears the tab session and Cognito browser session; already issued access tokens can remain usable until their configured short expiry.

## Current Deployment

CloudFront HTTPS serves a private S3 frontend. API Gateway fronts the Python Lambda backend. Cognito permits admin-created approved operators. RDS PostgreSQL 18.3 uses db.t4g.micro, 20 GB encrypted gp3 storage, no public database access, and seven-day backups. The runtime role and database user are separate from private migration administration. Secrets Manager holds database and OpenAI credentials. Security groups restrict database connections to the application's private network group.

The [AWS runbook](../deploy/README.md) contains templates, Windows package building, account/budget guards, explicit deployment phases, and cost estimates. The Python 3.12 Linux ZIP ran successfully in Lambda without Docker or local PostgreSQL. Four synthetic records were imported into the main workspace through the actual browser; the larger PostgreSQL verification remains in a separate database. Hosted limits are 4 MiB and 1,000 rows. Local limits remain 10 MiB and 10,000 rows.

An IPv6 egress-only gateway provides outbound HTTPS from dual-stack private Lambda subnets. Secrets Manager access, an unauthenticated OpenAI reachability check, and one real OpenAI investigation succeeded through this network. No NAT gateway was provisioned. See [Lambda VPC networking](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html), [Secrets Manager IPv6](https://docs.aws.amazon.com/secretsmanager/latest/userguide/ip-access.html), and [egress-only gateways](https://docs.aws.amazon.com/vpc/latest/userguide/egress-only-internet-gateway.html).

The account's verified Lambda quota is 10 unreserved concurrent executions. Functions use that shared pool without reserved allocations; API throttling is 10 requests/second with a burst of 20. No account-wide quota was changed. Each PostgreSQL engine pool is bounded at two connections with no overflow. This is a small demonstration, not validated production capacity. The approved estimate is not a hard spending cap, and no free-tier eligibility is assumed.

The complete Edge browser journey passed in 49.5 seconds: Cognito sign-in, CSV preview/confirmation, reconciliation against the independent small manifest, source-backed case review, persisted authenticated audit actors, one consented OpenAI hypothesis, unchanged financial summaries, CSV download, reload, and sign-out. A separate read confirmed the persisted GHS 200.00 hypothesis and four audit events. The larger PostgreSQL oracle also passed. Excel import and provider-failure paths have local automated coverage; they were not repeated against the hosted service. Backup restoration, load testing, comprehensive hosted concurrency testing, and historical data transfer remain unverified. Keep this deployment limited to demonstration use until those operational requirements are addressed.

# PostgreSQL and AWS Hosting

Local development uses native Windows tooling and SQLite. The user requested terminal-based AWS deployment and PostgreSQL provisioning, then directed use of an existing profile. On October 25, 2026, STS rejected the default profile's token and successfully verified Builder-challenges. That profile and its configured us-east-1 region are selected explicitly without changing global configuration. CloudFormation validation, template schema checks, pricing, engine availability, and a read-only application-stack status check have run. No resources have been provisioned; paid services are waiting for the user's budget. These preparation notes are not deployment evidence.

DATABASE_URL is resolved centrally. SQLAlchemy models use portable string IDs, JSON, integer minor units, UTC conversion, constraints, and parameterized expressions. SQLite enables foreign keys, explicit transactions, and a busy timeout. PostgreSQL uses its native transactions and the included Psycopg 3 driver. Concurrent review writes serialize on a workspace update; allocation uniqueness remains a database constraint. UTC binding differs between SQLite's naive storage and PostgreSQL's timezone-aware connection representation, with an aware UTC application interface.

## Independent PostgreSQL Check

Migrations and integration behavior have not run against PostgreSQL. Do not infer compatibility from SQLite checks. When a dedicated server is explicitly authorized, create an empty test database outside this application. From backend, set POSTGRES_TEST_DATABASE_URL to that database's postgresql+psycopg connection URL in the process environment, then run:

```powershell
.\.venv\Scripts\python.exe verify_postgres.py --confirm-dedicated-test-database
```

The script refuses a database with existing tables. It applies Alembic migrations, checks model/schema parity, imports the synthetic three-source dataset through the real API, verifies its independent manifest, checks persisted review history, parses an export, and verifies allocation uniqueness. It retains synthetic test records for inspection and never clears another database. Credentials should come from an approved secret source and must not be committed. This opt-in path is prepared and has not been executed.

## Data Initialization and Transfer

Changing DATABASE_URL selects another database; it does not copy SQLite records. For a fresh demonstration, apply migrations and deliberately re-import synthetic files into an empty destination. Runs and review history are newly created. Real history transfer requires a separate, tested export/import process preserving IDs, provenance, source checksums, allocation constraints, UTC timestamps, and audit chronology. Compare row counts, source hashes, per-currency integer totals, relationships, and histories before cutover. No automated historical transfer tool is implemented.

## Hosted Access Preparation

APP_MODE=local preserves the existing loopback single-workspace workflow. Its operator label is not authentication. APP_MODE=aws fails configuration unless PostgreSQL with Psycopg, sslmode=verify-full, a CA certificate path, explicit hosted hosts and HTTPS origins, Cognito issuer/client/group, and account/API identifiers are configured. Certificate loading and actual TLS connectivity still need live deployment verification.

All financial routes share the operator dependency. Hosted requests must contain a trusted Lambda/Gateway context from the configured account and HTTP API, an access-token identity for the configured pool/client, a live expiry, the reserved user-admin OAuth scope, and membership in reconcileos-operators. Request headers cannot supply an actor or group. Audit actors use the authenticated Cognito subject. Health remains a minimal database-readiness response. Interactive API documentation is disabled in hosted mode.

Cognito subjects are treated as opaque identifiers, following [AWS attribute guidance](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html). Short subjects use the cognito: prefix directly. Subjects longer than 64 characters use cognito:h: followed by their SHA-256 digest so the persisted actor fits the existing 80-character field without truncating identity. This is an identity representation, not a claim that audit history is cryptographically immutable.

This design relies on an actual API Gateway JWT authorizer to verify signatures, issuer, audience, expiry, and scope before invoking Lambda. Route authorization and restricted Lambda invocation permissions are mandatory deployment controls. The application dependency is not a standalone JWT verifier; starting Uvicorn with APP_MODE=aws does not create a working authenticated host. Controlled Gateway-context and Mangum transport tests establish application behavior, not real Cognito or Gateway verification. The Lambda adapter is implemented; the AWS infrastructure is prepared but not deployed.

Hosted frontend configuration uses VITE_AUTH_MODE=cognito, VITE_API_BASE_URL=/api, VITE_COGNITO_DOMAIN, and VITE_COGNITO_CLIENT_ID. Sign-in uses the Cognito authorization-code flow with S256 PKCE and one-time state validation. A bounded access token stays in sessionStorage for that tab, is sent only to the same-origin /api route, and is removed on expiry, rejected authentication, or sign-out. Refresh tokens are not persisted. Report and template downloads use authenticated fetch requests. The app clears its in-memory query cache when a session ends. Signing out clears the tab session and Cognito browser session; already issued access tokens can remain usable until their configured short expiry.

## Proposed Deployment

The proposed small deployment is a private S3 frontend through CloudFront HTTPS, API Gateway HTTP API, a Python Lambda backend, an admin-created Cognito operator, and private encrypted Single-AZ RDS PostgreSQL. Secrets Manager holds database and optional OpenAI credentials. Database security groups allow only the backend and private maintenance function. Runtime database permissions should be separate from migration administration. This proposal has not been provisioned or tested.

The implementation templates, Windows package builder, account/budget guards, explicit deployment phases, and current cost estimate are in the [AWS runbook](../deploy/README.md). The Linux wheel package was built without Docker or local PostgreSQL. Its contents and native target still need actual Lambda execution before runtime compatibility is claimed. Main workspace data starts empty; the private PostgreSQL verification uses a separate synthetic database. The proposed hosted limits are 4 MiB and 1,000 rows; local limits remain unchanged.

An outbound IPv6 route through an egress-only internet gateway may avoid a recurring NAT gateway charge. Lambda requires dual-stack subnets and explicit IPv6 egress enablement. OpenAI currently resolves IPv6 addresses, and Secrets Manager documents dual-stack endpoints, but actual connectivity must be checked in the selected account. Do not provision an IPv4 NAT gateway silently if that test fails. See [Lambda VPC networking](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html), [Secrets Manager IPv6](https://docs.aws.amazon.com/secretsmanager/latest/userguide/ip-access.html), and [egress-only gateways](https://docs.aws.amazon.com/vpc/latest/userguide/egress-only-internet-gateway.html).

Before paid provisioning, select the AWS CLI profile, confirm its STS account identity and intended region, establish a monthly budget, review regional pricing and any applicable credits, and choose fresh synthetic records or a separately verified data transfer. A budget alert does not impose a hard spending ceiling. Do not assume free-tier eligibility. Keep the current SQLite database intact.

Deployment verification must include real PostgreSQL migrations and synthetic integration checks, unauthenticated denial, authenticated import/reconcile/review/export through the public HTTPS origin, source evidence and actor audit checks, safe AI failure, secret isolation, private database reachability, and backup/restore behavior. No public financial-data API should be exposed with local mode. PostgreSQL compatibility and AWS deployment remain unverified.

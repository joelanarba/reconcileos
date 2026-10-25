# AWS Deployment Runbook

This is an optional hosted demonstration of the existing modular application. It is not a completed deployment. The local Windows application and SQLite database remain independent. Review the selected AWS account, current costs, and budget before provisioning.

## Architecture

- Private encrypted S3 frontend, served by CloudFront using its default HTTPS domain.
- API Gateway HTTP API with a Cognito JWT authorizer for every financial route.
- Python 3.12 Lambda ZIP package, built on Windows using compatible Linux wheels.
- Private encrypted Single-AZ RDS PostgreSQL 18.3, db.t4g.micro, 20 GB gp3 storage.
- Separate runtime database role, migration administration, and narrowly scoped secret access.
- Admin-created Cognito operator, no public registration, no invitation email.
- Private IAM-invoked maintenance function for initialization, dedicated synthetic database checks, and bounded network verification.
- Dual-stack private subnets and an IPv6 egress-only internet gateway. No NAT gateway, public database, EC2 instance, or local container runtime.

CloudFront forwards authorization and the origin API hostname without caching financial responses. See [AWS managed origin policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html). Hosted access relies on [API Gateway JWT verification](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html), followed by the application's operator-group and trusted-context checks.

## Cost Review

AWS's pricing API was queried on October 25, 2026 for us-east-1. On-demand compute is USD 0.016/hour; gp3 storage is USD 0.115/GB-month. The selected engine and instance/storage combination were returned as available by RDS. At 730 hours per month:

| Component | Estimated monthly USD |
| --- | ---: |
| PostgreSQL compute | 11.68 |
| 20 GB gp3 storage | 2.30 |
| Three stored secrets | 1.20 |
| Baseline subtotal | 15.18 |
| Planning allowance for light demonstration use | 20-30 total |

The total allowance is an estimate, not a billing cap. Requests, logs, frontend storage, traffic, excess backup storage, database burst CPU credits, retained snapshots, and taxes can add charges. OpenAI usage is billed separately. No free-tier eligibility or available account credits are assumed. See [RDS pricing](https://aws.amazon.com/rds/postgresql/pricing/) and [Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/). No budget alarm or automatic spending shutdown is implemented.

## Prepare on Windows

Run from the repository root. Use the selected existing profile explicitly; do not change global AWS or Git configuration. Replace the account placeholder with the identity verified by STS.

```powershell
$deployPython = (Resolve-Path .\backend\.venv\Scripts\python.exe).Path
$targetArgs = @('--profile', 'YOUR_PROFILE', '--account-id', 'YOUR_12_DIGIT_ACCOUNT_ID', '--region', 'us-east-1')
& $deployPython -m pip install -r backend\requirements-aws.txt
& $deployPython -m pip install -r deploy\requirements-tools.txt
& $deployPython deploy\manage.py status @targetArgs
& $deployPython deploy\build_backend.py
& .\backend\.venv\Scripts\cfn-lint.exe deploy\bootstrap.yaml deploy\aws.yaml -r us-east-1
```

The ZIP, Linux dependency tree, public RDS CA bundle, hashes, target metadata, outputs, and operator credentials belong only in ignored deploy/.local/. No local environment file, SQLite database, personal learner profile, Windows extension library, or credential file is included. Project migrations are packaged under migrations/ to avoid overwriting the installed Alembic library. A successful package build does not prove that Linux imports or PostgreSQL integration have executed.

## Provision After Cost Approval

The following commands create billable resources and publish the app. Execute them only after the account and recurring charges have been approved. Run each phase separately, inspect its result, and stop on a nonzero exit status; do not paste this block as an unattended script. The example USD 30 allowance below is not user authorization. The helper verifies the actual account before resource operations and refuses an unrelated existing stack. It does not update infrastructure implicitly or delete resources after a failure.

```powershell
& $deployPython deploy\manage.py provision @targetArgs --monthly-budget 30
& $deployPython deploy\manage.py initialize @targetArgs
& $deployPython deploy\manage.py verify-postgres @targetArgs
& $deployPython deploy\manage.py connectivity @targetArgs
& $deployPython deploy\manage.py configure-ai @targetArgs
& $deployPython deploy\manage.py create-operator @targetArgs
& $deployPython deploy\manage.py publish @targetArgs
& $deployPython deploy\manage.py smoke @targetArgs
```

Initialization applies and checks migrations, creates the runtime role, grants application table permissions, and checks runtime connectivity. The synthetic PostgreSQL verification uses a separate reconcileos_verification database, refuses to clear an existing database, and retains its evidence. It must actually pass before PostgreSQL compatibility is reported. Main workspace records are not populated by that check. The main database starts empty with no assumed provider fee rules. Deliberately import synthetic files for a demonstration; do not copy local financial history automatically.

The connectivity phase makes an unauthenticated HTTPS request to OpenAI and expects a 401, without sending credentials or evidence. It tests reachability, not model inference. Stop and review the networking choice if IPv6 connectivity fails; do not silently add a paid NAT gateway.

The optional configure-ai phase reads only the existing private local OpenAI key/model into process memory, stores them in Secrets Manager, and refreshes the application runtime. It never prints the key or sends a provider request. Omit this phase to leave AI unavailable. Consent and bounded evidence rules still apply to every actual investigation request.

The operator phase uses username joelanarba and a generated password, suppresses invitation delivery, and stores credentials in deploy/.local/operator-access.json with the local user's file permissions. Do not print that file into shared logs, commit it, or publish it. Existing operator passwords are not reset automatically. A partially completed operator setup requires inspection before recovery.

The smoke phase checks HTTPS delivery, unauthenticated denial, an actual Cognito access token, hosted workspace identity, templates, dashboard, and unavailable public API documentation. It does not create financial records or exercise the full financial journey. After it passes, verify hosted CSV/Excel import, reconciliation, review/audit, report export, browser PKCE sign-in/sign-out, safe AI failure, and an explicitly consented synthetic AI request. Record those outcomes separately. Backup restore has not been tested.

## Limits and Operations

Hosted uploads are limited to 4 MiB and 1,000 rows to fit synchronous Gateway/Lambda request and execution limits. Local mode retains 10 MiB and 10,000 rows. The interface reads the actual limits from the backend. Hosted requests have a 28-second function limit; optional AI requests use a 20-second provider deadline. This is a small demonstration, not a bulk-processing or high-availability deployment.

To update backend code, rebuild the package, review its changes, then run the explicit update-backend phase. That phase changes the artifact parameter using the existing infrastructure template. It does not silently replace database/network resources. Re-run relevant hosted checks afterward. Use publish again for frontend changes.

No teardown command runs automatically. Failed stacks can leave chargeable resources. The database uses snapshot retention on deletion; frontend/artifact buckets and snapshots can remain and continue billing after stack deletion. Review exact stack resources, financial data, retained objects, and required backups before explicitly authorizing cleanup. Do not claim a stack deletion removes all costs.

Production use needs additional capacity, durable long-running work, stronger operator/account administration, mandatory access policy decisions, tested backup restoration, credential rotation procedures, monitoring, and a tested history transfer when required. Do not treat this demonstration as production certification.

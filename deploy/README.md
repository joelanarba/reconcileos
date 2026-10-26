# AWS Deployment Runbook

## October 26 Refinement Release

This revision is prepared locally and has not been deployed. Verify the active account again and obtain production deployment approval before publishing it. It requires no infrastructure or service changes.

Deploy the backend before publishing the frontend. The revised interface uses the new `status=unresolved` case filter; an older backend will interpret that value as a literal review status and return an empty list. Rebuild the backend ZIP, apply the explicit update-backend phase, check the filter and public write denial, then publish the frontend and repeat the hosted checks. Run the updated checks only after this release is deployed; they target the refined screens. Preserve the existing operator and synthetic databases. No new provider call is required to verify saved AI presentation.

## Public Interface Revision

The root now introduces the product, /demo opens a no-account read-only sample, and /login provides a custom form backed by Cognito. The protected operator store remains independent. The public sample uses reconcileos_public_demo on the same RDS instance, with 100 orders, 100 payments, 90 settlements, a manifest-verified run, and one actual saved OpenAI hypothesis. Public requests cannot call the provider or write review actions. The database role has SELECT-only access to sample tables.

For an existing owned stack, update-interface creates and inspects a change set restricted to the Cognito client, response security headers, demo GET route, and maintenance secret access. It refuses replacements or unexpected resources. update-backend deploys the reviewed ZIP separately. initialize-demo creates or preserves the fixed synthetic database, imports through the actual APIs, verifies the oracle, saves at most one provider example, and grants read-only runtime access. Existing operator records and verification databases are preserved. Run publish for the frontend, then the hosted checks. These phases use the same required profile, account-id, and region arguments as the other operations below. No additional paid service or instance tier is introduced.

Custom sign-in calls [Cognito InitiateAuth](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_InitiateAuth.html) over HTTPS. Passwords go directly to Cognito. Only the access token is retained for the tab; challenge flows use the existing provider code/PKCE path. CloudFront CSP explicitly allows both configured Cognito endpoints.

The [authenticated demonstration](https://dbedhac79djfv.cloudfront.net) was deployed and verified on October 25, 2026. It uses the existing modular application and real private PostgreSQL. The local Windows application and SQLite database remain independent. Review the selected account, current costs, and budget before new provisioning.

The protected operator workspace was initialized from four synthetic records and retains its executed runs, review actions, and validated AI history. The public and verification databases each contain the larger synthetic fixture independently. The operator username is joelanarba. Its password is stored only in protected, ignored deploy/.local/operator-access.json. No password is published here.

## Architecture

- Private encrypted S3 frontend, served by CloudFront using its default HTTPS domain.
- API Gateway HTTP API with a Cognito JWT authorizer for operator financial routes. Public GET /api/demo routes read only the isolated synthetic database.
- Python 3.12 Lambda ZIP package, built on Windows using compatible Linux wheels.
- Private encrypted Single-AZ RDS PostgreSQL 18.3, db.t4g.micro, 20 GB gp3 storage.
- Separate runtime database role, migration administration, and narrowly scoped secret access.
- Admin-created Cognito operator, no public registration, no invitation email.
- Private IAM-invoked maintenance function for initialization, dedicated synthetic database checks, and bounded network verification.
- Dual-stack private subnets and an IPv6 egress-only internet gateway. No NAT gateway, public database, EC2 instance, or local container runtime.

CloudFront uses stack-owned cache/origin policies. Financial responses have zero cache TTL; viewer headers, cookies, and query strings are forwarded except for Host, which is replaced by the API hostname. See [origin header policies](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-cloudfront-originrequestpolicy-headersconfig.html). Hosted access relies on [API Gateway JWT verification](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html), followed by operator-group and trusted-context checks.

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

The ZIP, Linux dependency tree, public RDS CA bundle, hashes, target metadata, outputs, and credentials belong only in ignored deploy/.local/. No local environment file, SQLite database, personal learner profile, Windows extension library, or credential file is included. Migrations are packaged under migrations/ to avoid overwriting the installed Alembic library. This package actually executed in Lambda; future builds still need runtime checks.

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

The smoke phase checks HTTPS delivery, unauthenticated denial, a real Cognito access token, workspace identity, templates, dashboard, and unavailable API documentation. It does not create financial records. The separate Edge journey passed code/PKCE sign-in, three-source CSV imports, expected reconciliation, note/resolve/reopen, authenticated audit actors, one consented OpenAI investigation, CSV export, reload, and sign-out. The AI correctly used GHS 200.00 and left financial summaries unchanged. A tampered token signature returned 401. Excel and provider-failure paths have local coverage but were not repeated on this host. Backup restore is untested.

Run the hosted browser check from frontend only against the reviewed demonstration workspace. It refuses unknown existing imports. The optional AI flag makes one bounded synthetic provider request.

```powershell
$env:HOSTED_VERIFY_AI = '1'
npm.cmd run test:e2e -- --config playwright.hosted.config.ts
```

Authentication traces, video, and automatic screenshots are disabled. Password fields are excluded from the test accessibility snapshot, and teardown redacts private failure text. The operator password was rotated after verification and the new credential checked. Do not share authentication artifacts.

## Limits and Operations

Hosted uploads are limited to 4 MiB and 1,000 rows. Local mode retains 10 MiB and 10,000 rows. The interface reads the actual limits from the backend. Hosted requests have a 28-second limit; AI uses a 20-second provider deadline. This account has 10 unreserved Lambda executions and cannot reserve part of that minimum pool. Functions use shared concurrency with API throttling at 10 requests/second and burst 20. No global quota was changed. This is a small demonstration, not validated bulk processing or high availability.

New stacks use DisableRollback so failed creation can resume. The initial OnFailure=DO_NOTHING preserved resources but was not resumable; that stack was checked for zero databases/functions, users, files, and AI keys before recreation. Its retained empty frontend bucket was later removed after ownership and deleted-stack inventory checks. A subsequent reservation failure was repaired while preserving PostgreSQL. The repair-infrastructure phase supports preserved CREATE_FAILED/UPDATE_FAILED states; inspect template changes before using it. No automatic teardown occurs.

To update backend code, rebuild the package, review its changes, then run the explicit update-backend phase. That phase changes the artifact parameter using the existing infrastructure template. It does not silently replace database/network resources. Re-run relevant hosted checks afterward. Use publish again for frontend changes.

No teardown command runs automatically. Failed stacks can leave chargeable resources. The database uses snapshot retention on deletion; frontend/artifact buckets and snapshots can remain and continue billing after stack deletion. Review exact stack resources, financial data, retained objects, and required backups before explicitly authorizing cleanup. Do not claim a stack deletion removes all costs.

Production use needs additional capacity, durable long-running work, stronger operator/account administration, mandatory access policy decisions, tested backup restoration, credential rotation procedures, monitoring, and a tested history transfer when required. Do not treat this demonstration as production certification.

# Current Limitations

This is a local proof of concept with automated checks and a pending final learner review. The approved remaining work is tracked in devpost/checklist.md.

- All three source types, settlement matching, fee checks, and dashboard are implemented. Human review, notes, audit history, and CSV reports are implemented. Optional AI assistance has controlled-response tests and actual OpenAI verification with synthetic records. Its key remains local. One tested scenario does not establish accuracy across all cases, and hypotheses require human review.
- The complete synthetic demonstration contains 100 orders, 100 payment rows, and 90 settlement rows. Its scenario-defined manifest is tested independently through the actual API.
- One local workspace and an operator label are supported. The label is not authentication, and the API must not be exposed publicly as a financial-data service.
- Imports accept CSV, TSV, XLSX, XLS, and XLSM with automatic recognition and editable column mapping. Files are bounded at 10 MiB and 10,000 transaction rows, with additional worksheet, column, cell, and expanded-workbook limits. UTF-8, BOM-marked UTF-16, and Windows-1252 text are supported.
- Ambiguous number formats, unfamiliar payment statuses, genuinely missing identifiers, and unsupported currency or precision still require an operator decision. Financial values are never guessed or silently rounded. Corrections and exclusions retain their reasons and original cells.
- Workbook formulas and macros are not executed. XLSX/XLSM formula cells require a literal correction or explicit use of an available stored result. Legacy XLS reads stored cell results and does not recalculate formulas. Password-protected files cannot be read.
- Repeated provider transaction references are conservatively excluded from automatic allocation pending documented human investigation. Manual approval also preserves duplicate-group exclusion; a case disposition cannot waive allocation safeguards. Eligible totals explain those exclusions.
- Partial payments remain unresolved and are not combined. Equal amounts with different references only suggest candidates.
- Matching imported files does not prove money moved, payment-provider integration exists, or a bank settlement completed.
- Affected recorded value is defined by evidence grouping and must not be interpreted as a loss total.
- Local database access can alter stored records outside the application's routes. Application-level audit guards do not provide cryptographic immutability.
- Database-neutral models and an included driver do not establish PostgreSQL correctness. PostgreSQL migration and integration execution, data transfer, and AWS deployment are unverified.
- The current backend TestClient emits a Starlette deprecation warning while using HTTPX. Tests pass with that warning recorded.

Hosted access preparation now includes Cognito sign-in and backend enforcement of trusted Gateway identities. Those controls have controlled local tests; actual Cognito/Gateway integration, TLS, secret storage, backup and restore, and PostgreSQL behavior still require deployment verification. Local mode remains unauthenticated. Changing DATABASE_URL connects to another database without transferring existing SQLite records.

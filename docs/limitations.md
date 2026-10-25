# Current Limitations

This is a proof of concept with local and authenticated AWS demonstration modes. Final learner review and submission work remain tracked in devpost/checklist.md.

- All three source types, settlement matching, fee checks, dashboard, human review, notes, audit history, and CSV reports are implemented. AI has controlled-response tests and real synthetic OpenAI checks locally and on AWS. Local credentials stay in an ignored environment file; hosted credentials stay server-side in Secrets Manager. Limited synthetic scenarios do not establish general explanation accuracy.
- The complete synthetic demonstration contains 100 orders, 100 payment rows, and 90 settlement rows. Its scenario-defined manifest is tested independently through the actual API.
- The application has one workspace. Local mode has an operational label without authentication and must stay on loopback. Hosted mode uses real Cognito authentication and operator-group access; it is a demonstration rather than a complete organization/account administration product.
- Imports accept CSV, TSV, XLSX, XLS, and XLSM with automatic recognition and editable mapping. Local limits are 10 MiB/10,000 rows; hosted synchronous limits are 4 MiB/1,000 rows. Worksheet, column, cell, and expanded-workbook bounds also apply. UTF-8, BOM-marked UTF-16, and Windows-1252 text are supported.
- Ambiguous number formats, unfamiliar payment statuses, genuinely missing identifiers, and unsupported currency or precision still require an operator decision. Financial values are never guessed or silently rounded. Corrections and exclusions retain their reasons and original cells.
- Workbook formulas and macros are not executed. XLSX/XLSM formula cells require a literal correction or explicit use of an available stored result. Legacy XLS reads stored cell results and does not recalculate formulas. Password-protected files cannot be read.
- Repeated provider transaction references are conservatively excluded from automatic allocation pending documented human investigation. Manual approval also preserves duplicate-group exclusion; a case disposition cannot waive allocation safeguards. Eligible totals explain those exclusions.
- Partial payments remain unresolved and are not combined. Equal amounts with different references only suggest candidates.
- Matching imported files does not prove money moved, payment-provider integration exists, or a bank settlement completed.
- Affected recorded value is defined by evidence grouping and must not be interpreted as a loss total.
- Local database access can alter stored records outside the application's routes. Application-level audit guards do not provide cryptographic immutability.
- RDS PostgreSQL 18.3 migrations, the independent synthetic oracle, review/audit, export, and uniqueness checks passed. The hosted browser workflow also passed. Other PostgreSQL configurations, production concurrency/capacity, backup restoration, and historical SQLite transfer are unverified.
- The current backend TestClient emits a Starlette deprecation warning while using HTTPX. Tests pass with that warning recorded.

The hosted workspace contains four synthetic demonstration records and no assumed real provider fee contract. The larger 100/100/90 fixture is retained in a dedicated verification database with explicitly synthetic fee rules. Existing SQLite records were not transferred or reset. Hosted provider-failure and Excel scenarios have not been repeated; local coverage does not establish every cloud execution path. Changing DATABASE_URL does not transfer existing records.

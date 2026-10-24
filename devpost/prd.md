---
doc: prd
status: approved
---

# ReconcileOS Product Requirements

ReconcileOS helps a finance officer at a Ghanaian small or medium-sized business reconcile imported orders, payment transactions, and settlement records, inspect evidence, and record human decisions.

Source: `scope.md > Who It's For`, `scope.md > The Unique Kernel`, and `scope.md > The POC Boundary`. This document formalizes the learner's supplied master brief. The learner approved the displayed PRD by responding "proceed". The requirements describe intended behavior, rather than claims about existing implementation.

## The Core Journey

1. Open the application in local single-workspace mode. On first use, see an empty dashboard and a clear route to Imports.
2. Download the three CSV templates or use the clearly labeled synthetic demonstration files.
3. Select an import type, upload a file, and inspect its columns, parsed rows, validation errors, duplicate warnings, and totals.
4. Confirm a valid import. See the persisted result in import history. A file with validation errors cannot be confirmed.
5. Repeat for the other sources, then start a reconciliation run. Orders and payments are sufficient to run; absent settlement records produce missing-evidence cases rather than a claim of failed settlement.
6. Inspect the run's recorded inputs, calculated summary, matches, and discrepancies. Search references and filter results without losing the selected run.
7. Open a discrepancy and inspect the exact records, source rows, rule explanation, and current review status.
8. Optionally request AI assistance. Read its labeled hypothesis, cited evidence, alternatives, limitations, and next step. A provider error leaves the case usable.
9. Add a note, approve or reject a valid proposed relationship when available, or resolve the case with a reason. Review the resulting audit entry and reopen the case when necessary.
10. Download the selected run's summary and discrepancy CSV reports. Return after restarting the application to find imported records, runs, decisions, and audit history intact.

Source: `scope.md > The Core Loop` and `scope.md > What "Working" Looks Like`.

## Screens and Layout

A compact application shell provides persistent navigation to Dashboard, Imports, Reconciliation, Investigations, and Reports. The workspace name and local operator context remain visible. Tables use readable column headings, status labels, aligned amounts, and actionable rows. Each screen has visible loading, empty, error, and success states appropriate to its workflow.

- Dashboard: latest run summary, matched values, unresolved cases, discrepancy categories, recent runs, and import activity. First use explains how to begin.
- Imports: import-type selection, templates, file upload, preview, validation feedback, confirmation, summary, and history.
- Reconciliation: run action, run selection, monetary summaries, matches with explanations, searchable references, filters, and links to discrepancies or source evidence.
- Investigations: searchable discrepancy list with type, severity, status, and run; case detail with records, rule evidence, notes, AI assistance, review actions, and audit history.
- Reports: selected-run summary, discrepancy breakdown, metric definitions, and downloadable CSV reports.

Navigation, links, filters, downloads, and actions must work. A screen must not show sample metrics as if they came from the operator's records.

Source: `scope.md > The POC Boundary`.

## Look and Feel

Use the learner's restrained financial software direction: information density, compact tables, consistent spacing, subtle borders, small corner radii, and clear operational language. Typography is Inter or IBM Plex Sans.

| Role | Color |
| --- | --- |
| Main surface | #FFFFFF |
| Page background | #F8F9F7 |
| Main text | #20262B |
| Secondary text | #52616B |
| Navigation and primary action | #17324D |
| Positive state | #28745A |
| Borders | #DDE2E3 |
| Error | #B83B3B |
| Warning | #A66A20 |

Use restrained icons and visible text labels. Follow the supplied restrictions on colors, effects, decoration, text, sample data, and generated artifacts. No fabricated charts, customers, endorsements, or provider integrations.

Source: `scope.md > Inspiration & Identity` and the learner's visual design system.

## Features and Behavior

### Local Workspace and Record Integrity

The application identifies one workspace and a clearly labeled local operator. This is an operational context, not an authentication claim. Financial records remain local unless the operator explicitly requests an AI investigation with a configured provider.

- Imported amounts, timestamps, references, original source values, source filename, and row provenance remain inspectable.
- Human actions change review state or create explicit relationships; they do not rewrite imported records.
- Different currencies remain distinct in matching, evidence, summaries, and exports.
- Monetary values use exact minor units and documented currency precision. Invalid or excessive precision is rejected instead of rounded silently.

Acceptance: restart the application after importing and reviewing a case; records, original values, review state, and history remain available.

Source: `scope.md > The Unique Kernel` and `scope.md > The POC Boundary`.

### CSV Import and Validation

Support orders, payments, and settlements as separate import types with downloadable templates and documented required columns.

- Preview shows the parsed row count, valid and invalid counts, representative rows, and row-specific errors. It identifies duplicate rows without discarding evidence silently.
- Validate identifiers, required columns, provider names, payment statuses, dates, currencies, numeric formats, and currency precision.
- Reject malformed monetary values, unsupported currencies, missing identifiers, malformed dates, unsafe uploads, and files above the documented limit.
- Confirmation is unavailable when validation errors exist. Warnings are distinguished from errors.
- Confirmation commits the complete valid batch atomically. A failed confirmation leaves no partial financial records.
- Re-uploading or reconfirming an already imported file for the same source and workspace does not create another set of financial records.
- A different export containing repeated provider references preserves that evidence for reconciliation and review.
- Import history shows source type, safe filename, status, row counts, timestamp, and a way to inspect its validation or provenance information.

Acceptance: import one valid file of each type; reject a malformed amount and missing required column; show understandable errors; confirm that importing the same file twice leaves the financial record count unchanged.

Source: `scope.md > The Core Loop` steps 2-3 and `scope.md > The POC Boundary`.

### Deterministic Reconciliation

A run compares a recorded input snapshot and explicit rule configuration. Repeating the same input and configuration produces the same financial decisions, explanations, and summary, excluding run identifiers and execution timestamps.

- Exact order-payment matches require matching order references, matching currency, equal amount, an eligible successful payment status, and no conflicting allocation.
- Payment-settlement matches require matching provider identity, payment reference, currency, and gross amount, with the recorded fee and net amount checked against explicit configured rules.
- Zero amount tolerance applies to automatic matching. No cross-currency matching, implicit conversion, or inferred success status is permitted.
- Multiple valid candidates remain unresolved. No candidate is selected arbitrarily.
- Partial payments remain review cases; the initial release does not automatically combine several payments into one fully reconciled order.
- The same order, payment, or settlement cannot be allocated twice within the applicable run and relationship type.
- A match explanation identifies the compared fields, decision rule, and supporting records.
- An imported settlement is evidence supplied in a file; matching it does not independently verify that money reached a bank account.

Acceptance: exercise exact, conflicting, ambiguous, partial, and cross-currency inputs; check the expected matches and explanations; repeat the run and compare its normalized results.

Source: `scope.md > The Unique Kernel` and `scope.md > The POC Boundary`.

### Discrepancy Detection and Evidence

Every case contains a stable type, severity, description, rule explanation, current investigation status, and linked source records. Detection includes:

| Type | Required meaning |
| --- | --- |
| Duplicate notification | Repeated imported notifications or provider references require review; this is not a fraud finding. |
| Duplicate import row | Identical rows are identified and their provenance is preserved. |
| Missing payment | An order has no reliable eligible payment match in the snapshot. |
| Unmatched payment | A successful payment lacks a reliable order relationship. |
| Missing settlement evidence | A payment lacks corresponding imported settlement evidence; settlement failure is not established. |
| Fee discrepancy | A recorded fee differs from the explicitly configured expectation. |
| Settlement discrepancy | Gross, fee, or net evidence fails the required identity or arithmetic checks. |
| Incorrect reference | A reference does not identify a reliable related record; any suggested alternative is a hypothesis. |
| Ambiguous match | Multiple candidates satisfy relevant conditions and need human review. |
| Partial payment | Payment evidence is below the expected amount and remains unresolved. |
| Amount or currency mismatch | Related references exist but the amounts or currencies prevent an exact match. |

Duplicate-reference groups that cannot be distinguished reliably remain subject to review. A warning alone must not silently turn repeated notification evidence into multiple confirmed receipts.

Acceptance: the synthetic demonstration includes the requested discrepancy types, and each result can be traced to the records named in the expected-results manifest.

Source: `scope.md > The Unique Kernel`, `scope.md > The POC Boundary`, and `scope.md > Explicitly Cut`.

### Dashboard and Monetary Summaries

Every figure is calculated from persisted records for a clearly identified run. Monetary figures are grouped by currency, never converted or added across currencies. Metric definitions remain available on the Reports screen.

| Metric | Required meaning |
| --- | --- |
| Total orders | Number of imported orders in the selected input snapshot. |
| Total eligible payments | Number of successful payment records eligible for consideration, with duplicate and conflict exclusions explained. |
| Total payment value | Gross recorded value of the eligible payment population; suspected duplicate handling must be explicit and reproducible. |
| Matched order value | Expected order value supported by accepted order-payment relationships, counted once per order. |
| Matched settlement value | Net settlement value supported by accepted payment-settlement relationships, counted once per settlement. |
| Unresolved discrepancy count | Number of cases still requiring action in the selected run. |
| Unresolved discrepancy value | Value associated with unresolved source records, using a documented valuation and deduplication rule. It is not a calculation of financial loss. |
| Duplicate notification count | Repeated notifications identified by the duplicate rule; the interface explains whether the count refers to extra rows or groups. |
| Missing payment count | Orders lacking reliable eligible payment evidence. |
| Missing settlement evidence count | Payments lacking reliable settlement evidence in the snapshot. |

Overlapping discrepancy categories are never summed into an asserted loss. Confirmed recorded differences, unmatched records, suspected duplicates, missing settlement evidence, and review cases have distinct labels. Review-state changes update the current case summary without changing the original run's deterministic matching decisions.

Acceptance: calculate the synthetic dataset's displayed values independently from its manifest and verify that overlapping cases do not inflate the documented aggregate.

Source: `scope.md > The POC Boundary`.

### Human Review, Notes, and Audit History

The operator can open a case, inspect its evidence and proposed relationships, add notes, approve or reject a proposal where applicable, resolve it with a documented reason, and reopen it with a documented reason.

- An open case may become in review, resolved, or remain open after a note. A resolved case can be reopened. Invalid transitions produce understandable errors.
- Consequential actions require a non-empty reason and the local actor identifier.
- Approving a proposal requires eligible records, compatible currency and amount, and no conflicting allocation. A manual reference association is identified as a human decision rather than an exact automatic match.
- Rejecting a proposal records the decision without falsely resolving an unexplained difference.
- Resolution means the operator documented a decision; it does not assert that money moved or that a missing settlement occurred.
- Reopening retains previous notes, decisions, investigations, and history. If a review-created allocation needs reversal, this must be an explicit validated action with its own audit event.
- Audit history records action, entity, actor, timestamp, reason, previous status, and new status. Application operations append entries rather than editing or deleting them.
- The interface describes this as an application-level audit history, without claims of cryptographic immutability.

Acceptance: add a note, make a permitted review decision, resolve and reopen a case, reject an invalid transition or conflicting allocation, and verify the persisted audit entries after restart.

Source: `scope.md > The Core Loop` steps 4-6 and `scope.md > The POC Boundary`.

### AI Investigation Assistance

AI assistance is an explicit action for one selected discrepancy and is available only when the server has compatible provider configuration. The operator is informed that relevant evidence will be sent to that provider.

- Send only bounded, relevant evidence. Imported descriptions are untrusted data, not instructions.
- The response must identify the selected discrepancy, proposed explanation, supporting record IDs, confidence classification, alternative explanations, next action, and limitations.
- Validate the response structure, discrepancy identifier, and every supporting record reference against the provided evidence.
- Reject unsupported record references and malformed output. Preserve the case and show an understandable error.
- Label the explanation as a hypothesis. Preserve useful validated output with provider and model metadata and its creation time.
- AI cannot create or alter financial records, approve a match, resolve a case, or perform financial operations.
- Missing credentials, a timeout, or a provider error leaves deterministic reconciliation and manual review available. Do not fabricate a substitute response.

Acceptance: validate a controlled valid response; reject a response that cites an unavailable record; verify graceful failure with missing configuration and provider failure. Report live-provider execution separately and only when actually performed.

Source: `scope.md > The Unique Kernel`, `scope.md > The POC Boundary`, and `scope.md > What "Working" Looks Like`.

### Reports and Export

The Reports screen shows the selected run, source snapshot, reconciliation summary, category counts, current review state, and metric definitions. CSV exports contain actual persisted run data, stable record references, and review status.

- Provide summary and discrepancy exports, with explicit currency and minor-unit meaning where amounts appear.
- Escape CSV fields correctly and neutralize formula-like user-supplied text in spreadsheet exports.
- Exported values follow the same accounting definitions as the interface.
- Empty runs produce an understandable state rather than a broken download.

Acceptance: export the synthetic run, parse the CSV, compare counts and values with the run, and verify formula-like source text cannot become an executable spreadsheet formula.

Source: `scope.md > The Core Loop` step 6 and `scope.md > The POC Boundary`.

### Synthetic Demonstration and Verification

Provide entirely synthetic records representing approximately 100 orders, 100 payment records, and 80 to 100 settlement records. Use fictional identifiers and label the files clearly. Include successful matches, missing and unmatched records, repeated notifications, fee differences, incorrect references, ambiguous relationships, and partial payments.

A machine-readable expected-results manifest supports repeatable checks of matches, cases, counts, and amounts. Automated tests cover the learner's requested import, financial, reconciliation, review, audit, AI validation, and export behavior. Browser verification covers the complete workflow when practical. Recorded execution and unavailable checks remain clearly distinguished.

Acceptance: start the application using the documented Windows commands, initialize local persistence, import the demonstration files, complete the core journey, and compare the resulting summary with the manifest.

Source: `scope.md > What "Working" Looks Like` and `scope.md > The POC Boundary`.

## States and Boundaries

- First use: no invented records or metrics; show an explanation and an import action.
- Loading: show progress for imports, runs, investigations, and exports; prevent accidental repeated confirmation.
- Invalid input: show actionable field or row errors and keep the rest of the application usable.
- Duplicate import: explain that the file was already imported and link to its history entry.
- Incomplete sources: identify absent input types and interpret resulting cases as evidence gaps.
- Run failure: show a safe error; do not present partial output as a successful run.
- AI failure: preserve the case and offer manual review or a later retry.
- Review conflict: reject the conflicting action and show the current state for refresh.
- Persistence: records, provenance, completed runs, review state, notes, AI results, and audit entries survive restart.
- Privacy boundary: local single-workspace use; financial data is not exposed publicly. Any later public service requires authentication and access controls.

## Product Decisions

The learner selected the product identity, Ghanaian initial market, five screens, CSV-based workflow, deterministic engine, human review, optional AI assistance, local single-workspace mode, visual system, synthetic dataset scale, test expectations, and deadline.

Approved interpretations in this PRD are strict whole-file validation before confirmation, zero automatic matching tolerance, no automatic partial-payment aggregation, documented duplicate eligibility, and explicit reversal of review-created allocations. These preserve the supplied correctness requirements.

## What We're Building

The complete core journey and features defined above, with native Windows startup, exact financial arithmetic, persisted evidence, useful errors, automated verification, and documentation that distinguishes implemented and tested behavior from future work.

## Deferred From the POC

PostgreSQL migration and integration verification, AWS hosting, authenticated public access, multiple workspaces, live provider connections, advanced allocation, and additional import mapping. These require separate testing, security work, or explicit deployment authorization.

## Possible Later Enhancements

Configurable provider import mappings, richer supported currencies, settlement timing rules, stronger audit protection, and authenticated collaboration may follow after the core workflow is proven. They are not acceptance criteria for this build.

## Non-Goals

Money movement, transfer initiation, bank connectivity, fraud adjudication, automatic AI financial decisions, public unauthenticated financial access, Docker repair, billing, and distributed infrastructure are outside this proof of concept.

## Open Questions

No additional product interview is needed for decisions already supplied in the master brief. The displayed PRD is approved.

The technical specification must make currency precision, eligible statuses, duplicate grouping, monetary valuation anchors, configured synthetic fee rules, file-size limits, input snapshot consistency, and review conflict handling explicit before implementation. These are engineering details derived from the approved financial safeguards. Any material change to the behavior described here requires a revised review.

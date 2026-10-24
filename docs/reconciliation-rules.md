# Implemented Reconciliation Rules

Rule version: three-source-1. Each run freezes source records and its fee configuration. Older order-payment-1 runs remain historical results and are marked stale.

## Source Eligibility

References are trimmed and remain case-sensitive. Currencies and providers are normalized to uppercase, statuses to lowercase, and timestamps to UTC with an explicit input timezone. Original source text is retained.

Orders with open or completed status can match; cancelled orders remain recorded but are excluded. Only successful payments are eligible. Pending, failed, and reversed records do not establish a successful receipt.

A payment key is provider plus transaction_ref. Every member of a repeated key group is blocked from automatic allocation, including groups with conflicting statuses, currencies, or amounts. This conservative policy requests review; it does not determine fraud or prove that no funds were received. The duplicate-notification metric counts extra rows, sum(group_size - 1), rather than groups. Identical source-row hashes also produce a duplicate_import_row case.

## Exact Matching

Group active orders and eligible payments by order_ref, currency, and integer amount. Accept a pair only when that exact group contains one order and one payment. Several orders or payments in the group create an ambiguous_match case. An amount difference of one minor unit still prevents an exact match. Equal amounts with different references can only suggest candidates for review.

The current engine detects missing payments, unmatched payments, duplicate notifications and rows, ambiguous exact candidates, partial payments, amount differences, and currency differences. A missing-payment case means no successful same-reference payment evidence exists in the snapshot. Partial payments are not added together, even when their combined amount equals the order value. An unallocated eligible successful payment also has an unmatched-payment case, so some records support more than one case.

Cases contain stable keys, typed source record IDs, the relevant rule, and any candidate identities. The engine does not mutate source data, choose an ambiguous candidate, use amount tolerance, convert currencies, or call an LLM.

## Exact Monetary Representation

Supported precision is GHS=2, USD=2, EUR=2, GBP=2, JPY=0, and KWD=3. A value such as GHS 125.50 is stored as 12550. Decimal is used to parse ordinary decimal CSV text. The import adapter recognizes supported currency markers, valid grouping and decimal formats, exact scientific notation, and non-significant trailing zeros. Explicit minor-unit source amounts are scaled using Decimal and currency precision. Ambiguous formats require an operator choice; non-finite values, genuine excess precision, and malformed amounts are rejected. No rounding occurs during ingestion. Each record is bounded at 1,000,000,000,000 minor units.

Python integers perform matching and aggregation. API monetary minor units and summary monetary totals are decimal strings. Browser formatting uses BigInt. Currency codes always accompany values, and totals stay grouped by currency.

The shared decimal_amount function uses integer division and currency precision to render exact decimal strings for both CSV reports and AI evidence. AI receives separately labeled minor units, decimal amounts, formatted displays, and precision. This avoids presenting an unlabeled minor-unit integer as a currency-unit amount. It does not grant the model authority to change recorded money or financial relationships.

## Summary Definitions

- Total orders includes all imported order records, with the cancelled count shown separately.
- Total eligible payments and eligible payment value include successful payment rows outside repeated provider transaction groups.
- Excluded duplicate payment records and value describe successful rows excluded by that policy. They are not an independent-loss calculation.
- Matched order value sums accepted exact order amounts once each.
- Unresolved case count counts case records requiring review; category counts can overlap in the source records they concern.
- Missing-payment count counts orders with no successful same-reference payment evidence.
- Duplicate notification count counts extra rows in repeated provider transaction groups.

Affected recorded value avoids adding every case amount separately. Connect unresolved cases that share linked source identities and connect accepted match evidence. For each connected group and currency, value distinct active order records if present; otherwise value payments once per provider transaction key; otherwise value settlement gross evidence. For conflicting repeated payment values within one currency, use the largest recorded value for that key. Sum the resulting group values by currency. Candidate evidence can connect records for this conservative record-valuation policy without approving a financial relationship. The result is a measure of affected source records, not confirmed loss or an independent assertion about funds.

The four-order fixture demonstrates the overlap rule: partial and unmatched-payment cases for one order contribute GHS 60.00 once, and repeated-notification and duplicate-row cases contribute their related GHS 95.00 order once. With settlement evidence checks enabled, the small fixture also flags three missing-evidence cases; see sample-data/slice1/expected-results-complete.json. The original first-slice manifest is preserved separately.

## Snapshot and Allocation Invariants

The same snapshot and rule configuration produce identical normalized decisions, stable case keys, and monetary summaries. Execution IDs and timestamps differ between runs. Later imports mark earlier snapshots stale but do not rewrite them.

Human review is separate from those automatic decisions. Notes and state changes require the current case version and a documented reason. A manual order-payment approval requires snapshot candidate membership, an active order, a successful payment outside duplicate groups, exact currency and amount, and free allocation keys. The operator may explain an incorrect reference; imported references remain unchanged. Approval leaves other related cases open. Reopening does not release an accepted relationship. Explicit manual reversal releases its allocation while retaining the match and decision history. Automatic matches cannot be reversed through this interface. Current summaries exclude resolved cases and reversed relationships, while original automatic summaries remain stored.

Persisted active allocation keys are unique per run and relationship type. They include the order or settlement row, payment row, and logical payment key, separately for each relationship type. Results and the completed status commit together. A failed result transaction does not expose partial matches or cases.

Payment-settlement matching requires unique provider and transaction identity, equal currency and gross amount, net equal to gross minus fee, and an exact configured fee. Multiple candidates create ambiguous_settlement cases. Reference-linked gross, currency, or net-equation differences create settlement_discrepancy; an unexpected configured fee creates fee_discrepancy. No configured provider/currency rule creates fee_rule_missing. Missing provider/reference evidence creates missing_settlement_evidence and does not prove failure. Unreliable or orphan settlement records create unmatched_settlement.

Fee expectations use integer arithmetic: (gross_minor * basis_points + 5000) // 10000 + fixed_minor. This rounds the percentage half up to the nearest minor unit. No default percentage is inferred. sample-data/fee-rules.json is explicitly synthetic and must be replaced for real records.

Matched settlement value sums accepted recorded net amounts once. Matched order value sums accepted order gross amounts once. These are separate metrics. Missing-settlement counts refer to distinct eligible payments with missing-evidence cases. No current result independently proves a bank settlement or a real provider integration.

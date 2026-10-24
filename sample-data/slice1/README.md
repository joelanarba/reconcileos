# First-Slice Synthetic Fixtures

These fictional records are a small, hand-verifiable fixture. They do not represent real businesses, receipts, provider integrations, or completed settlements. The larger three-source demonstration dataset is added in the settlement slice.

Import orders.csv as Orders and payments.csv as Payment transactions, confirming each preview. Start reconciliation and compare the result with expected-results.json. Use invalid-orders.csv separately to inspect validation feedback; it must not be confirmed.

The exact pair is SYN-ORD-1001 and SYN-PAY-1001. SYN-ORD-1002 lacks payment evidence. SYN-ORD-1003 has a partial payment. Two identical notifications for SYN-PAY-1004 are preserved and blocked from automatic allocation. SYN-PAY-1005 has an unknown order reference.

The six cases include two flags for the repeated evidence and both a partial-payment and unmatched-payment case for the same partial record. Affected recorded value is GHS 385.00: GHS 80.00 for the missing order, GHS 60.00 for the partial order, GHS 95.00 for the repeated-notification order, and GHS 150.00 for the independent unmatched payment. Overlapping cases do not add the same order or notification value twice. This is affected recorded value, not a loss calculation.

The manifest was specified from these scenarios and arithmetic independently of engine output. All amounts are integer minor-unit strings in the manifest.

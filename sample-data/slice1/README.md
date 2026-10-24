# First-Slice Synthetic Fixtures

These fictional records are a small, hand-verifiable fixture. They do not represent real businesses, receipts, provider integrations, or completed settlements. The larger three-source demonstration is available in ../demo.

Import orders.csv as Orders and payments.csv as Payment transactions, confirming each preview. Start reconciliation and compare the current engine with expected-results-complete.json. Use invalid-orders.csv separately to inspect validation feedback; its unresolved invalid value prevents confirmation. Original source cells remain retained after a reasoned preview correction.

The exact pair is SYN-ORD-1001 and SYN-PAY-1001. SYN-ORD-1002 lacks payment evidence. SYN-ORD-1003 has a partial payment. Two identical notifications for SYN-PAY-1004 are preserved and blocked from automatic allocation. SYN-PAY-1005 has an unknown order reference.

The original order-payment-1 engine produced six cases and GHS 385.00 affected recorded value; expected-results.json preserves that historical oracle. The complete three-source engine also flags three eligible payments with missing settlement evidence, since this fixture has no settlement file. It produces nine cases and GHS 510.50 affected recorded value: GHS 125.50 for the otherwise matched order's missing settlement evidence, GHS 80.00 for the missing order, GHS 60.00 for the partial order, GHS 95.00 for the repeated-notification order, and GHS 150.00 for the independent unmatched payment. Overlapping cases do not add the same order or notification value twice. This is affected recorded value, not a loss calculation or proof of settlement failure.

The manifest was specified from these scenarios and arithmetic independently of engine output. All amounts are integer minor-unit strings in the manifest.

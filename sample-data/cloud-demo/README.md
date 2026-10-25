# Synthetic Hosted Demonstration

These four records are entirely synthetic. They exercise a fresh hosted workspace without assuming a real provider's fee contract. Expected values are hand-specified in expected-results.json.

The first order and payment match exactly at GHS 125.50. The second order has no payment evidence. A settlement record exists for the first payment, but no fee contract is configured, so the engine requires review instead of accepting that relationship. GHS 325.50 is the combined affected recorded value across those two independent cases, not a financial loss.

The larger demo/ dataset and its configured synthetic fee rules are verified independently in a dedicated PostgreSQL test database. Do not mix either dataset with real records during an automated verification run.

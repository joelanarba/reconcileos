# Two-minute demonstration

Use synthetic records only. The public route requires no account and cannot save decisions. Prepare an operator tab in advance if demonstrating a review action. The refined interface requires the reviewed release to be deployed before recording the hosted site.

| Time | Show | Suggested narration |
| --- | --- | --- |
| 0:00-0:15 | Landing page and Try the demo | A business can have an order, a payment notification, and a settlement entry that do not agree. ReconcileOS compares those exports so a finance officer can focus on the differences. |
| 0:15-0:35 | Dashboard, then reconciliation | This synthetic run compares orders, payments, and settlements. The accepted values and unresolved case counts are calculated from those files. Order value and settlement net describe separate relationships. |
| 0:35-1:05 | Filter Review cases to Payment below order value, then open a case | Here the order and payment amounts differ. Both source records are visible, along with the exact difference, the rule, and what remains uncertain. Missing evidence is not treated as confirmed loss. |
| 1:05-1:25 | Open Take a two-minute tour, then Read a saved AI investigation | This is a saved response from an actual provider request. It suggests a relationship, cites supporting records, and describes limitations. It cannot approve a match or change money. If the link is absent, say no saved response is available. |
| 1:25-1:45 | Prepared operator tab, open a case, add a reasoned note and show audit history | The operator records what was checked. Decisions are saved with a reason, a case version, and an actor. Use Add note for a repeatable demonstration; only resolve a case when its disposition is supported. Public visitors cannot do this. |
| 1:45-2:00 | Reports, export summary CSV | The report keeps currencies separate and preserves the original automatic summary alongside the current review results. The outcome is a focused investigation queue with traceable evidence and recorded decisions. |

If recording only the public demo, spend the operator segment on source/import history and the saved case's audit history instead. Do not imply that a public visitor saved a review. Prepare the source files and completed run before recording; a two-minute video need not wait through three imports. CSV and Excel imports are implemented and may be shown briefly if time permits.

Do not promise time savings, measured accuracy, customer adoption, bank verification, or live provider integrations. A live AI request is optional; rehearse using the saved response so provider latency does not control the recording.

## Short project description draft

ReconcileOS helps finance teams compare order, payment, and settlement exports and investigate the differences. It imports CSV and Excel files, applies deterministic matching rules, and links each result to its source evidence. Finance officers can inspect exact amounts, add notes, review supported associations, and export reconciliation reports with recorded review history.

Optional AI assistance examines bounded case evidence and saves a hypothesis with supporting references, alternative explanations, and limitations. Human reviewers retain control of financial decisions. A separate synthetic read-only demo lets visitors explore the product without an account. The application uses React and TypeScript, FastAPI, SQLite for local development, and PostgreSQL in the existing AWS deployment.

The project was developed with AI assistance using the Devpost Build With AI: Basics Learn Skill Pack. The original scope, PRD, and technical specification remain in the repository. This draft is for the learner to review and adapt; it does not claim that a video or Devpost submission has been completed.

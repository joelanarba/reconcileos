# Local Demonstration Operations

For the deployed refined interface, use the [two-minute recording sequence and project description draft](release-demo.md). The October 26 release was published and verified after explicit production approval. The operations below also describe earlier recorded workflows.

## Public Judge Route

Open https://dbedhac79djfv.cloudfront.net and choose Try the demo. No credentials are required. The banner identifies a separate synthetic read-only workspace. Inspect the dashboard, open reconciliation evidence, follow import provenance, inspect the saved AI hypothesis when available, and download a report. The numbers come from the actual imported 100/100/90-record fixture and its recorded engine run. A saved provider hypothesis is labeled as an example; public visitors do not initiate provider calls. Sign-in is reserved for actual import and review actions in the protected operator workspace.

This is a technical sequence to record, not a narration or a claim that a video exists. Use fictional files only and keep unrelated windows and credentials out of view. The learner supplies the narration and uploads the final video under the Devpost workflow.

For a clean demonstration, start a separate backend process with a new DATABASE_URL such as sqlite:///./data/demo-recording.db and FEE_RULES_PATH=../sample-data/fee-rules.json. Apply Alembic migrations in that same process environment before starting Uvicorn. Use the ordinary loopback ports only when their previous services have been stopped deliberately. Preserve any existing financial workspace; never clear it for the recording. Start the frontend using README instructions.

The following approximate two-minute sequence can be shortened through rehearsal:

| Approximate time | Visible operation | Evidence to show |
| --- | --- | --- |
| 0:00-0:25 | Open Imports and upload the three sample-data/demo files under their source types. | Recognized CSV/Excel import workflow, preview, and confirmation. Templates are optional. |
| 0:25-0:45 | Start reconciliation and open Dashboard. | 79 accepted order relationships, 80 settlement relationships, 54 cases; values come from the backend. |
| 0:45-1:05 | Inspect a fee discrepancy or missing settlement evidence case. | Rule explanation, exact source amounts, original records, and clear evidence-gap language. |
| 1:05-1:40 | In Investigations search SYN-TXN-0086, inspect its candidate, add a note, and approve the supported association with a reason. Resolve or reopen the case. | Human decision, equal-currency/amount checks, local actor, and persisted audit history. Related cases remain separately reviewable. |
| 1:40-2:00 | Open Reports and download a summary CSV. Show AI availability honestly. | Original/current summary distinction, exact currency values, and the optional configured or unconfigured assistance state. |

Before review actions, the independent manifest expects matched order value GHS 11,228.00, matched settlement net GHS 11,271.15, eligible payment value GHS 13,868.00 plus USD 193.00, and affected recorded value GHS 5,153.00 plus USD 193.00. These metrics have different meanings; affected value is not a loss claim. Review actions change current summaries, so do not expect the original manifest after an accepted manual association or resolved case. Original automatic values remain available in Reports and exports.

Do not stage a live AI response when no provider is configured. A genuine unavailable state can be shown. If a provider is later configured, demonstrate only a real, validated hypothesis and disclose its role. A recording should visibly show the functioning application, not replace it with slides or decorative charts. Confirm the actual submission form's video constraints before uploading.

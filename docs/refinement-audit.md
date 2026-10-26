# Product refinement audit

Inspected October 26, 2026, before implementation. The existing architecture is retained.

## Findings and order of work

| Priority | Finding | Action |
| --- | --- | --- |
| 0 | No critical financial or authorization defect found in inspected paths. Exact integer money, per-currency totals, allocation constraints, review versions, and demo write denial are implemented. | Preserve these paths and rerun the independent oracle and security tests. |
| 1 | Essential table headings, form labels, provenance, and navigation metadata use 8-12px text. Section headings compete with body text. | Use a readable type scale, consistent controls, simpler shell, and stronger section hierarchy. |
| 1 | Case details sit below the full queue. Records require a dialog; AI limitations and references require reading JSON. | Give selected cases a dedicated evidence-centered layout, exact comparisons, practical next actions, structured saved AI results, and nearby review controls. |
| 2 | Dashboard shows every category, repeated explanations, multiple activity tables, and a competing AI promotion. | Prioritize the latest snapshot, accepted value, unresolved work, and one next action; limit categories and make secondary details optional. |
| 2 | Reconciliation repeats long rule explanations in rows. Tabs lack arrow-key behavior. Review count describes unresolved cases while the default list includes resolved cases. | Shorten rows, link directly to cases, make table scrolling explicit, add accessible tabs, and default to unresolved work. |
| 2 | Reports display all metric definitions permanently. | Prioritize results and export; collapse definitions while retaining monetary qualifications. |
| 2 | Run listing calculates summaries for every run before slicing the requested page. | Page database results before summary calculation. Preserve response semantics. |
| 2 | A blocked demo mutation is wrapped as a connection failure in the API client. | Preserve the truthful read-only error. |
| 3 | Landing page emphasizes process more than the finance team's problem. No concise guided demo path exists. | Clarify the audience and outcome, retain computed preview values, and provide optional navigation through real demo evidence. |

## Verified implementation and limits

The engine supports exact and ambiguous matches, amount and currency differences, duplicate notifications and rows, missing and unmatched payments, partial payments, missing settlement evidence, unmatched and ambiguous settlements, fee differences, and missing fee rules. It uses a frozen snapshot, integer minor units, currency separation, and persistent allocation uniqueness. Affected recorded value groups connected evidence; it is not financial loss.

Review notes, reasoned decisions, resolve/reopen, supported candidate approval/rejection, explicit manual reversal, optimistic versions, and audit history are implemented. Records remain unchanged. CSV exports contain original/current summaries, exact currency values and current case state, with formula neutralization.

AI makes actual server-side HTTP requests and saves validated structured hypotheses. Evidence is limited to 20 relevant records and 16 KiB. Case and supporting IDs are validated; a stale response is rejected. Provider errors leave financial decisions unchanged. Availability reports configuration, not live provider health. The public demo only reads saved responses. Historical live AWS/OpenAI verification is documented separately; it is not a new execution in this refinement.

AWS configuration uses Cognito/API Gateway verification and backend trusted-context/operator checks. Public demo dispatch rejects mutations and uses a separate database; runtime SELECT-only permissions are recorded in the deployment evidence. Browser caches are separate. Secrets remain server-side. Local mode intentionally has no authentication and binds to loopback. This audit does not establish production capacity, backup restoration, broad model accuracy, or a new hosted deployment.

Baseline executed checks: 185 backend tests passed with one existing Starlette TestClient deprecation warning; 22 frontend tests passed. The independent synthetic oracle verifies 100 orders, 100 payments, 90 settlements, 79 order relationships, 80 settlement relationships, 54 unresolved cases, GHS 11,228.00 accepted order value, and GHS 11,271.15 accepted settlement net. These values are computed from records, not UI constants.

No new infrastructure, dependencies, provider integrations, automatic financial decisions, or paid services are planned. Original Devpost planning documents and truthful AI development disclosures are preserved.

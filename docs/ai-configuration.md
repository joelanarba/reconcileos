# Optional AI Investigation

No provider, account, API key, or model is selected by default. No live AI request was executed during this build. The tests inject controlled HTTP responses and establish adapter behavior, evidence validation, and failure handling, not model quality or provider availability.

## Configure on the Backend

Set LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL in the ignored backend/.env file or the backend process environment. Use the chosen provider's documented HTTPS API base URL; the adapter appends /chat/completions. Embedded credentials, query strings, fragments, redirects, and ordinary HTTP endpoints are rejected. LLM_ALLOW_LOOPBACK exists only for explicitly configured local test servers and defaults to false. Credentials must never use a VITE_ variable or be pasted into frontend code.

Set LLM_RESPONSE_FORMAT to json_object or, only when the provider supports it, json_schema. The request contains model, messages, response_format, and max_tokens. The response must contain choices[0].message.content as a JSON string. Providers and models vary; confirm the chosen contract in primary provider documentation and perform a synthetic request before using real evidence. This project does not claim universal provider compatibility.

Restart the backend, open a case under Investigations, check the displayed provider/model, review the disclosure, and explicitly select the evidence-consent checkbox. A configuration indication does not prove the provider is currently reachable. The API key is never returned to the browser. Failed requests return a safe message without provider payloads or secrets.

## Evidence and Validation

Only the selected case's snapshot records are eligible. Send at most 20 records and 16 KiB, including typed record IDs, relevant references, currency, integer amounts, dates, statuses, and descriptions truncated to 500 characters. Original raw columns and unrelated records are omitted. Context reductions are recorded in metadata. The fixed system instruction treats descriptions and references as untrusted evidence rather than instructions.

The response must identify the selected discrepancy, propose a hypothesis, cite unique allowed typed record IDs, classify confidence as low/medium/high, describe alternatives, suggest a next investigation step, and state limitations. Extra fields, missing limitations, invented supporting IDs, wrong cases, and malformed structures are rejected. A version check rejects a response if another review action changed the case during the request. Validated explanations and safe provider/model/context metadata are appended to investigation history with an audit entry. Case disposition, imported values, and accepted financial relationships do not change.

Requests have an overall timeout of 3 to 45 seconds, default 20, with a separate connection timeout. Redirects and retries are disabled. Response envelopes are limited to 64 KiB, generated content to 16 KiB. Explicitly requested uncompressed JSON keeps response limits straightforward. Provider errors, unavailable configuration, timeout, and unsupported responses preserve deterministic reconciliation and manual review.

Human review remains necessary. A schema-valid hypothesis can still be wrong. The application does not present it as proof of receipt, settlement, or an approved match.

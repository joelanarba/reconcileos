# Optional AI Investigation

OpenAI is the selected provider. The configuration uses https://api.openai.com/v1 with gpt-5.4-mini-2026-03-17 and json_schema output. Live verification completed with synthetic evidence on October 24, 2026. No API key is distributed with the repository. The result establishes the tested request, validation, and persistence path; it does not establish general model accuracy.

## OpenAI Setup

The selected snapshot supports Chat Completions and Structured Outputs according to the [official model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini). The adapter uses the documented max_completion_tokens parameter and requests store=false. The strict schema limits case and supporting-record IDs to the supplied evidence; backend validation also enforces all field bounds. See the [Chat Completions reference](https://developers.openai.com/api/reference/python/resources/chat/subresources/completions/methods/create) and [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat).

1. Create or select a key in your [OpenAI API project](https://platform.openai.com/api-keys).
2. Add it after LLM_API_KEY= in your ignored backend/.env file. Keep it out of chat, source files, and frontend variables. Endpoint, model, and output-format settings are prepared there; the shared example contains no key.
3. Restart the backend. Investigations shows the selected provider and enables Request AI assistance only when complete configuration is loaded. That indication is not evidence of a successful provider request.
4. From backend, run the following only when you intend to authorize one bounded API request using synthetic records:

```powershell
.\.venv\Scripts\python.exe verify_ai.py --confirm-synthetic-request
```

The provider can charge for that request. The script creates a new ignored ai-check database, applies actual migrations, imports two entirely synthetic records through the API, starts reconciliation, requests one explanation, and verifies validated persistence plus unchanged financial summaries. It retains the isolated verification database for inspection and does not read or change the ordinary financial workspace. A failed request does not count as live verification. No automatic retry is made.

OpenAI credential/access rejections, usage limits, refusals, and incomplete generations receive specific safe errors. No raw provider payload or key is returned to the browser. Other providers remain configurable through the generic adapter.

## Configure on the Backend

Set LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL in the ignored backend/.env file or the backend process environment. Use the chosen provider's documented HTTPS API base URL; the adapter appends /chat/completions. Embedded credentials, query strings, fragments, redirects, and ordinary HTTP endpoints are rejected. LLM_ALLOW_LOOPBACK exists only for explicitly configured local test servers and defaults to false. Credentials must never use a VITE_ variable or be pasted into frontend code.

Set LLM_RESPONSE_FORMAT to json_object or, only when the provider supports it, json_schema. The request contains model, messages, response_format, and a bounded completion limit. OpenAI uses max_completion_tokens; the compatible-provider path retains max_tokens. The response must contain choices[0].message.content as a JSON string. Refusals and explicitly incomplete choices are rejected. Providers and models vary; confirm another provider's contract in primary documentation and perform a synthetic request before using real evidence. This project does not claim universal provider compatibility.

Restart the backend, open a case under Investigations, check the displayed provider/model, review the disclosure, and explicitly select the evidence-consent checkbox. A configuration indication does not prove the provider is currently reachable. The API key is never returned to the browser. Failed requests return a safe message without provider payloads or secrets.

## Evidence and Validation

Only the selected case's snapshot records are eligible. Send at most 20 records and 16 KiB, including typed record IDs, relevant references, currency, dates, statuses, and descriptions truncated to 500 characters. Each monetary fact includes explicit currency precision, integer minor units as a string, an exact decimal string, and its formatted display. The shared integer formatter also serves reports. The model is instructed to copy a displayed amount exactly when mentioning it. Original raw columns and unrelated records are omitted. Context reductions are recorded in metadata. The fixed system instruction treats descriptions and references as untrusted evidence rather than instructions.

The response must identify the selected discrepancy, propose a hypothesis, cite unique allowed typed record IDs, classify confidence as low/medium/high, describe alternatives, suggest a next investigation step, and state limitations. Extra fields, missing limitations, invented supporting IDs, wrong cases, and malformed structures are rejected. A version check rejects a response if another review action changed the case during the request. Validated explanations and safe provider/model/context metadata are appended to investigation history with an audit entry. Case disposition, imported values, and accepted financial relationships do not change.

Requests have an overall timeout of 3 to 45 seconds, default 20, with a separate connection timeout. Redirects and retries are disabled. Response envelopes are limited to 64 KiB, generated content to 16 KiB. Explicitly requested uncompressed JSON keeps response limits straightforward. Provider errors, unavailable configuration, timeout, and unsupported responses preserve deterministic reconciliation and manual review.

Human review remains necessary. A schema-valid hypothesis can still be wrong. The application does not present it as proof of receipt, settlement, or an approved match.

## Executed Live Check

Two bounded requests were made with entirely synthetic order/payment records in separate ignored databases. The first passed the transport, response-schema, evidence-ID, persistence, and unchanged-summary checks, but inspection found that its hypothesis described 12550 minor units as GHS 12,550. That is an incorrect amount display and was not accepted as evidence of explanation accuracy. The original isolated result remains preserved.

The correction supplies explicit precision and deterministic decimal/display values, with automated GHS, JPY, and KWD checks. The second live response correctly used GHS 125.50, retained valid supporting IDs, saved an investigation and audit event, and left the case status, snapshot, original summary, and current financial summary unchanged. The complete backend suite passed 144 tests. A new Uvicorn process then loaded the saved result, and an actual Edge browser check verified the hypothesis, exact source amounts, and consent-gated request control without another AI call.

Both requests used the selected GPT-5.4 Mini snapshot. This is one synthetic scenario and a verified correction, not a quality evaluation across all discrepancy types. See docs/testing.md for the actual trial identifiers and scope.

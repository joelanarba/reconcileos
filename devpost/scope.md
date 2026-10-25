---
doc: scope
status: approved
---

# ReconcileOS

A local financial operations application that helps a finance officer compare order, payment, and settlement CSV records, investigate differences, and document review decisions.

## The Unique Kernel

Deterministic reconciliation produces explainable results linked to imported source records. Ambiguous financial relationships remain subject to human review. Optional AI assistance summarizes bounded evidence and proposes hypotheses without changing financial records or approving matches.

## Who It's For

A finance officer or operator at a small or medium-sized business in Ghana that accepts payments through multiple channels and currently compares exports manually. Initial use is one operator working in one local workspace.

## The Core Loop

1. Open the local application and review the current reconciliation summary.
2. Upload orders, payment transactions, and settlement CSV files, inspect validation results, and confirm valid imports.
3. Start a reconciliation run against a recorded input snapshot.
4. Review exact matches and discrepancies, following their explanations to the source records.
5. Investigate a case, optionally request AI assistance, record a note, and make a documented human decision.
6. Export a report and return later to the persisted records, cases, and audit history.

## Inspiration & Identity

Restrained financial software with compact tables, clear operational language, subtle borders, small corner radii, and Inter or IBM Plex Sans typography. Use the supplied white, off-white, charcoal, slate, navy, muted green, border gray, red, and amber palette. New application artifacts must follow the learner's restrictions on styling and text. Synthetic records and AI involvement must be labeled truthfully.

## Why This Matters to the Learner

The stated goal is a credible, maintainable financial reconciliation system that demonstrates substantial engineering through a complete, reliable workflow. No additional personal motivation is assumed.

## What "Working" Looks Like

On a Windows laptop, the operator imports three synthetic CSV files, runs reconciliation, inspects a discrepancy with supporting records, records and reopens a documented review decision, and downloads a report. Results come from stored records and exact arithmetic. Automated checks verify the expected synthetic outcomes and financial invariants. The workflow can be shown in a short video.

AI assistance works when a compatible provider is configured. Missing credentials or provider failures produce an understandable error while deterministic reconciliation remains available. Verification against a live provider must be reported separately from tests using controlled responses.

## The POC Boundary

- React and TypeScript frontend with Dashboard, Imports, Reconciliation, Investigations, and Reports screens.
- FastAPI modular monolith, SQLAlchemy models, Alembic migrations, and local SQLite persistence.
- CSV and Excel imports, automatic format and common-header recognition, adjustable column mapping, preview corrections and explicit row exclusions, optional templates, bounded uploads, atomic confirmation, provenance, import history, and duplicate-file prevention.
- Deterministic order-to-payment and payment-to-settlement matching with exact currency-aware integer arithmetic and explicit configured fee rules.
- Detection of duplicate notifications, missing payments, unmatched payments, missing settlement evidence, fee differences, incorrect references, ambiguous candidates, and partial payments.
- Accurate metric definitions that avoid treating overlapping discrepancies as independent losses.
- Persisted human review, notes, proposed-match decisions, case resolution and reopening, and an application-level append-only audit history.
- CSV report export with formula-injection protection.
- Optional server-side AI assistance with bounded evidence, validated structured responses, and explicit failure handling.
- Approximately 100 synthetic orders, 100 payment records, and 80 to 100 settlement records, an expected-results manifest, and meaningful automated tests.
- Windows startup instructions, architecture and reconciliation documentation, honest verification records, demo guidance, and submission preparation using the remaining relevant Devpost skills.

## Later

- PostgreSQL migration and integration testing against an independently provisioned database before claiming compatibility.
- Authenticated AWS deployment after the local application is stable and deployment is explicitly requested.
- Additional currencies, reusable provider mapping profiles, more advanced payment allocation, and multiple workspaces after the core workflow is proven.

## Explicitly Cut

- Live bank or payment-provider integration and money movement: outside the reconciliation proof of concept.
- Public unauthenticated access: inappropriate for financial data; the initial service runs locally.
- Docker, WSL, virtualization changes, and local PostgreSQL installation: incompatible with the supplied development constraints.
- Microservices, queues, distributed caches, billing, subscriptions, and multi-tenant account infrastructure: unnecessary for the core loop.
- AI-generated financial truth and automatic AI resolution: inconsistent with evidence-based financial review.
- Production-readiness, completed-settlement, verified PostgreSQL, and live-provider claims without corresponding evidence.

## Review

This document distills the learner's supplied master brief. The learner approved the displayed scope by responding "proceed". The scope is broader than the curriculum's usual small experiment, so implementation must follow the supplied priority order and preserve the complete core workflow.

The learner's first hands-on feedback explicitly requested ordinary CSV and Excel acceptance, flexible column names, and less import preparation. That instruction authorizes the import-format and mapping expansion above. Exact monetary validation and evidence preservation remain required.

On October 25, the learner requested a proper landing page, easier judge access, and a stronger interface after trying the hosted link. This authorizes a public introduction, a separate read-only synthetic demonstration, custom Cognito sign-in, and a coherent workspace redesign. Real operator records remain private. Public demo access does not enable uploads, review writes, or new provider requests.

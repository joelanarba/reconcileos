from sqlalchemy import delete, select

from app.core.config import WORKSPACE_ID
from app.core.errors import AppError
from app.models.entities import AuditEvent, Discrepancy, Investigation, MatchAllocation, ReconciliationMatch, ReconciliationRun, ReviewDecision
from app.services.imports.service import lock_workspace
from app.services.reconciliation.engine import eligible_payments, payment_key, summarize


def get_case(session, case_id):
    case = session.scalar(select(Discrepancy).where(Discrepancy.id == case_id, Discrepancy.workspace_id == WORKSPACE_ID))
    if case is None:
        raise AppError("not_found", "Investigation case was not found.", 404)
    return case


def active_matches(session, run_id):
    active = select(MatchAllocation.match_id).where(MatchAllocation.run_id == run_id)
    return session.scalars(select(ReconciliationMatch).where(ReconciliationMatch.run_id == run_id, ReconciliationMatch.id.in_(active)).order_by(ReconciliationMatch.id)).all()


def fields(entity):
    return {column.name: getattr(entity, column.name) for column in entity.__table__.columns}


def current_summary(session, run):
    if run.status != "completed":
        return run.original_summary
    cases = session.scalars(select(Discrepancy).where(Discrepancy.run_id == run.id)).all()
    eligible = eligible_payments(run.snapshot)
    return summarize(run.snapshot, [fields(match) for match in active_matches(session, run.id)], [fields(case) for case in cases], eligible,
                     run.original_summary.get("duplicate_notification_count", 0))


def proposal(case, snapshot, request):
    candidates = case.evidence.get("candidates", {})
    keys = set(case.evidence["records"])
    if not request.order_id or not request.payment_id or request.order_id not in candidates.get("order_ids", []) or request.payment_id not in candidates.get("payment_ids", []) or "order:" + request.order_id not in keys or "payment:" + request.payment_id not in keys:
        raise AppError("unsupported_proposal", "Select an order and payment proposed by this case's recorded evidence.", 409)
    order = next((record for record in snapshot["orders"] if record["id"] == request.order_id), None)
    payment = next((record for record in snapshot["payments"] if record["id"] == request.payment_id), None)
    if order is None or payment is None:
        raise AppError("unsupported_proposal", "The proposed records are outside this snapshot.", 409)
    return order, payment


def review_case(session, case_id, request, actor):
    with session.begin():
        lock_workspace(session)
        case = get_case(session, case_id)
        run = session.get(ReconciliationRun, case.run_id)
        if run.status != "completed":
            raise AppError("incomplete_run", "Review requires a completed reconciliation run.", 409)
        if case.version != request.expected_version:
            raise AppError("stale_case", "This case changed. Refresh its evidence and history before trying again.", 409)
        before = {"status": case.status, "version": case.version}
        changes = {}
        match_id = None
        transitions = {"start_review": ({"open", "reopened"}, "in_review"), "resolve": ({"open", "reopened", "in_review"}, "resolved"), "reopen": ({"resolved"}, "reopened")}
        if request.action in transitions:
            allowed, target = transitions[request.action]
            if case.status not in allowed:
                raise AppError("invalid_transition", "This action is not allowed from the case's current status.", 409)
            case.status = target
        elif request.action == "note":
            session.add(Investigation(discrepancy_id=case.id, kind="note", actor=actor, explanation=request.reason, evidence={"records": case.evidence["records"]}))
        elif request.action in ("approve_match", "reject_match"):
            if case.status == "resolved":
                raise AppError("invalid_transition", "Reopen this case before recording another match decision.", 409)
            order, payment = proposal(case, run.snapshot, request)
            changes = {"order_id": order["id"], "payment_id": payment["id"]}
            if request.action == "approve_match":
                eligible_ids = {record["id"] for record in eligible_payments(run.snapshot)}
                if order["status"] == "cancelled" or payment["id"] not in eligible_ids or order["currency"] != payment["currency"] or int(order["expected_minor"]) != int(payment["amount_minor"]):
                    raise AppError("unsafe_match", "Approval requires an active order, one eligible payment, equal currency, and equal amount. Duplicate groups and partial payments cannot be waived.", 409)
                keys = ["order:" + order["id"], "payment:" + payment["id"], "payment_key:" + payment_key(payment)]
                allocated = session.scalar(select(MatchAllocation.id).where(MatchAllocation.run_id == run.id, MatchAllocation.kind == "order_payment", MatchAllocation.record_key.in_(keys)).limit(1))
                if allocated:
                    raise AppError("allocation_conflict", "The order or logical payment already has an accepted order relationship in this run.", 409)
                match = ReconciliationMatch(workspace_id=WORKSPACE_ID, run_id=run.id, kind="order_payment", order_id=order["id"], payment_id=payment["id"], origin="manual",
                                            evidence={"records": sorted(keys[:2]), "rule": "Human-approved association from recorded case candidates. Equal currency and amount, eligible payment, and allocation uniqueness revalidated.", "reason": request.reason, "case_id": case.id})
                session.add(match)
                session.flush()
                match_id = match.id
                for key in keys:
                    session.add(MatchAllocation(match_id=match.id, run_id=run.id, kind=match.kind, record_key=key))
            case.status = "in_review"
        elif request.action == "reverse_match":
            match = session.get(ReconciliationMatch, request.match_id) if request.match_id else None
            if not match or match.run_id != run.id or match.origin != "manual" or match.evidence.get("case_id") != case.id:
                raise AppError("unsupported_reversal", "Only a manual relationship created from this case can be reversed.", 409)
            active = session.scalar(select(MatchAllocation.id).where(MatchAllocation.match_id == match.id).limit(1))
            if not active:
                raise AppError("already_reversed", "This manual relationship has already been reversed.", 409)
            session.execute(delete(MatchAllocation).where(MatchAllocation.match_id == match.id))
            match_id = match.id
        if request.action not in ("approve_match", "reject_match") and (request.order_id or request.payment_id) or request.action != "reverse_match" and request.match_id:
            raise AppError("invalid_review", "Record identifiers do not apply to this review action.")
        case.version += 1
        after = {"status": case.status, "version": case.version, **changes, **({"match_id": match_id} if match_id else {})}
        if request.action != "note":
            session.add(ReviewDecision(discrepancy_id=case.id, match_id=match_id, action=request.action, actor=actor, reason=request.reason, previous_state=before, new_state=after))
        session.add(AuditEvent(workspace_id=WORKSPACE_ID, entity_type="discrepancy", entity_id=case.id, action=request.action, actor=actor, reason=request.reason, previous_state=before, new_state=after))
        session.flush()
        return case

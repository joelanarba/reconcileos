from fastapi import APIRouter, Depends, Request
from sqlalchemy import select

from app.api.routes import entity_data, evidence_records, get_run, get_session, public
from app.core.config import WORKSPACE_ID
from app.models.entities import AuditEvent, Investigation, ReviewDecision
from app.schemas.reviews import ReviewRequest
from app.schemas.ai import AIRequest
from app.services.investigations.ai import investigate
from app.services.investigations.review import active_matches, get_case, review_case
from app.core.security import authorize_operator


router = APIRouter(prefix="/api", dependencies=[Depends(authorize_operator)])


def case_detail(session, case_id):
    case = get_case(session, case_id)
    run = get_run(session, case.run_id)
    notes = session.scalars(select(Investigation).where(Investigation.discrepancy_id == case.id).order_by(Investigation.created_at, Investigation.id)).all()
    decisions = session.scalars(select(ReviewDecision).where(ReviewDecision.discrepancy_id == case.id).order_by(ReviewDecision.created_at, ReviewDecision.id)).all()
    events = session.scalars(select(AuditEvent).where(AuditEvent.workspace_id == WORKSPACE_ID, AuditEvent.entity_type == "discrepancy", AuditEvent.entity_id == case.id).order_by(AuditEvent.timestamp, AuditEvent.id)).all()
    return public(entity_data(case) | {"snapshot_hash": run.snapshot_hash, "source_records": evidence_records(run, case.evidence), "investigations": [entity_data(note) for note in notes],
                                      "decisions": [entity_data(decision) for decision in decisions], "audit_history": [entity_data(event) for event in events],
                                      "manual_matches": [entity_data(match) for match in active_matches(session, run.id) if match.origin == "manual" and match.evidence.get("case_id") == case.id]})


@router.get("/investigations/{case_id}")
def detail(case_id: str, session=Depends(get_session)):
    return case_detail(session, case_id)


@router.post("/investigations/{case_id}/review")
def review(case_id: str, payload: ReviewRequest, request: Request, session=Depends(get_session)):
    review_case(session, case_id, payload, request.state.actor)
    return case_detail(session, case_id)


@router.post("/investigations/{case_id}/ai")
async def ai_investigation(case_id: str, payload: AIRequest, request: Request, session=Depends(get_session)):
    await investigate(session, request.app.state.settings, case_id, payload.expected_version, request.state.actor)
    return case_detail(session, case_id)

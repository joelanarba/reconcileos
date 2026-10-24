from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.api.routes import get_run, get_session, public
from app.services.reports.export import export_report, report_data


router = APIRouter(prefix="/api")


@router.get("/reports/{run_id}")
def report(run_id: str, session=Depends(get_session)):
    return public(report_data(session, get_run(session, run_id)))


@router.get("/reports/{run_id}/export")
def export(run_id: str, kind: Literal["summary", "discrepancies"] = "summary", session=Depends(get_session)):
    run = get_run(session, run_id)
    return Response(export_report(session, run, kind), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="reconcileos-{run.id}-{kind}.csv"'})

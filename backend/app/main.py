from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.routes import router
from app.api.investigations import router as investigations_router
from app.api.reports import router as reports_router
from app.core.config import Settings
from app.core.errors import AppError
from app.db.session import database_engine, session_factory


def create_app(settings: Settings | None = None) -> FastAPI:
    configuration = settings or Settings()
    engine = database_engine(configuration.database_url)

    @asynccontextmanager
    async def lifespan(application):
        try:
            with engine.connect() as connection:
                version = connection.scalar(text("SELECT version_num FROM alembic_version"))
                if version != "0001_initial":
                    raise RuntimeError("Apply the current Alembic migrations before starting the application.")
            yield
        finally:
            engine.dispose()

    application = FastAPI(title="ReconcileOS", version="0.1.0", lifespan=lifespan,
                          docs_url="/docs" if configuration.app_mode == "local" else None,
                          redoc_url="/redoc" if configuration.app_mode == "local" else None,
                          openapi_url="/openapi.json" if configuration.app_mode == "local" else None)
    application.state.settings = configuration
    application.state.engine = engine
    application.state.sessions = session_factory(engine)
    application.add_middleware(TrustedHostMiddleware, allowed_hosts=configuration.allowed_hosts)
    application.add_middleware(CORSMiddleware, allow_origins=configuration.cors_origins, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type", "X-Filename"], expose_headers=["Content-Disposition"])

    @application.exception_handler(AppError)
    async def app_error(request: Request, error: AppError):
        return JSONResponse({"detail": {"code": error.code, "message": error.message}}, status_code=error.status)

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        return JSONResponse({"detail": {"code": "invalid_request", "message": "Check the request fields and try again.", "fields": [
            {"field": ".".join(str(part) for part in item["loc"]), "message": item["msg"]} for item in error.errors()[:50]]}}, status_code=422)

    @application.exception_handler(IntegrityError)
    async def integrity_error(request: Request, error: IntegrityError):
        return JSONResponse({"detail": {"code": "data_conflict", "message": "The operation conflicts with existing records. Refresh and try again."}}, status_code=409)

    @application.exception_handler(OperationalError)
    async def database_error(request: Request, error: OperationalError):
        return JSONResponse({"detail": {"code": "database_unavailable", "message": "The database is busy or unavailable. Try again."}}, status_code=503)

    @application.exception_handler(Exception)
    async def unexpected_error(request: Request, error: Exception):
        return JSONResponse({"detail": {"code": "unexpected_error", "message": "The operation could not be completed. Existing records are preserved."}}, status_code=500)

    application.include_router(router)
    application.include_router(investigations_router)
    application.include_router(reports_router)
    return application


app = create_app()
if app.state.settings.app_mode == "local" and app.state.settings.public_demo_database_url:
    from app.public_demo import PublicDemo
    demo_settings = app.state.settings.model_copy(update={"database_url": app.state.settings.public_demo_database_url})
    app = PublicDemo(app, create_app(demo_settings))

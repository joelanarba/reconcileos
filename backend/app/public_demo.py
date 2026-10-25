"""Read-only routing to a separate synthetic database, never the operator store."""
from starlette.responses import JSONResponse


DEMO_DATABASE = "reconcileos_public_demo"


class PublicDemo:
    def __init__(self, primary, demo):
        if primary.state.settings.database_url == demo.state.settings.database_url:
            raise ValueError("The public demo requires a separate database.")
        self.primary = primary
        self.demo = demo
        demo.state.public_demo = True

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] == "http" and (path == "/api/demo" or path.startswith("/api/demo/")):
            if scope["method"] not in ("GET", "HEAD", "OPTIONS"):
                await JSONResponse({"detail": {"code": "read_only_demo", "message": "The synthetic demo is read-only. Sign in to use your own workspace."}}, status_code=403)(scope, receive, send)
                return
            # A fresh scope prevents route and app state leaking between stores.
            rewritten = dict(scope, path="/api" + path[len("/api/demo"):])
            rewritten["raw_path"] = rewritten["path"].encode("utf-8")
            await self.demo(rewritten, receive, send)
            return
        await self.primary(scope, receive, send)

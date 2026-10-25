"""Explicit AWS deployment phases. Provisioning requires a chosen account and budget."""
import argparse
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import subprocess
import time

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import dotenv_values
import httpx


ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "deploy" / ".local"


def save_local(path, value, private=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    if private:
        path.touch(exist_ok=True)
        if os.name == "nt":
            principal = subprocess.run(["whoami"], check=True, capture_output=True, text=True).stdout.strip()
            subprocess.run(["icacls", str(path), "/inheritance:r", "/grant:r", principal + ":(R,W)"], check=True, capture_output=True)
        else:
            path.chmod(0o600)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


class Deployment:
    def __init__(self, args):
        self.args = args
        self.session = boto3.Session(profile_name=args.profile, region_name=args.region)
        self.configuration = Config(connect_timeout=5, read_timeout=30, retries={"max_attempts": 2})
        self.cf = self.client("cloudformation")
        self.guard()

    def client(self, name, slow=False):
        return self.session.client(name, config=Config(connect_timeout=5, read_timeout=330, retries={"max_attempts": 0}) if slow else self.configuration)

    def guard(self):
        identity = self.client("sts").get_caller_identity()
        if identity["Account"] != self.args.account_id:
            raise RuntimeError("AWS account differs from the explicitly selected deployment account.")
        return identity

    def stack(self, name):
        try:
            stack = self.cf.describe_stacks(StackName=name)["Stacks"][0]
        except ClientError as error:
            if error.response["Error"]["Code"] == "ValidationError" and "does not exist" in error.response["Error"]["Message"]:
                return None
            raise
        if {item["Key"]: item["Value"] for item in stack.get("Tags", [])}.get("Project") != "reconcileos":
            raise RuntimeError("Refusing to use an existing stack without the ReconcileOS ownership tag.")
        return stack

    def wait_stack(self, name):
        previous = None
        for _ in range(160):
            stack = self.stack(name)
            status = stack["StackStatus"]
            if status != previous:
                print(name + ": " + status, flush=True)
                previous = status
            if status in ("CREATE_COMPLETE", "UPDATE_COMPLETE"):
                return stack
            if status.endswith("FAILED") or status in ("ROLLBACK_COMPLETE", "DELETE_COMPLETE"):
                for event in self.cf.describe_stack_events(StackName=name)["StackEvents"][:20]:
                    if event["ResourceStatus"].endswith("FAILED"):
                        print(event["LogicalResourceId"] + ": " + event.get("ResourceStatusReason", "Operation failed.")[:500])
                raise RuntimeError("CloudFormation did not create the stack successfully. Review its events; no automatic deletion is performed.")
            time.sleep(15)
        raise RuntimeError("Stack creation is still pending. Inspect its status before retrying.")

    def create_stack(self, name, template, parameters=()):
        current = self.stack(name)
        if current:
            if current["StackStatus"] not in ("CREATE_COMPLETE", "UPDATE_COMPLETE"):
                raise RuntimeError("The existing stack is not complete. Inspect it before continuing.")
            return current
        self.guard()
        self.cf.create_stack(StackName=name, TemplateBody=template.read_text(encoding="utf-8"), Parameters=list(parameters),
            Capabilities=["CAPABILITY_IAM"], Tags=[{"Key": "Project", "Value": "reconcileos"}, {"Key": "Owner", "Value": "joelanarba"}],
            OnFailure="DO_NOTHING")
        return self.wait_stack(name)

    def outputs(self):
        stack = self.stack(self.args.stack)
        if not stack or stack["StackStatus"] not in ("CREATE_COMPLETE", "UPDATE_COMPLETE"):
            raise RuntimeError("The selected application stack is not ready.")
        return {item["OutputKey"]: item["OutputValue"] for item in stack["Outputs"]}

    def provision(self):
        if self.args.monthly_budget is None or not self.args.monthly_budget.is_finite() or self.args.monthly_budget < Decimal("20"):
            raise RuntimeError("A reviewed monthly budget of at least USD 20 is required for this paid RDS proposal. This is not a hard billing cap.")
        metadata = json.loads((LOCAL / "backend-artifact.json").read_text(encoding="utf-8"))
        archive = Path(metadata["archive"]).resolve()
        if not archive.is_relative_to(LOCAL.resolve()) or hashlib.sha256(archive.read_bytes()).hexdigest() != metadata["sha256"]:
            raise RuntimeError("The reviewed deployment artifact does not match its manifest.")
        target_file = LOCAL / "deployment-target.json"
        target = {"profile": self.args.profile, "account_id": self.args.account_id, "region": self.args.region, "stack": self.args.stack}
        if target_file.exists() and any(json.loads(target_file.read_text(encoding="utf-8")).get(key) != value for key, value in target.items()):
            raise RuntimeError("The saved deployment target differs; never switch accounts implicitly.")
        save_local(target_file, target | {"authorized_monthly_budget_usd": str(self.args.monthly_budget), "artifact_sha256": metadata["sha256"]})
        bootstrap = self.create_stack(self.args.stack + "-artifacts", ROOT / "deploy" / "bootstrap.yaml")
        bucket = next(item["OutputValue"] for item in bootstrap["Outputs"] if item["OutputKey"] == "ArtifactBucket")
        key = "backend/" + metadata["sha256"] + ".zip"
        current = self.stack(self.args.stack)
        if current and next((item["ParameterValue"] for item in current["Parameters"] if item["ParameterKey"] == "ArtifactKey"), None) != key:
            raise RuntimeError("The stack uses another backend artifact. Use the explicit update-backend phase; provisioning does not silently update resources.")
        self.guard()
        self.client("s3").upload_file(str(archive), bucket, key)
        self.create_stack(self.args.stack, ROOT / "deploy" / "aws.yaml", [
            {"ParameterKey": "ArtifactBucket", "ParameterValue": bucket}, {"ParameterKey": "ArtifactKey", "ParameterValue": key},
        ])
        save_local(LOCAL / "outputs.json", self.outputs())
        print("Infrastructure created. Database initialization and hosted verification remain separate phases.")

    def update_backend(self):
        current = self.stack(self.args.stack)
        if not current or current["StackStatus"] not in ("CREATE_COMPLETE", "UPDATE_COMPLETE"):
            raise RuntimeError("A ready owned stack is required before updating backend code.")
        metadata = json.loads((LOCAL / "backend-artifact.json").read_text(encoding="utf-8"))
        archive = Path(metadata["archive"]).resolve()
        if not archive.is_relative_to(LOCAL.resolve()) or hashlib.sha256(archive.read_bytes()).hexdigest() != metadata["sha256"]:
            raise RuntimeError("The deployment artifact does not match its manifest.")
        parameters = {item["ParameterKey"]: item["ParameterValue"] for item in current["Parameters"]}
        key = "backend/" + metadata["sha256"] + ".zip"
        if parameters["ArtifactKey"] == key:
            print("The backend artifact is already deployed.")
            return
        self.guard()
        self.client("s3").upload_file(str(archive), parameters["ArtifactBucket"], key)
        self.cf.update_stack(StackName=self.args.stack, UsePreviousTemplate=True, Capabilities=["CAPABILITY_IAM"], Tags=current.get("Tags", []),
            Parameters=[{"ParameterKey": name, "ParameterValue": key} if name == "ArtifactKey" else {"ParameterKey": name, "UsePreviousValue": True} for name in parameters])
        self.wait_stack(self.args.stack)
        print("Backend code updated using the existing infrastructure template.")

    def maintenance(self, action):
        self.guard()
        payload = {"action": action}
        if action == "verify_postgres":
            payload["confirm_dedicated_test_database"] = True
        result = self.client("lambda", slow=True).invoke(FunctionName=self.outputs()["MaintenanceFunction"], Payload=json.dumps(payload).encode())
        body = json.loads(result["Payload"].read())
        if result.get("FunctionError"):
            raise RuntimeError("Private maintenance failed. Inspect the maintenance log group; no financial data or secret is printed here.")
        save_local(LOCAL / (action + "-result.json"), body)
        print(json.dumps(body))
        return body

    def configure_ai(self):
        settings = dotenv_values(ROOT / "backend" / ".env")
        if settings.get("LLM_BASE_URL", "").rstrip("/") != "https://api.openai.com/v1" or not settings.get("LLM_API_KEY") or not settings.get("LLM_MODEL"):
            raise RuntimeError("The private local OpenAI configuration is incomplete. Its values are never printed.")
        self.guard()
        self.client("secretsmanager").put_secret_value(SecretId=self.outputs()["AISecretArn"], SecretString=json.dumps({"api_key": settings["LLM_API_KEY"], "model": settings["LLM_MODEL"]}))
        client = self.client("lambda")
        name = self.outputs()["AppFunction"]
        configuration = client.get_function_configuration(FunctionName=name)
        variables = configuration["Environment"]["Variables"] | {"SECRET_REVISION": str(time.time_ns())}
        client.update_function_configuration(FunctionName=name, Environment={"Variables": variables}, RevisionId=configuration["RevisionId"])
        client.get_waiter("function_updated_v2").wait(FunctionName=name)
        print("OpenAI credentials stored server-side in Secrets Manager and the runtime refreshed. No provider request was made.")

    def create_operator(self):
        outputs = self.outputs()
        credentials_path = LOCAL / "operator-access.json"
        if credentials_path.exists():
            saved = json.loads(credentials_path.read_text(encoding="utf-8"))
            if saved.get("user_pool_id") == outputs["UserPoolId"]:
                print("An existing local operator credential file is preserved.")
                return
            raise RuntimeError("The existing operator credential file belongs to another pool.")
        client = self.client("cognito-idp")
        username = "joelanarba"
        try:
            client.admin_get_user(UserPoolId=outputs["UserPoolId"], Username=username)
        except client.exceptions.UserNotFoundException:
            pass
        else:
            raise RuntimeError("The operator already exists; its password is never reset automatically.")
        self.guard()
        password = secrets.token_urlsafe(36) + "aA1!"
        client.admin_create_user(UserPoolId=outputs["UserPoolId"], Username=username, TemporaryPassword=password, MessageAction="SUPPRESS")
        client.admin_set_user_password(UserPoolId=outputs["UserPoolId"], Username=username, Password=password, Permanent=True)
        client.admin_add_user_to_group(UserPoolId=outputs["UserPoolId"], Username=username, GroupName="reconcileos-operators")
        save_local(credentials_path, {"username": username, "password": password, "app_url": outputs["AppUrl"], "user_pool_id": outputs["UserPoolId"]}, private=True)
        print("Operator created without sending email. Credentials saved only in ignored deploy/.local/operator-access.json.")

    def publish(self):
        outputs = self.outputs()
        destination = LOCAL / ("frontend-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f"))
        environment = dict(os.environ, VITE_AUTH_MODE="cognito", VITE_API_BASE_URL="/api", VITE_COGNITO_DOMAIN=outputs["CognitoDomain"], VITE_COGNITO_CLIENT_ID=outputs["ClientId"])
        subprocess.run(["npm.cmd" if os.name == "nt" else "npm", "run", "build", "--", "--outDir", str(destination)], cwd=ROOT / "frontend", env=environment, check=True)
        self.guard()
        client = self.client("s3")
        for path in destination.rglob("*"):
            if path.is_file():
                key = path.relative_to(destination).as_posix()
                client.upload_file(str(path), outputs["FrontendBucket"], key, ExtraArgs={
                    "ContentType": mimetypes.guess_type(key)[0] or "application/octet-stream",
                    "CacheControl": "public,max-age=31536000,immutable" if key.startswith("assets/") else "no-cache",
                })
        self.client("cloudfront").create_invalidation(DistributionId=outputs["DistributionId"], InvalidationBatch={"CallerReference": str(time.time_ns()), "Paths": {"Quantity": 1, "Items": ["/*"]}})
        print("Frontend published: " + outputs["AppUrl"])

    def access_token(self):
        outputs = self.outputs()
        credentials = json.loads((LOCAL / "operator-access.json").read_text(encoding="utf-8"))
        if credentials["user_pool_id"] != outputs["UserPoolId"]:
            raise RuntimeError("The local operator belongs to a different pool.")
        result = self.client("cognito-idp").admin_initiate_auth(UserPoolId=outputs["UserPoolId"], ClientId=outputs["ClientId"], AuthFlow="ADMIN_USER_PASSWORD_AUTH", AuthParameters={"USERNAME": credentials["username"], "PASSWORD": credentials["password"]})
        if "AuthenticationResult" not in result:
            raise RuntimeError("Sign-in requires an interactive challenge. Complete it through the hosted login.")
        return result["AuthenticationResult"]["AccessToken"]

    def smoke(self):
        outputs = self.outputs()
        base = outputs["AppUrl"]
        with httpx.Client(base_url=base, timeout=30, follow_redirects=False) as client:
            assert client.get("/").status_code == 200, "Frontend unavailable"
            assert client.get("/api/workspace").status_code == 401, "Unauthenticated access was not denied"
            client.headers["Authorization"] = "Bearer " + self.access_token()
            response = client.get("/api/workspace")
            assert response.status_code == 200, "Authenticated workspace request failed"
            workspace = response.json()
            assert workspace["mode"] == "aws" and workspace["operator"].startswith("cognito:"), "Hosted actor not established"
            assert client.get("/api/templates/orders").status_code == 200
            assert client.get("/api/dashboard").status_code == 200
            # Frontend routes intentionally return index.html; inspect the API origin.
            assert client.get(outputs["ApiUrl"] + "/openapi.json").status_code == 404
        result = {"https_frontend": True, "unauthenticated_denied": True, "authenticated_workspace": True, "authenticated_template": True, "dashboard": True, "mode": "aws"}
        save_local(LOCAL / "hosted-smoke.json", result)
        print(json.dumps(result))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("status", "provision", "update-backend", "initialize", "verify-postgres", "connectivity", "configure-ai", "create-operator", "publish", "smoke"))
    parser.add_argument("--profile", required=True)
    parser.add_argument("--account-id", required=True)
    parser.add_argument("--region", required=True)
    parser.add_argument("--stack", default="reconcileos-demo")
    parser.add_argument("--monthly-budget", type=Decimal)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9]{12}", args.account_id) or not re.fullmatch(r"[a-z][a-z0-9-]{1,35}", args.stack) or not re.fullmatch(r"[a-z]{2}-[a-z]+-[0-9]", args.region):
        parser.error("Account, stack, or region format is invalid.")
    deployment = Deployment(args)
    if args.action == "status":
        stack = deployment.stack(args.stack)
        print(json.dumps({"account": args.account_id, "profile": args.profile, "region": args.region, "stack_status": stack["StackStatus"] if stack else "not_created"}))
    elif args.action in ("initialize", "verify-postgres", "connectivity"):
        deployment.maintenance(args.action.replace("-", "_"))
    else:
        getattr(deployment, args.action.replace("-", "_"))()


if __name__ == "__main__":
    try:
        main()
    except ClientError as error:
        raise SystemExit("AWS operation failed: " + error.response["Error"]["Code"] + ". Review the selected account and service permissions; no secrets are printed.") from None

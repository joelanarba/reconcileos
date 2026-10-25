"""Build a Linux Lambda ZIP natively on Windows, without containers."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "deploy" / ".local"


def build():
    LOCAL.mkdir(parents=True, exist_ok=True)
    # Each build gets a new directory; never recursively remove a computed path.
    from datetime import datetime, timezone
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    package = LOCAL / ("package-" + stamp)
    package.mkdir()
    subprocess.run([sys.executable, "-m", "pip", "install", "--no-compile", "--disable-pip-version-check", "--only-binary=:all:",
        "--platform", "manylinux_2_34_x86_64", "--platform", "manylinux_2_28_x86_64", "--platform", "manylinux_2_24_x86_64",
        "--platform", "manylinux2014_x86_64", "--implementation", "cp", "--python-version", "3.12", "--abi", "cp312",
        "--target", str(package), "-r", str(ROOT / "backend" / "requirements-aws.txt")], check=True)
    shutil.copytree(ROOT / "backend" / "app", package / "app", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    # Keep project migrations separate from the installed alembic library package.
    shutil.copytree(ROOT / "backend" / "alembic", package / "migrations", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    shutil.copytree(ROOT / "sample-data", package / "sample-data")
    for name in ("aws_runtime.py", "aws_maintenance.py", "verify_postgres.py"):
        shutil.copy2(ROOT / "backend" / name, package / name)
    configuration = (ROOT / "backend" / "alembic.ini").read_text(encoding="utf-8")
    (package / "alembic.ini").write_text(configuration.replace("%(here)s/alembic", "%(here)s/migrations"), encoding="utf-8")
    with urllib.request.urlopen("https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem", timeout=20) as response:
        certificates = response.read(1048577)
    if len(certificates) > 1048576 or b"-----BEGIN CERTIFICATE-----" not in certificates or b"PRIVATE KEY" in certificates:
        raise RuntimeError("The RDS public CA bundle is invalid.")
    (package / "certs").mkdir()
    (package / "certs" / "rds.pem").write_bytes(certificates)
    archive = LOCAL / ("backend-" + stamp + ".zip")
    with ZipFile(archive, "w", ZIP_DEFLATED) as zipped:
        for path in sorted(package.rglob("*")):
            if not path.is_file() or "__pycache__" in path.parts or path.suffix in (".pyc", ".pyo"):
                continue
            relative = path.relative_to(package)
            if relative.parts[0] in ("bin", "Scripts") or path.suffix.lower() == ".exe":
                continue
            if path.name == ".env" or path.suffix.lower() in (".db", ".sqlite", ".sqlite3", ".pyd", ".dll") or "learner-profile" in path.name:
                raise RuntimeError("A local-only file was found in the deployment package: " + str(relative))
            zipped.write(path, relative.as_posix())
        unpacked = sum(item.file_size for item in zipped.infolist())
    if unpacked > 240 * 1024 * 1024:
        raise RuntimeError("The Lambda package exceeds the reviewable uncompressed limit.")
    metadata = {"archive": str(archive), "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "uncompressed_bytes": unpacked, "compressed_bytes": archive.stat().st_size,
        "runtime": "python3.12", "platform": "Amazon Linux 2023 x86_64, glibc <= 2.34", "rds_ca_sha256": hashlib.sha256(certificates).hexdigest()}
    (LOCAL / "backend-artifact.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    build()

"""Add a random internal proxy secret to .env without replacing local settings."""

import secrets
from pathlib import Path

path = Path(__file__).resolve().parents[1] / ".env"
content = path.read_text() if path.exists() else ""
lines = content.splitlines()
existing = [line for line in lines if line.startswith("LUMEN_PROXY_SECRET=")]
if existing and existing[0].partition("=")[2].strip():
    print("Internal proxy secret already configured; existing settings preserved.")
else:
    lines = [line for line in lines if not line.startswith("LUMEN_PROXY_SECRET=")]
    lines.append("LUMEN_PROXY_SECRET=" + secrets.token_hex(32))
    path.write_text("\n".join(lines) + "\n")
    path.chmod(0o600)
    print("Generated an internal proxy secret in .env; existing settings preserved.")

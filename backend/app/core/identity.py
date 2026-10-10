"""Authenticate anonymous proxy sessions without trusting forwarded IP headers."""

import hashlib
import hmac
import re
import time


def proxy_identity(value: str | None, secret: str | None) -> str | None:
    if not secret or not value or len(value) > 200:
        return None
    parts = value.split(".")
    if len(parts) != 3:
        return None
    identity, timestamp, signature = parts
    if (
        not re.fullmatch(r"[a-f0-9]{32}", identity)
        or not re.fullmatch(r"[0-9]{1,12}", timestamp)
        or not re.fullmatch(r"[a-f0-9]{64}", signature)
    ):
        return None
    if abs(time.time() - int(timestamp)) > 60:
        return None
    expected = hmac.new(
        secret.encode(), f"request:{identity}:{timestamp}".encode(), hashlib.sha256
    ).hexdigest()
    return identity if hmac.compare_digest(expected, signature) else None

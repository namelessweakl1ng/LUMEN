import time

import pytest

from app.core.identity import proxy_identity


@pytest.mark.parametrize("timestamp,signature", [("²", "x"), ("1000", "é"), ("9" * 150, "a" * 64)])
def test_malformed_identity_is_rejected_without_error(timestamp, signature):
    assert proxy_identity(f"{'a' * 32}.{timestamp}.{signature}", "s" * 32) is None


def test_non_ascii_signature_is_rejected_at_current_timestamp():
    assert proxy_identity(f"{'a' * 32}.{int(time.time())}.é", "s" * 32) is None

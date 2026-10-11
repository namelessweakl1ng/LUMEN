"""Conservative URL identity and domain filters."""

import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_UNRESERVED = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")


def _decode_unreserved(path: str) -> str:
    def decode(match: re.Match[str]) -> str:
        character = chr(int(match.group()[1:], 16))
        return character if character in _UNRESERVED else match.group()

    return re.sub(r"%[0-9A-Fa-f]{2}", decode, path)


def canonical_url(value: str) -> str | None:
    try:
        parts = urlsplit(value)
        if (
            parts.scheme.lower() not in ("http", "https")
            or not parts.hostname
            or parts.username
            or parts.password
        ):
            return None
        host = parts.hostname.rstrip(".").encode("idna").decode().lower()
        if not host:
            return None
        port = parts.port
        netloc = f"[{host}]" if ":" in host else host
        if port and not (
            parts.scheme.lower() == "https"
            and port == 443
            or parts.scheme.lower() == "http"
            and port == 80
        ):
            netloc += f":{port}"
        params = sorted(
            [
                (k, v)
                for k, v in parse_qsl(parts.query, keep_blank_values=True)
                if not k.lower().startswith("utm_")
                and k.lower() not in {"fbclid", "gclid", "ref_src"}
            ],
            key=lambda pair: pair[0],
        )
        return urlunsplit(
            (parts.scheme.lower(), netloc, _decode_unreserved(parts.path or "/"), urlencode(params), "")
        )
    except (ValueError, UnicodeError):
        return None


def matches(domain: str, wanted: list[str]) -> bool:
    return any(domain == item or domain.endswith("." + item) for item in wanted)

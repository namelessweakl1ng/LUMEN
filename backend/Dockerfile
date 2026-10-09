FROM ghcr.io/astral-sh/uv:0.9.5 AS uv
FROM python:3.12.12-slim-bookworm AS builder
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN --mount=type=secret,id=build_ca,required=false \
    --mount=type=secret,id=build_proxy,required=false \
    if [ -f /run/secrets/build_ca ]; then export SSL_CERT_FILE=/run/secrets/build_ca; fi; \
    if [ -f /run/secrets/build_proxy ]; then export HTTPS_PROXY="$(cat /run/secrets/build_proxy)"; fi; \
    uv sync --frozen --no-dev --no-install-project
COPY app ./app

FROM python:3.12.12-slim-bookworm AS runtime
RUN groupadd --gid 10001 lumen && useradd --uid 10001 --gid lumen --no-create-home lumen
WORKDIR /app
COPY --from=builder --chown=lumen:lumen /app /app
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER lumen
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log", "--no-proxy-headers"]

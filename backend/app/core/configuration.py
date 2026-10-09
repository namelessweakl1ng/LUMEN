"""Validated non-secret process configuration; invalid settings stop startup."""

import os

from pydantic import BaseModel, ConfigDict, Field


class Configuration(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")
    cache_ttl_seconds: float = Field(default=120, ge=0, le=3600)
    cache_max_entries: int = Field(default=128, ge=0, le=4096)
    engine_timeout_seconds: float = Field(default=8, ge=0.1, le=60)
    query_timeout_seconds: float = Field(default=9, ge=0.1, le=120)
    max_outbound_concurrency: int = Field(default=12, ge=1, le=128)
    rate_limit_per_minute: int = Field(default=120, ge=1, le=10000)

    @classmethod
    def from_environment(cls) -> "Configuration":
        values = {
            name: os.environ["LUMEN_" + name.upper()]
            for name in cls.model_fields
            if "LUMEN_" + name.upper() in os.environ
        }
        return cls.model_validate(values)

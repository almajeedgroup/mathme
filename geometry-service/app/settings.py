"""Runtime settings, read from environment variables."""

import os
from dataclasses import dataclass, field


def _origins() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:4173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    allowed_origins: list[str] = field(default_factory=_origins)
    max_upload_mb: float = float(os.environ.get("MAX_UPLOAD_MB", "50"))
    max_triangles: int = int(os.environ.get("MAX_TRIANGLES", "2000000"))
    max_union_parts: int = int(os.environ.get("MAX_UNION_PARTS", "5000"))
    timeout_s: float = float(os.environ.get("REQUEST_TIMEOUT_S", "60"))
    # When set, every route except /health needs the X-Geometry-Secret header with this value, so only the
    # MathMe account service (which checks plans and quotas first) can use the service.
    geometry_secret: str = os.environ.get("GEOMETRY_SECRET", "")

    @property
    def max_upload_bytes(self) -> int:
        return int(self.max_upload_mb * 1024 * 1024)


settings = Settings()

"""JSON response that tolerates NaN/inf values from pandas and numpy"""
import math
from typing import Any

from fastapi.responses import JSONResponse


def _replace_non_finite(value: Any) -> Any:
    """Recursively replace NaN/inf floats with None."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _replace_non_finite(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_replace_non_finite(v) for v in value]
    return value


class SafeJSONResponse(JSONResponse):
    """
    JSONResponse that serializes NaN/inf as null.

    Pandas statistics routinely yield NaN (e.g. the std of a single lap), and
    the standard JSONResponse refuses to encode it, failing the whole request.
    """

    def render(self, content: Any) -> bytes:
        return super().render(_replace_non_finite(content))

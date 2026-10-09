"""Outgoing HTTP (Google, Cashfree, Resend, the geometry service).

httpx locally; the Workers `fetch` inside Cloudflare. Tests swap in a fake.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class HttpResponse:
    status: int
    body: bytes
    headers: dict[str, str]

    def json(self) -> Any:
        return json.loads(self.body or b"null")


class Http(Protocol):
    async def request(
        self, method: str, url: str, *, headers: dict[str, str] | None = None, body: bytes | None = None
    ) -> HttpResponse: ...


async def post_json(http: Http, url: str, data: Any, headers: dict[str, str] | None = None) -> HttpResponse:
    h = {"Content-Type": "application/json", **(headers or {})}
    return await http.request("POST", url, headers=h, body=json.dumps(data).encode())


async def post_form(http: Http, url: str, data: dict[str, str]) -> HttpResponse:
    from urllib.parse import urlencode

    h = {"Content-Type": "application/x-www-form-urlencoded"}
    return await http.request("POST", url, headers=h, body=urlencode(data).encode())


class HttpxHttp:
    def __init__(self, timeout: float = 60) -> None:
        self.timeout = timeout

    async def request(self, method, url, *, headers=None, body=None) -> HttpResponse:
        import httpx

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.request(method, url, headers=headers, content=body)
            return HttpResponse(r.status_code, r.content, dict(r.headers))


class WorkersHttp:  # pragma: no cover - needs the Workers runtime
    async def request(self, method, url, *, headers=None, body=None) -> HttpResponse:
        from js import Object, Uint8Array, fetch  # type: ignore
        from pyodide.ffi import to_js  # type: ignore

        init: dict[str, Any] = {"method": method, "headers": headers or {}}
        if body is not None:
            arr = Uint8Array.new(len(body))
            arr.assign(body)
            init["body"] = arr
        resp = await fetch(url, to_js(init, dict_converter=Object.fromEntries))
        buf = await resp.arrayBuffer()
        hdrs = {k: v for k, v in resp.headers.entries()}
        return HttpResponse(int(resp.status), bytes(buf.to_py()), hdrs)

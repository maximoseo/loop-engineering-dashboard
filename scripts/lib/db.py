"""Supabase write/read client.

Preferred path: PostgREST with SUPABASE_SERVICE_KEY (if provided in scripts/.env).
Fallback path: Supabase Management API SQL endpoint with SUPABASE_ACCESS_TOKEN.
Reads for scripts always go through the same channel as writes.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from .common import SUPABASE_PROJECT_REF, SUPABASE_URL, log

_UA = "loop-engineering/1.0"


class DbError(RuntimeError):
    pass


def _http(url: str, method: str, headers: dict[str, str], body: bytes | None) -> tuple[int, str]:
    req = urllib.request.Request(url, data=body, headers={"User-Agent": _UA, **headers}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "replace")


def _service_key() -> str | None:
    return os.environ.get("SUPABASE_SERVICE_KEY") or None


def _access_token() -> str | None:
    return os.environ.get("SUPABASE_ACCESS_TOKEN") or None


def sql_literal(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (dict, list)):
        return sql_literal(json.dumps(value, ensure_ascii=False)) + "::jsonb"
    text = str(value).replace("'", "''")
    return f"'{text}'"


def run_sql(query: str) -> list[dict[str, Any]]:
    """Executes SQL via the Management API. Requires SUPABASE_ACCESS_TOKEN."""
    token = _access_token()
    if not token:
        raise DbError("SUPABASE_ACCESS_TOKEN not set (scripts/.env)")
    status, body = _http(
        f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_REF}/database/query",
        "POST",
        {"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json.dumps({"query": query}).encode(),
    )
    if status not in (200, 201):
        raise DbError(f"management sql HTTP {status}: {body[:300]}")
    try:
        parsed = json.loads(body)
    except ValueError:
        return []
    return parsed if isinstance(parsed, list) else []


def _rest(path: str, method: str, payload: Any | None, prefer: str | None = None) -> list[dict[str, Any]]:
    key = _service_key()
    if not key:
        raise DbError("no service key")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    body = json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None
    status, text = _http(f"{SUPABASE_URL}/rest/v1/{path}", method, headers, body)
    if status >= 300:
        raise DbError(f"postgrest {method} {path} HTTP {status}: {text[:300]}")
    try:
        parsed = json.loads(text) if text else []
    except ValueError:
        parsed = []
    return parsed if isinstance(parsed, list) else [parsed]


def insert(table: str, row: dict[str, Any], on_conflict: str | None = None) -> None:
    if _service_key():
        prefer = "return=minimal"
        path = table
        if on_conflict:
            prefer += ",resolution=ignore-duplicates"
            path += f"?on_conflict={on_conflict}"
        _rest(path, "POST", row, prefer)
        return
    cols = ", ".join(row.keys())
    vals = ", ".join(sql_literal(v) for v in row.values())
    conflict = f" on conflict ({on_conflict}) do nothing" if on_conflict else ""
    run_sql(f"insert into public.{table} ({cols}) values ({vals}){conflict};")


def update(table: str, where: str, changes: dict[str, Any]) -> None:
    if _service_key():
        _rest(f"{table}?{where}", "PATCH", changes, "return=minimal")
        return
    sets = ", ".join(f"{k} = {sql_literal(v)}" for k, v in changes.items())
    clause = _where_to_sql(where)
    run_sql(f"update public.{table} set {sets} where {clause};")


def select(table: str, query: str = "") -> list[dict[str, Any]]:
    if _service_key():
        return _rest(f"{table}?{query}" if query else table, "GET", None)
    clause = _query_to_sql(query)
    return run_sql(f"select * from public.{table}{clause};")


def _where_to_sql(where: str) -> str:
    """Converts a single PostgREST-style filter list (a=eq.b&c=eq.d) to SQL."""
    parts = []
    for chunk in where.split("&"):
        if not chunk:
            continue
        col, _, rest = chunk.partition("=")
        op, _, val = rest.partition(".")
        ops = {"eq": "=", "gt": ">", "gte": ">=", "lt": "<", "lte": "<=", "neq": "<>"}
        if op == "is" and val == "null":
            parts.append(f"{col} is null")
        elif op in ops:
            parts.append(f"{col} {ops[op]} {sql_literal(val)}")
        else:
            raise DbError(f"unsupported filter: {chunk}")
    return " and ".join(parts) if parts else "true"


def _query_to_sql(query: str) -> str:
    filters: list[str] = []
    order = ""
    limit = ""
    for chunk in query.split("&"):
        if not chunk or chunk.startswith("select="):
            continue
        if chunk.startswith("order="):
            spec = chunk[len("order="):]
            col, _, direction = spec.partition(".")
            order = f" order by {col} {'desc' if direction == 'desc' else 'asc'}"
        elif chunk.startswith("limit="):
            limit = f" limit {int(chunk[len('limit='):])}"
        else:
            filters.append(chunk)
    where = _where_to_sql("&".join(filters)) if filters else "true"
    return f" where {where}{order}{limit}"


def set_loop_state(phase: str, **extra: Any) -> None:
    changes: dict[str, Any] = {"phase": phase, "updated_at": "now()"} if not _service_key() else {"phase": phase}
    for key in ("current_task_id", "active_proposal_id", "last_score", "details"):
        if key in extra:
            changes[key] = extra[key]
    try:
        if _service_key():
            update("loop_state", "id=eq.main", changes)
        else:
            sets = ", ".join(
                f"{k} = {sql_literal(v)}" if k != "updated_at" else "updated_at = now()"
                for k, v in changes.items()
            )
            run_sql(f"update public.loop_state set {sets} where id = 'main';")
    except DbError as exc:
        log(f"loop_state update failed: {exc}")

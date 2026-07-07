"""Read-only access to the Hermes agent state database (sessions + messages)."""
from __future__ import annotations

import json
import sqlite3
import time
from typing import Any

from .common import HERMES_STATE_DB

COMPLETED_IDLE_S = 30 * 60  # a session with no messages for 30 min counts as completed
MAX_TRANSCRIPT_CHARS = 12000


def _connect() -> sqlite3.Connection:
    con = sqlite3.connect(f"file:{HERMES_STATE_DB.as_posix()}?mode=ro", uri=True, timeout=10)
    con.row_factory = sqlite3.Row
    return con


def completed_sessions_since(started_after: float, limit: int) -> list[dict[str, Any]]:
    """Sessions started after the watermark whose last activity is old enough to be final."""
    cutoff = time.time() - COMPLETED_IDLE_S
    with _connect() as con:
        rows = con.execute(
            """
            select s.*, coalesce(max(m.timestamp), s.started_at) as last_msg_ts
            from sessions s
            left join messages m on m.session_id = s.id
            where s.started_at > ?
              and s.message_count >= 2
              and s.archived = 0
            group by s.id
            having (s.ended_at is not null or last_msg_ts < ?)
            order by s.started_at asc
            limit ?
            """,
            (started_after, cutoff, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def session_messages(session_id: str) -> list[dict[str, Any]]:
    with _connect() as con:
        rows = con.execute(
            """
            select role, content, tool_calls, tool_name, timestamp, finish_reason
            from messages
            where session_id = ? and active = 1
            order by timestamp asc
            """,
            (session_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def _tool_names(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        calls = json.loads(raw)
    except ValueError:
        return []
    names: list[str] = []
    if isinstance(calls, list):
        for call in calls:
            if isinstance(call, dict):
                fn = call.get("function") or {}
                name = fn.get("name") if isinstance(fn, dict) else None
                names.append(name or call.get("name") or "unknown")
    return names


def build_observation(session: dict[str, Any]) -> dict[str, Any]:
    """Maps a Hermes session into the TaskObservation shape used by loop_iterations."""
    messages = session_messages(session["id"])

    user_msgs = [m for m in messages if m["role"] == "user" and (m["content"] or "").strip()]
    assistant_msgs = [m for m in messages if m["role"] == "assistant"]

    tools: list[dict[str, Any]] = []
    for m in messages:
        for name in _tool_names(m.get("tool_calls")):
            tools.append({"tool": name})

    corrections = [
        (m["content"] or "")[:280]
        for m in user_msgs[1:]
        if any(k in (m["content"] or "").lower() for k in ("no,", "wrong", "not what", "instead", "actually", "לא נכון", "טעות"))
    ]
    mistakes = [
        (m["content"] or "")[:280]
        for m in assistant_msgs
        if any(k in (m["content"] or "").lower() for k in ("error:", "failed", "exception", "traceback"))
    ][:5]

    first_user = (user_msgs[0]["content"] or "") if user_msgs else ""
    final_assistant = (assistant_msgs[-1]["content"] or "") if assistant_msgs else ""
    duration = max(0.0, float(session.get("last_msg_ts") or session["started_at"]) - float(session["started_at"]))

    return {
        "task_id": f"hermes-{session['id']}",
        "session_key": session["id"],
        "source": "hermes",
        "ts_epoch": float(session["started_at"]),
        "title": session.get("title") or "",
        "model": session.get("model") or "",
        "cwd": session.get("cwd") or "",
        "user_request": first_user[:2000],
        "output": final_assistant[:2000],
        "tools_used": tools,
        "mistakes": mistakes,
        "corrections": corrections,
        "token_usage": int(session.get("input_tokens") or 0) + int(session.get("output_tokens") or 0),
        "turn_count": int(session.get("message_count") or 0),
        "duration_seconds": round(duration, 1),
    }


def transcript_excerpt(session_id: str, max_chars: int = MAX_TRANSCRIPT_CHARS) -> str:
    """Compact role-tagged transcript for the judge, newest content preserved."""
    parts: list[str] = []
    for m in session_messages(session_id):
        role = m["role"]
        if role == "tool":
            content = (m["content"] or "")[:400]
            parts.append(f"[tool:{m.get('tool_name') or '?'}] {content}")
            continue
        content = (m["content"] or "").strip()
        tool_names = _tool_names(m.get("tool_calls"))
        if tool_names:
            parts.append(f"[{role}] (calls tools: {', '.join(tool_names)}) {content[:600]}")
        elif content:
            parts.append(f"[{role}] {content[:1200]}")
    text = "\n".join(parts)
    if len(text) > max_chars:
        head = text[: max_chars // 3]
        tail = text[-(max_chars * 2 // 3):]
        text = head + "\n[... transcript truncated ...]\n" + tail
    return text

"""LLM-as-judge via `hermes -z` headless mode (Hermes providers).

The judge model is pinned via JUDGE_MODEL in scripts/.env so scoring does not
run on the same model that acted (plan rule: never grade your own output).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
from typing import Any

from .common import HERMES_CLI, JUDGE_TIMEOUT_S, log


class JudgeError(RuntimeError):
    pass


def judge_model() -> str | None:
    return os.environ.get("JUDGE_MODEL") or None


def run_headless(prompt: str, model: str | None = None, timeout_s: int = JUDGE_TIMEOUT_S) -> str:
    cmd = ["pwsh", "-NoProfile", "-File", str(HERMES_CLI), "-z", prompt]
    chosen = model or judge_model()
    if chosen:
        cmd += ["-m", chosen]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_s,
        )
    except subprocess.TimeoutExpired as exc:
        raise JudgeError(f"hermes -z timed out after {timeout_s}s") from exc
    out = (proc.stdout or "").strip()
    if proc.returncode != 0 and not out:
        raise JudgeError(f"hermes -z exit {proc.returncode}: {(proc.stderr or '')[:300]}")
    if not out:
        raise JudgeError("hermes -z produced no output")
    return out


def extract_json(text: str) -> dict[str, Any]:
    """Finds the first JSON object in judge output (tolerates prose and fences)."""
    fenced = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    candidates = [fenced.group(1)] if fenced else []
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except ValueError:
            continue
    raise JudgeError(f"no JSON object in judge output: {text[:200]}")


def ask_json(prompt: str, retries: int = 1) -> dict[str, Any]:
    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return extract_json(run_headless(prompt))
        except JudgeError as exc:
            last = exc
            log(f"judge attempt {attempt + 1} failed: {exc}")
    raise JudgeError(str(last))

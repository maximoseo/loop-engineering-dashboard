"""Phase 3 LEARN: extract typed, reusable lessons from scored tasks."""
from __future__ import annotations

import json
import re

from lib import db
from lib.common import DATA_DIR, ITERATIONS_DIR, MAX_LESSON_TASKS_PER_RUN, RunLock, log, read_json, write_json
from lib.judge import JudgeError, ask_json
from lib.sanitize import scrub

LEDGER = DATA_DIR / "lessons_done.json"

PROMPT = """You extract reusable lessons from an AI agent's completed and scored task.

Rules:
- procedures (reusable step-by-step methods) -> target "skill"
- user preferences (language, style, tools the user favors) -> target "memory"
- pitfalls (mistakes to avoid, failure patterns) -> target "skill"
- optimizations (efficiency improvements) -> target "config" or "prompt"
- NEVER include credentials, API keys, tokens, or personal data
- Skip temporary/one-off details. Extract 0-3 lessons ONLY if genuinely reusable.
- evidence must quote or reference something concrete from the task.

TASK (score {score}/100):
{meta}

JUDGE RATIONALE: {rationale}

Respond with ONLY JSON:
{{"lessons": [{{"lesson_type": "preference|procedure|pitfall|optimization",
  "content": "<=300 chars, imperative, standalone",
  "evidence": "<=200 chars",
  "confidence": 0.0-1.0,
  "target": "memory|skill|prompt|config"}}]}}"""


def scored_without_lessons(limit: int) -> list[dict]:
    done = set(read_json(LEDGER, []))
    rows = db.run_sql(
        """
        select s.task_id, s.total, s.rationale
        from public.loop_scores s
        order by s.created_at asc;
        """
    )
    pending = [r for r in rows if r["task_id"] not in done]
    return pending[:limit]


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:60] or "pattern"


def process_task(row: dict) -> int:
    task_id = row["task_id"]
    obs = read_json(ITERATIONS_DIR / f"{task_id}.json", {})
    meta = {
        "user_request": obs.get("user_request", ""),
        "final_output": (obs.get("output", "") or "")[:800],
        "tools_used": [t.get("tool") for t in obs.get("tools_used", [])][:30],
        "detected_mistakes": obs.get("mistakes", []),
        "user_corrections": obs.get("corrections", []),
    }
    prompt = PROMPT.format(
        score=row["total"],
        meta=json.dumps(meta, ensure_ascii=False, indent=1),
        rationale=(row.get("rationale") or "")[:400],
    )
    try:
        verdict = ask_json(prompt, retries=1)
    except JudgeError as exc:
        log(f"lessons: judge failed for {task_id}: {exc}")
        return -1

    lessons = verdict.get("lessons") or []
    stored = 0
    for i, lesson in enumerate(lessons[:3]):
        content, findings = scrub(str(lesson.get("content", ""))[:300])
        evidence, f2 = scrub(str(lesson.get("evidence", ""))[:200])
        if not content:
            continue
        if findings or f2:
            log(f"lessons: redacted secrets in lesson from {task_id}; skipping storage")
            continue
        lesson_type = str(lesson.get("lesson_type", "procedure"))
        if lesson_type not in ("preference", "procedure", "pitfall", "optimization"):
            lesson_type = "procedure"
        target = str(lesson.get("target", "skill"))
        if target not in ("memory", "skill", "prompt", "config"):
            target = "skill"
        try:
            confidence = max(0.0, min(1.0, float(lesson.get("confidence", 0))))
        except (TypeError, ValueError):
            confidence = 0.0

        db.insert(
            "loop_lessons",
            {
                "lesson_id": f"{task_id}-L{i + 1}",
                "source_task_id": task_id,
                "lesson_type": lesson_type,
                "content": content,
                "evidence": evidence,
                "confidence": confidence,
                "target": target,
            },
            on_conflict="lesson_id",
        )
        stored += 1

        if lesson_type == "pitfall":
            key = slugify(content)
            db.run_sql(
                f"""
                insert into public.loop_failure_patterns (pattern_key, description, severity, examples)
                values ({db.sql_literal(key)}, {db.sql_literal(content)}, 'medium',
                        {db.sql_literal([task_id])})
                on conflict (pattern_key) do update
                set frequency = public.loop_failure_patterns.frequency + 1,
                    last_seen = now(),
                    examples = public.loop_failure_patterns.examples || {db.sql_literal([task_id])};
                """
            )
    log(f"lessons: {task_id} -> {stored} lesson(s)")
    return stored


def run() -> int:
    pending = scored_without_lessons(MAX_LESSON_TASKS_PER_RUN)
    if not pending:
        log("lessons: nothing pending")
        return 0
    db.set_loop_state("learning")
    done = read_json(LEDGER, [])
    for row in pending:
        if process_task(row) >= 0:
            done.append(row["task_id"])
            write_json(LEDGER, done)
    db.set_loop_state("proposing")
    return len(pending)


if __name__ == "__main__":
    with RunLock("lessons"):
        run()

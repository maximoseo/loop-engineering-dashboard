"""Secret scanner. Every string persisted to Supabase or disk passes through scrub()."""
from __future__ import annotations

import re

_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("private-key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----")),
    ("aws-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("github-token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b")),
    ("github-pat", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b")),
    ("openai-key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")),
    ("anthropic-key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b")),
    ("slack-token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b")),
    ("supabase-secret", re.compile(r"\bsb_secret_[A-Za-z0-9_-]{10,}\b")),
    ("supabase-token", re.compile(r"\bsbp_[A-Za-z0-9]{20,}\b")),
    ("stripe-key", re.compile(r"\b[rs]k_live_[A-Za-z0-9]{16,}\b")),
    ("telegram-token", re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b")),
    ("url-credentials", re.compile(r"(?<=://)[^\s/@:]{1,64}:[^\s/@]{1,128}@")),
    ("bearer", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{20,}")),
    ("generic-assign", re.compile(
        r"(?i)\b(api[_-]?key|secret|password|passwd|access[_-]?token|service[_-]?role)\b\s*[:=]\s*['\"]?[A-Za-z0-9._~+/=-]{12,}"
    )),
]


def scrub(text: str) -> tuple[str, list[str]]:
    """Returns (clean_text, finding_types). Replacements keep surrounding context readable."""
    if not text:
        return text, []
    findings: list[str] = []
    clean = text
    for name, pattern in _PATTERNS:
        if pattern.search(clean):
            findings.append(name)
            clean = pattern.sub(f"[REDACTED:{name}]", clean)
    return clean, findings


def scrub_obj(obj):
    """Recursively scrub strings inside dicts/lists. Returns (clean_obj, all_findings)."""
    findings: list[str] = []

    def _walk(node):
        if isinstance(node, str):
            clean, f = scrub(node)
            findings.extend(f)
            return clean
        if isinstance(node, list):
            return [_walk(x) for x in node]
        if isinstance(node, dict):
            return {k: _walk(v) for k, v in node.items()}
        return node

    return _walk(obj), findings

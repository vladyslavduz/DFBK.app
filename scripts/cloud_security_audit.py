#!/usr/bin/env python3
"""Evidence-based, non-invasive source audit for DFBK.app. Python 3.11+ stdlib.

Does not import application modules, connect to production or execute providers.
Every item is a static observation or NOT VERIFIED, not security certification.
"""
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "security-audit"
SOURCE_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
EXCLUDED = {"node_modules", "dist", ".git", "artifacts", ".wrangler", "coverage"}
CATEGORIES = {
    "auth_and_sessions": [r"auth", r"session", r"password", r"oauth", r"token"],
    "authorization_and_admin": [r"admin", r"permission", r"owner", r"unauthorized"],
    "projects_media": [r"project", r"media", r"upload", r"image"],
    "scheduler_and_social": [r"publish", r"social", r"schedul", r"planner"],
    "trial_and_quota": [r"trial", r"entitlement", r"quota", r"budget"],
    "billing": [r"billing", r"payment", r"stripe", r"business"],
}
# These are search prompts, not vulnerabilities; a hit is not a defect.
REVIEW_PATTERNS = {
    "dynamic_execution": re.compile(r"\beval\s*\(|\bnew\s+Function\s*\("),
    "html_injection_sinks": re.compile(r"dangerouslySetInnerHTML|\binnerHTML\s*="),
    "browser_storage": re.compile(r"\blocalStorage\b|\bsessionStorage\b"),
    "browser_navigation": re.compile(r"window\.open\s*\(|location\.href\s*="),
    "security_config_terms": re.compile(r"Access-Control-Allow-Origin|SameSite|HttpOnly|Content-Security-Policy"),
}
def tracked_paths() -> list[Path]:
    proc = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True)
    paths = []
    for name in proc.stdout.decode("utf-8", "replace").split("\0"):
        if not name:
            continue
        p = Path(name)
        if any(segment in EXCLUDED for segment in p.parts):
            continue
        paths.append(p)
    return paths

def snapshot(path: Path) -> str:
    return (ROOT / path).read_text(encoding="utf-8", errors="replace")

def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    paths = tracked_paths()
    sources = [p for p in paths if p.suffix in SOURCE_EXT]
    tests = [p for p in paths if str(p).startswith("tests/") or (str(p).startswith("scripts/") and "smoke" in p.name)]
    migrations = [p for p in paths if str(p).startswith("database/") and p.suffix == ".sql"]
    findings = []
    matches = []
    for p in sources:
        lines = snapshot(p).splitlines()
        for lineno, line in enumerate(lines, start=1):
            for label, pattern in REVIEW_PATTERNS.items():
                if pattern.search(line):
                    # Never include line text: could contain credentials or user data.
                    matches.append({"kind": label, "file": str(p), "line": lineno, "status": "REVIEW_REQUIRED"})
    for category, terms in CATEGORIES.items():
        matched = sorted({str(p) for p in tests if any(re.search(term, str(p), re.I) for term in terms)})
        findings.append({
            "area": category,
            "tests_by_filename": matched,
            "conclusion": "TEST_FILES_FOUND_NOT_COVERAGE_PROOF" if matched else "NO_TEST_FILE_NAME_MATCH",
        })
    config = ROOT / "wrangler.jsonc"
    flags = {}
    if config.exists():
        raw = config.read_text(encoding="utf-8", errors="replace")
        for flag in ("SOCIAL_ENABLED", "SCHEDULER_READ_ENABLED", "SCHEDULER_WRITE_ENABLED"):
            m = re.search(r'"' + re.escape(flag) + r'"\s*:\s*"([^"]*)"', raw)
            flags[flag] = m.group(1) if m else "NOT DECLARED"
        m = re.search(r'"invocation_logs"\s*:\s*(true|false)', raw)
        flags["invocation_logs"] = m.group(1) if m else "NOT DECLARED"
    baseline = ROOT / "docs" / "PRODUCT_BASELINE.md"
    report = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "git_head": subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip(),
        "mode": "STATIC_SOURCE_AUDIT_ONLY",
        "source_files": len(sources),
        "test_files": len(tests),
        "migration_files": len(migrations),
        "product_baseline_exists": baseline.exists(),
        "repository_flags_not_runtime_proof": flags,
        "coverage_filename_inventory": findings,
        "review_candidates_no_source_text": matches[:500],
        "review_candidates_total": len(matches),
        "limitations": [
            "No dynamic vulnerability scanning or authenticated Production E2E.",
            "Filename matches are not test assertion or security coverage.",
            "Static pattern matches are review candidates, not proven vulnerabilities.",
            "No live Cloudflare/D1/R2, OAuth providers, email, payments or AI calls.",
            "No access to chats or private project notes outside the repository.",
        ],
    }
    (OUTPUT / "audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# DFBK.app — Cloud static/security audit",
        "",
        "This report is **not** a certification or comprehensive penetration test.",
        f"- Git commit: \`{report['git_head']}\`",
        f"- Tracked source files: {len(sources)}",
        f"- Test/smoke files: {len(tests)}",
        f"- SQL migration files: {len(migrations)}",
        f"- Approved product baseline exists: **{baseline.exists()}**",
        "",
        "## Repository configuration (NOT effective production state)",
    ]
    lines += [f"- \`{k}\`: \`{v}\`" for k, v in flags.items()]
    lines += ["", "## Test-file discovery (not coverage proof)", "| Area | Matched file count | Status |", "|---|---:|---|"]
    for item in findings:
        lines.append(f"| {item['area']} | {len(item['tests_by_filename'])} | {item['conclusion']} |")
    lines += ["", "## Static review candidates", f"Total matches: {len(matches)} (first 500 in audit.json).",
              "They require human analysis; absence of matches does not establish safety.", "",
              "## Known verification gaps", ""]
    lines.extend("- " + item for item in report["limitations"])
    lines += ["", "## Release-readiness evidence status", "",
              "| Domain | Status |", "|---|---|",
              "| Code structure | INVENTORIED |",
              "| Test existence | INVENTORIED, ASSERTIONS NOT AUDITED |",
              "| Product drift vs baseline | NOT VERIFIED (needs semantic audit) |",
              "| Security controls effectiveness | NOT VERIFIED |",
              "| Database migration safety | NOT VERIFIED |",
              "| Production config / deployment | NOT VERIFIED |",
              "| Real OAuth / email / AI / publishing | NOT VERIFIED |",
              "", "This run is evidence collection only. Do not mark application READY based on this report.", ""]
    (OUTPUT / "audit.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"Static audit collected: {len(sources)} source, {len(tests)} tests, {len(matches)} review candidates.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

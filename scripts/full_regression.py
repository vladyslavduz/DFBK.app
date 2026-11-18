#!/usr/bin/env python3
"""Run DFBK's existing local checks and produce artifact-friendly reports.

Uses only local test fixtures and a localhost Vite preview. Never calls deploy.
Run with Python 3.11+ and Node dependencies already installed.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from datetime import datetime, timezone
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
PREVIEW_URL = "http://127.0.0.1:5173"
STEPS = (
    ("frontend_typecheck", ["npm", "run", "typecheck:frontend"], 300),
    ("frontend_build", ["npm", "run", "build"], 360),
    ("node_unit_api", ["npm", "run", "test:local"], 900),
    ("browser_smoke", ["npm", "run", "test:publishing-ui"], 480),
)


def run_step(name: str, command: list[str], timeout: int, env: dict[str, str], out: Path) -> dict:
    started = time.monotonic()
    log_path = out / (name + ".log")
    status, exit_code = "FAIL", -1
    with log_path.open("w", encoding="utf-8", errors="replace") as log:
        log.write("Command: " + " ".join(command) + "\n")
        log.flush()
        try:
            with subprocess.Popen(
                command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT,
                shell=False,
            ) as process:
                try:
                    exit_code = process.wait(timeout=timeout)
                    status = "PASS" if exit_code == 0 else "FAIL"
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                    status = "TIMEOUT"
                    exit_code = 124
        except OSError as exc:
            log.write("\nUnable to start command: " + str(exc) + "\n")
            status, exit_code = "ERROR", 127
    duration = round(time.monotonic() - started, 2)
    print(f"{name}: {status} (exit={exit_code}, {duration}s)", flush=True)
    if status != "PASS":
        tail = log_path.read_text(encoding="utf-8", errors="replace").splitlines()[-25:]
        print("\n".join(tail), flush=True)
    return {
        "step": name, "status": status, "exit_code": exit_code,
        "duration_seconds": duration, "log": log_path.name,
    }


def await_preview(process: subprocess.Popen, timeout: int = 45) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("Vite preview process exited early")
        try:
            with urlopen(PREVIEW_URL + "/", timeout=2) as response:
                if 200 <= response.status < 400:
                    return
        except (OSError, URLError):
            pass
        time.sleep(0.5)
    raise TimeoutError("localhost Vite preview did not become ready")


def save_report(out: Path, results: list[dict], *, note: str = "") -> None:
    passed = sum(1 for result in results if result["status"] == "PASS")
    report = {
        "suite": "DFBK Full Regression (local fixtures only)",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "passed": passed,
        "total": len(results),
        "results": results,
        "note": note,
    }
    (out / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    lines = ["# DFBK Full Regression", "", f"Passed: **{passed}/{len(results)}**", "",
             "| Check | Status | Seconds | Log |", "|---|---|---:|---|"]
    for item in results:
        lines.append(f"| {item['step']} | {item['status']} | {item['duration_seconds']} | {item['log']} |")
    if note:
        lines += ["", "**Runner note:** " + note]
    lines += ["", "These are local/mocked checks; production OAuth, email delivery, Cloudflare D1/R2, paid AI and real social publishing are NOT verified.", ""]
    (out / "report.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="artifacts/full-regression", help="Directory for logs and JSON/Markdown report")
    args = parser.parse_args()
    out = (ROOT / args.output).resolve()
    out.mkdir(parents=True, exist_ok=True)

    # Never inherit an external preview or provider credentials from a shell.
    env = dict(os.environ)
    for key in list(env):
        upper = key.upper()
        if upper.endswith(("_API_KEY", "_SECRET", "_ACCESS_TOKEN", "_REFRESH_TOKEN")) or upper in {
            "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "DATABASE_URL",
            "RESEND_API_KEY", "OPENAI_API_KEY", "GITHUB_TOKEN", "GH_TOKEN",
            "GOOGLE_APPLICATION_CREDENTIALS",
        }:
            env.pop(key, None)
    env["PROMO_ORIGIN"] = PREVIEW_URL
    env["DFBK_TEST_MODE"] = "local"
    env["SOCIAL_ENABLED"] = "false"
    env["SCHEDULER_WRITE_ENABLED"] = "false"
    env["CI"] = env.get("CI", "true")

    results: list[dict] = []
    note = ""
    preview = None
    try:
        for name, command, timeout in STEPS:
            if name == "browser_smoke":
                # Never launch browser tests if build or unit tests failed.
                if any(item["status"] != "PASS" for item in results):
                    results.append({"step": name, "status": "SKIP", "exit_code": None,
                                    "duration_seconds": 0, "log": ""})
                    continue
                preview_log = (out / "vite_preview.log").open("w", encoding="utf-8")
                try:
                    preview = subprocess.Popen(
                        ["npm", "run", "preview", "--", "--host", "127.0.0.1",
                         "--port", "5173", "--strictPort"],
                        cwd=ROOT, env=env, stdout=preview_log, stderr=subprocess.STDOUT,
                        shell=False,
                    )
                    await_preview(preview)
                except (OSError, RuntimeError, TimeoutError) as exc:
                    note = f"Local browser preview did not start: {exc}"
                    results.append({"step": name, "status": "ERROR", "exit_code": 127,
                                    "duration_seconds": 0, "log": "vite_preview.log"})
                    continue
                finally:
                    preview_log.close()
            results.append(run_step(name, command, timeout, env, out))
    except KeyboardInterrupt:
        note = "Interrupted by user"
    finally:
        if preview is not None and preview.poll() is None:
            preview.terminate()
            try:
                preview.wait(timeout=10)
            except subprocess.TimeoutExpired:
                preview.kill()
                preview.wait()
        save_report(out, results, note=note)
        print(f"Reports: {out / 'report.md'} and {out / 'report.json'}", flush=True)

    return 0 if len(results) == len(STEPS) and all(x["status"] == "PASS" for x in results) else 1


if __name__ == "__main__":
    sys.exit(main())

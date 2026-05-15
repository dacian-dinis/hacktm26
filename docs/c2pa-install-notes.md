# Tier 1 — c2pa install notes (Windows)

Quick reference recorded while the rest of the team finishes Phase 0. Do not
treat as final docs — fold into the api README once Phase 0 lands.

## What works

```
pip install c2pa-python
```

Wheel: `c2pa_python-0.32.6-py3-none-win_amd64.whl` (~94 MB, pre-built, no
toolchain needed). Underlying Rust SDK reports `c2pa.sdk_version() == "0.81.0"`.
Verified on Windows 11, Python 3.14.0, pip 26.0.1, 2026-05-15.

Add to `apps/api/requirements.txt` after Phase 0 rebase:

```
c2pa-python==0.32.6
```

## What does NOT work — record so nobody else burns time

`pip install c2pa` (no `-python` suffix) resolves to an unrelated third-party
package that pulls in `py3exiv2`, which then tries to compile a C++ extension
against `exiv2/exiv2.hpp` and fails with MSVC `C1083` (header not found). This
is a name-collision trap, not a problem with the real CAI library.

## Fallback if the official wheel ever breaks (Render free tier, future Python, etc.)

Shell out to the `c2patool` binary instead of the Python bindings:

1. Download the latest release from
   <https://github.com/contentauth/c2patool/releases> for the target OS.
2. Drop the binary somewhere on `PATH` (locally: `apps/api/bin/c2patool.exe`;
   on Render: stage in the build step).
3. Invoke via `subprocess.run`:

   ```python
   import json, subprocess
   def verify_via_cli(path: str) -> dict:
       proc = subprocess.run(
           ["c2patool", path, "--detailed"],
           capture_output=True, text=True, timeout=30,
       )
       if proc.returncode != 0:
           return {"ok": False, "error": proc.stderr.strip()}
       return {"ok": True, "manifest": json.loads(proc.stdout)}
   ```

4. The JSON schema is the same as the Python bindings' `Reader.json()` output,
   so the `Finding.evidence` shape we return upstream does not have to change.

Decision rule: prefer the Python bindings; only switch to the CLI fallback if
the container image refuses to install the wheel or the Python version
mismatches the available pre-built wheels.

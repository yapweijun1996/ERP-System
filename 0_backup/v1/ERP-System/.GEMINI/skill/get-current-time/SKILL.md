---
name: get-current-time
description: "Get the current date/time reliably in a requested timezone and format, with commands/snippets for common environments (macOS/Linux/Windows, Python, JavaScript/Node) and clear assumptions about the time source."
version: "1.0"
tags: [workflow, sop, dev, docs]
---

# Goal
Return the current time in the user’s desired timezone and format, using the most appropriate method for their environment (shell, language runtime, or app context) and stating the time source (local system clock vs external/authoritative source).

# When to Use
- You need “current time” output in a specific format (ISO 8601, Unix epoch, human-readable) or timezone.
- You need a copy/pastable command/snippet to print “now” in a particular runtime (shell, Python, Node, CFML, etc.).

# Inputs
- Environment: macOS/Linux shell, Windows (PowerShell), or a specific language/runtime.
- Timezone requirement: local timezone, UTC, or a named timezone (e.g., `Asia/Kuala_Lumpur`).
- Format requirement: ISO 8601, RFC 3339, Unix epoch seconds/ms, or a custom format.
- Constraints:
  - Default to local system clock unless the user explicitly needs an authoritative network time source.
  - Don’t assume timezone; ask if the output must be UTC or local.

# Output
- The “current time” value in the requested format/timezone.
- A minimal command/snippet to reproduce it in the stated environment.
- Any assumptions (timezone, locale, and time source).

# Procedure
1. Confirm the minimum requirements (ask only if missing).
   - Environment (shell/OS or language runtime).
   - Timezone: local vs UTC vs named timezone.
   - Format: ISO 8601 vs epoch vs custom.
2. Choose the time source.
   - Default: local machine/server system clock.
   - If the user needs authoritative time (auditing/compliance), recommend using a trusted time service and state that it requires network access.
3. Produce the output + a reproducible snippet.
   - Prefer a single command/snippet that prints exactly one line (easy to parse).
   - Prefer ISO 8601 / RFC 3339 for logs and APIs.
4. Provide fallbacks for portability.
   - If a command differs across OSes, provide OS-specific variants.
   - If timezone support differs, provide a safe fallback (e.g., use UTC).
5. State assumptions explicitly.
   - “Timezone assumed: …”
   - “Source: local system clock (not NTP-verified)” if relevant.

# Verification (Acceptance Checks)
- [ ] Output includes a timezone (either implicit local or explicitly stated).
- [ ] Output format matches what the user requested (or the closest supported alternative is explained).
- [ ] Provided command/snippet prints the same value type (ISO/epoch) when run in the stated environment.

# Failure Modes & Recovery
- **If timezone is unclear**: ask user “Should this be in UTC or your local timezone? If named timezone, which one (e.g., `Asia/Kuala_Lumpur`)?”
- **If format is unclear**: ask user “Do you want ISO 8601 (e.g., `2026-01-09T12:34:56Z`) or Unix epoch?”
- **If OS/runtime is unknown**: ask user “Which environment should I target (macOS/Linux shell, Windows PowerShell, Python, Node, etc.)?”
- **If timezone names aren’t supported**: switch to UTC output → note the limitation and suggest installing/using a runtime/library with IANA tz support.

# Examples
## Example A
**User request:** “Get current time in UTC as ISO 8601 from macOS terminal.”
**What you do:** Choose system clock → output one-line UTC timestamp.
**Result:** `date -u +%Y-%m-%dT%H:%M:%SZ`

## Example B
**User request:** “Print current time as Unix epoch milliseconds in Node.”
**What you do:** Choose system clock → output epoch ms.
**Result:** `node -e "console.log(Date.now())"`

## Example C
**User request:** “Get current time in Python, timezone-aware, ISO 8601.”
**What you do:** Use stdlib timezone-aware datetime → print ISO.
**Result:** `python -c "from datetime import datetime,timezone; print(datetime.now(timezone.utc).isoformat())"`

# Notes (optional)
- For logs/APIs, prefer UTC with ISO 8601/RFC 3339 to avoid DST ambiguity.
- If the user needs “current time on a remote server”, run the command on that server (the local machine clock may differ).

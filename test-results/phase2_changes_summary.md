# Phase 2 — fixes for PHI and secrets in logs and audit table

Goal: make `server/tests/test_phi_logging.py` pass without modifying the Phase-1 tests (the diff of that file against the Phase-1 commit `21fd929` contains additions only).

**Results (Docker, `localhost/phlox-test:latest`):**
- `test-results/phase2_phi_logging.txt`: **18 passed** (the 7 Phase-1 tests + 11 new redaction-filter tests).
- `test-results/phase2_full_suite.txt`: **491 passed, 1 xfailed**, 0 failed. The xfail is pre-existing and unrelated (`test_helpers.py::TestCleanThinkTags::test_removes_unicode_think_variant`).
- No existing test needed changes. `test_audit.py:44` (`path == "/api/ping"`) still passes because the route template equals the path for routes without parameters.
- Ruff: all changed files are formatted. One lint finding remains, in Phase-1 test code that was not to be modified: `ARG001` unused `patient_id` at `tests/test_phi_logging.py:42`.

Line numbers below refer to the files after the change.

---

## Shared helper: route template instead of raw path

`server/middleware.py:56-89`, new `_route_info(request)`. It returns `(route template, path params)`:
- **After routing:** FastAPI stores the matched route in `scope["route"]`, so the helper uses that.
- **Before routing** (auth and rate-limit middlewares): it matches the request against the app's routes, skipping `Mount`s, because the static `/` mount matches everything.
- **Unknown paths:** they become the fixed placeholder `"<unmatched>"`.

```python
route = scope.get("route")
if route is not None and getattr(route, "path_format", None):
    return route.path_format, dict(scope.get("path_params") or {})
...
return partial or (UNMATCHED_ROUTE, {})
```
**Why:** one place that turns a request into something safe to log or store. `/api/note/id/987654` becomes `/api/note/id/{id}`, which keeps the information about *what kind* of access happened but drops the identifier.

## Fix 1: AuditMiddleware stores the route template plus a pseudonymous `subject_ref`

**`server/middleware.py:664-686`**

Before:
```python
enqueue_event(
    method=request.method,
    path=path,                      # raw request.url.path
    status=status, ...
)
```
After:
```python
template, path_params = _route_info(request)
enqueue_event(
    method=request.method,
    path=template,                  # e.g. /api/note/id/{id}
    status=status, ...,
    subject_ref=subject_ref(path_params),
)
```
The same `_record()` helper is used for the exception (500) path. The skip rules (audit endpoints, config-status poller, live audio chunks) still use the raw path. That path is only compared, never stored.

**`server/database/repositories/audit.py:27-65`**: HMAC pseudonym.
```python
SUBJECT_PARAMS = frozenset({"id", "note_id", "patient_id", "ur_number"})
key = hmac.new(get_db().encryption_key.encode(), b"phlox-audit-subject-ref-v1", sha256).digest()
parts = [f"{k}={path_params[k]}" for k in sorted(path_params) if k in SUBJECT_PARAMS]
return hmac.new(key, "&".join(parts).encode(), hashlib.sha256).hexdigest()
```
`enqueue_event` and `log_event` accept `subject_ref`. All 3 INSERTs (lines 158, 182, 215) and the `get_events` SELECT (line 247) include the column.

**Migration** `server/database/core/migrations/v11_audit_subject_ref.py` (new); `migrations/__init__.py` registers it; `runner.py:7` sets `SCHEMA_VERSION = 11`.
```python
cursor.execute("ALTER TABLE audit_log ADD COLUMN subject_ref TEXT")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_subject_ref ON audit_log(subject_ref)")
```

**Audit API** `server/api/audit.py:64`: `subject_ref` added to the CSV `fieldnames`; the JSON export and list return it automatically via `get_events`.

**Why:**
- **The leak:** the raw path put patient/note IDs next to actor, IP and timestamp in a table that admins can list and export to CSV/JSON.
- **The template:** storing the route template removes the identifier.
- **Accountability:** `subject_ref` keeps it. The same patient always produces the same value, so "every access to patient X" stays answerable. Verified in Docker: two requests for ID `987654` produced the same `subject_ref`, ID `111111` produced a different one, and recomputing `subject_ref({"id": "987654"})` gave the stored value.

**HMAC key choice:** the key is derived from the existing database encryption key (desktop passphrase, Docker secret file or `DB_ENCRYPTION_KEY`), with a fixed label for domain separation.
- **No new secret:** nothing extra to provision, back up or rotate, in either deployment mode.
- **Never stored:** the key is not in the database, so an exported CSV, a log of the API response, or a copy of the `audit_log` rows alone gives only pseudonyms. An attacker would need the database key to test guessed IDs.
- **No extra exposure:** anyone who has the database key can already decrypt the patient tables, so deriving the audit key from it gives them nothing new.
- **Domain separation:** the label means the HMAC key is not the encryption key itself.
- **Trade-off:** if the database key is changed, new rows get different pseudonyms, so old and new rows for the same patient cannot be linked without the old key.
- **Rejected alternative:** a random key stored in the `config` table, because it would sit inside the same database it is meant to protect against.

**Audit API proposal:** `subject_ref` is exposed read-only to admins in list and export; it is pseudonymous, so this does not reintroduce the leak. A lookup endpoint (admin-only `GET /api/audit?patient_id=…` that computes the HMAC on the server and filters) is the natural next step for investigations. It was deliberately not built in this phase.

## Fix 2: LocalTokenMiddleware invalid-token warning

**`server/middleware.py:343-350`**

Before:
```python
if not secrets.compare_digest(provided_token, expected_token):
    logger.warning(f"Invalid token for {path} (got {provided_token[:8]}...)")
```
After:
```python
if not secrets.compare_digest(provided_token, expected_token):
    logger.warning(
        "Invalid request token (method=%s, route=%s)",
        request.method,
        _route_info(request)[0],
    )
```
**Why:** the event is still logged at WARNING (needed to spot probing), but no token characters are written, so neither a mistyped real token nor half its prefix ends up in the log. The raw path is replaced by the route template.

## Fix 3: RateLimitMiddleware warning

**`server/middleware.py:602-605`**

Before:
```python
logger.warning(f"Rate limit exceeded for {client_ip} on {path}")
```
After:
```python
logger.warning(
    "Rate limit exceeded for %s on endpoint group %s", client_ip, endpoint
)
```
**Why:** rate limiting fires exactly during enumeration, so logging the full path produced a list of targeted patient IDs per IP. The endpoint group (`/api/default`, `/api/note/detail`, …) is the limiter's own bucket key, already computed, and is enough to see what was being hammered.

## Fix 4: Sanitizer logs metadata only

**`server/chat/tools/sanitization.py:15-43`** (named rule list), **`:62-96`** (use and logging).

Before:
```python
sanitized = re.sub(r"\bMRN\s*[:#]?\s*\d+\b", "", sanitized, flags=re.IGNORECASE)
...
if sanitized != query:
    logger.info(f"Sanitized search query: '{query}' -> '{sanitized}'")
```
After:
```python
for rule_name, pattern in _PHI_RULES:          # ("mrn", re.compile(...)), ...
    sanitized, count = pattern.subn("", sanitized)
    if count and rule_name not in fired:
        fired.append(rule_name)
...
logger.info("Sanitized search query: rules=%s, length %d -> %d",
            ",".join(fired) or "whitespace", len(query), len(sanitized))
```
**Why:** the old message was logged *only* when PHI had been found, and it contained both the original query and the sanitized one. Patient names survive the regex rules, so the sanitized text is still PHI. Example log line now: `Sanitized search query: rules=mrn, length 39 -> 28`.
- **Same behaviour:** the patterns, flags and order are unchanged. The old and new functions returned the same output on 36 sample inputs (with and without patient context, plus the PubMed variant), and `test_sanitization.py` still passes.

## Fix 5: Uvicorn access log disabled

**`server/server.py:411` and `:435`**

Before:
```python
config = uvicorn.Config(
    app, host=..., port=...,
    proxy_headers=False,
)
```
After:
```python
config = uvicorn.Config(
    app, host=..., port=...,
    proxy_headers=False,
    access_log=False,  # access lines carry raw paths with patient IDs
)
```
**Why:** uvicorn's access logger writes `client - "GET /api/note/id/<id>?<query> HTTP/1.1" 200` for every request, including query strings such as `/api/note/search?name=…`. The audit table already records access (now without raw IDs), so the access log adds risk without adding accountability.

## Fix 6: Central redaction filter (defence in depth)

**`server/utils/log_redaction.py`** (new): `redact()` and `RedactingFilter`.
```python
text = _BEARER.sub(r"\1 [REDACTED]", text)          # Bearer <token>
text = _MRN.sub("MRN [REDACTED]", text)             # MRN 123456
text = _UR.sub("UR [REDACTED]", text)               # UR 1234567
text = _EMAIL.sub("[EMAIL]", text)
return _API_PATH.sub(_redact_api_path, text)        # /api/.../987654?x=y -> /api/.../{id}
```
`RedactingFilter.filter()` returns a **redacted copy** of the record (Python 3.12 handler-filter semantics) and leaves the original untouched.

**`server/server.py:44, 54-55`**: installed right after `logging.basicConfig(...)`:
```python
# Defence in depth: mask tokens, MRN/UR, emails and path IDs in all log output
install_redaction()
```
**Why:**
- **Catches what slips through:** the leak sites fixed above are only the ones in scope (the Phase-1 grep found about 20 more), and new code can reintroduce leaks. A filter on the root handlers covers every logger that propagates to root.
- **On the handler, not the logger:** a filter on the root *logger* would not see records from child loggers such as `server.middleware`, so it is attached to the root *handlers*.
- **Returns a copy:** other handlers, including pytest's `caplog`, see the original record. The Phase-1 tests therefore pass only because the source code was fixed, not because the filter hides the leak. This matters because `test_docker_auth.py` imports `server.server`, which installs the filter during the full suite.

**New tests** (appended section "6. Central redaction filter", 11 cases):
- **Each pattern is masked:** bearer, MRN, UR, email, numeric path ID, query string, UUID path segment.
- **Non-PHI text is unchanged:** route templates and "endpoint group" messages pass through.
- **The filter returns a copy:** it formats `%`-args and does not modify the original record.
- **Clean records pass unchanged.**
- **It is installed:** after importing `server.server`, at least one root handler carries a `RedactingFilter`.

---

## Limitations / not addressed

- **Existing audit rows are not rewritten.** Rows written before migration v11 still contain raw paths until the retention purge removes them (default 90 days). The same applies to earlier exports and backups. A one-off scrub (for example, replacing numeric path segments with `{id}`) would be a separate, deliberate data change.
- **Uvicorn's own handlers are not filtered.** Uvicorn configures `uvicorn.error` with its own handler (`propagate=False`) when the server starts, so those records don't pass the root-handler filter. With `access_log=False` this is mainly startup and error lines.
- **The filter is pattern-based.** It does not catch free-text patient names. Exception tracebacks (`exc_info`) are not redacted, only the message.
- **Out-of-scope leak sites remain.** These include `middleware.py:333` (the fail-closed message logs the path; partly masked by the filter) and the chat-tool sites that log UR numbers and patient names (`create_note.py`, `patient_utils.py`, `previous_encounter.py`, etc.; see `phi_logging_summary.md`). Names in those messages are not caught by the filter.
- **`subject_ref` is only as strong as the key.** Patient/note IDs come from a small space, so anyone holding the database key can brute-force a pseudonym back to its ID. That is intended for auditors; without the key it is not possible.
- **`print()` output** (for example the desktop startup line with the request token in `server.py`) is not covered by logging filters.

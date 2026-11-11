# PHI and secrets in logs and audit table — technical summary (Phase 1)

Scope: tests only, no application code changed. Test file: `server/tests/test_phi_logging.py`.
Evidence: `test-results/phase1_phi_logging.txt` (Docker, `localhost/phlox-test:latest`, `pytest -v -rA`).
Result: 7 collected, 7 failed, all on the privacy assertion; every "still recorded / still logged / still rejected" precondition passed.

Log sinks referenced below: `server/server.py:46` configures `logging.basicConfig(level=logging.INFO, ...)` with the default stream handler, so all INFO+ records go to process stderr (Docker: container logs, `docker logs`, any log collector attached to them; desktop: the Python sidecar's output captured by the Tauri host). No application-level file handler exists apart from `utils/parent_watchdog.py` (watchdog only).

---

## 1. AuditMiddleware stores raw request paths in `audit_log`

- **Location:** `server/middleware.py:635-642` (`AuditMiddleware.dispatch`; same at 625-632 for the exception path). Persisted by `server/database/repositories/audit.py` `enqueue_event` → `audit_log.path` (schema `server/database/core/migrations/v7_audit_log.py:10-19`).
- **Code:**
  ```python
  enqueue_event(
      method=request.method,
      path=path,            # path = request.url.path, unmodified
      status=status,
      actor=getattr(request.state, "user", "local"),
  ```
- **What leaks / who sees it:** patient/note identifiers embedded in URLs (e.g. `/api/patient/id/987654`) are stored together with actor, client IP and timestamp, for successful and failed (4xx) requests alike. Readable by every admin via `GET /api/audit` and `GET /api/audit/export` (CSV/JSON, `server/api/audit.py:19-34`), by anyone with DB file + key access, and in backups. Default retention 90 days (`DEFAULT_RETENTION_DAYS`).
- **Test:** `test_audit_path_does_not_store_raw_patient_id[success]` and `[not_found]` (assertion at `test_phi_logging.py:114`).
- **Evidence (results lines 51, 90):**
  `E       AssertionError: assert '987654' not in '/api/patient/id/987654'`
- **Recommended fix:** store the route template instead of the concrete path, and keep accountability through a separate, pseudonymised patient reference.
  ```python
  route = request.scope.get("route")
  template = getattr(route, "path", None) or "<unmatched>"     # "/api/patient/id/{patient_id}"
  pid = request.path_params.get("patient_id")
  subject_ref = hmac.new(AUDIT_HMAC_KEY, pid.encode(), "sha256").hexdigest() if pid else None
  enqueue_event(method=request.method, path=template, subject_ref=subject_ref, ...)
  ```
  New `subject_ref` column (migration). With a keyed HMAC an auditor holding the key can still answer "who accessed patient X" (compute HMAC(X) and query), but a plain export or DB dump does not reveal IDs. Alternative: keep the raw ID in a column that is only exposed to a dedicated auditor role and excluded from the default export. Unmatched routes (404 on unknown path) should store a fixed placeholder, not the raw path.

## 2. LocalTokenMiddleware logs token prefix and path on invalid token

- **Location:** `server/middleware.py:309` (desktop mode, `IS_DOCKER=False`).
- **Code:**
  ```python
  if not secrets.compare_digest(provided_token, expected_token):
      logger.warning(f"Invalid token for {path} (got {provided_token[:8]}...)")
      return JSONResponse(status_code=403, content={"detail": "Invalid request token"})
  ```
- **What leaks / who sees it:** first 8 characters of the supplied bearer token (a near-miss/mistyped real token or a stale one leaks half its prefix; reduces brute-force entropy) plus the full request path including patient IDs. Visible to anyone reading the sidecar's stderr / desktop logs.
- **Test:** `test_invalid_token_not_logged` (assertion at `test_phi_logging.py:147`).
- **Evidence (results line 130 ff.):**
  `E           AssertionError: 6 privacy violation(s) in logs:`
  `[token fragment] 'Zq7x' found in log: 'Invalid token for /api/patient/id/987654 (got Zq7xK9pW...)'` (5 token fragments + 1 patient ID)
- **Recommended fix:** log the event, not the secret or the concrete path.
  ```python
  logger.warning("Invalid request token (method=%s, route=%s)", request.method, _route_template(request))
  ```
  If correlation is needed, log a short keyed hash of the token (`hmac(sha256)[:8]`), never raw characters.

## 3. RateLimitMiddleware logs full path when limiting

- **Location:** `server/middleware.py:562`.
- **Code:**
  ```python
  if requests_in_window >= effective_limit:
      ...
      logger.warning(f"Rate limit exceeded for {client_ip} on {path}")
  ```
- **What leaks / who sees it:** client IP linked to concrete patient/note IDs being requested — and rate limiting is precisely what fires during enumeration/scraping, so the log becomes a list of targeted patient IDs. Visible in container logs / stderr.
- **Test:** `test_rate_limit_warning_does_not_log_patient_id` (assertion at `test_phi_logging.py:178`).
- **Evidence (results line 177 ff.):**
  `E       AssertionError: 2 privacy violation(s) in logs:`
  `[patient ID] '987654' found in log: 'Rate limit exceeded for unknown on /api/patient/id/987654'`
- **Recommended fix:** log the rate-limit bucket (already computed) instead of the path.
  ```python
  logger.warning("Rate limit exceeded for %s on endpoint group %s", client_ip, endpoint)  # e.g. "/api/default"
  ```

## 4. Sanitizer logs original and sanitized search query

- **Location:** `server/chat/tools/sanitization.py:80-81` (`sanitize_query_for_external_search`); reached via `sanitize_pubmed_query` at line 98.
- **Code:**
  ```python
  if sanitized != query:
      logger.info(f"Sanitized search query: '{query}' -> '{sanitized}'")
  ```
- **What leaks / who sees it:** the original query is logged exactly when it contained PHI (the log only fires if something was stripped): MRN, email, phone, DOB, address, plus the sanitized query, which still contains patient names because the regex sanitizer has no name rule. INFO level, so on by default; visible in stderr / container logs.
- **Test:** `test_sanitizer_does_not_log_query_text[external_search]` and `[pubmed]` (assertion at `test_phi_logging.py:213`).
- **Evidence (results lines 236, 284 ff.):**
  `E       AssertionError: 5 privacy violation(s) in logs:` — original query, `MRN 123456`, `jane.fake@example.org`, sanitized query `'metformin dosing for Quentavius Fakeperson contact'`, name `Fakeperson`.
- **Recommended fix:** log metadata only.
  ```python
  removed = [name for name, pat in RULES if pat.search(query)]
  if removed:
      logger.info("Sanitized search query: rules=%s len %d->%d", removed, len(query), len(sanitized))
  ```
  (Requires turning the inline `re.sub` calls into a named rule list.)

## 5. Uvicorn access log enabled

- **Location:** `server/server.py:397` (desktop) and `server/server.py:418` (Docker).
- **Code:**
  ```python
  config = uvicorn.Config(
      app,
      host=os.getenv("SERVER_HOST", "0.0.0.0"),
      port=int(os.getenv("PORT", "5000")),
      ...                                   # no access_log=False
  ```
- **What leaks / who sees it:** uvicorn's default access logger (`uvicorn.access`, INFO) writes one line per request, `<client_ip> - "GET /api/patient/id/<id> HTTP/1.1" 200`, for every request (including requests the audit middleware skips). Visible in stdout / container logs. `server.py:54` silences `httpx` but not `uvicorn.access`.
- **Test:** `test_uvicorn_access_log_disabled_or_filtered` (assertion at `test_phi_logging.py:324`).
- **Evidence (results line 323):**
  `E       AssertionError: uvicorn started with access log enabled at: ['server.py:397', 'server.py:418']`
- **Recommended fix:** `access_log=False` in both `uvicorn.Config(...)` calls (the audit table already records access), or keep it with a redacting filter:
  ```python
  class _RedactPath(logging.Filter):
      def filter(self, record):
          # args = (client_addr, method, full_path, http_version, status)
          a = list(record.args); a[2] = re.sub(r"/\d+(?=/|$|\?)", "/{id}", a[2].split("?")[0])
          record.args = tuple(a); return True
  logging.getLogger("uvicorn.access").addFilter(_RedactPath())
  ```

---

## Other leak sites (documented, out of scope)

- `server/middleware.py:298` — fail-closed error logs full request path.
- `server/middleware.py:366` — proxy-auth denied username.
- `server/middleware.py:379` — proxy-auth unprovisioned/disabled username.
- `server/api/auth.py:120` — admin username at first-run setup.
- `server/api/auth.py:143` — username on login lockout.
- `server/chat/tools/pubmed_search.py:193` — post-sanitization search query (names survive).
- `server/chat/tools/pubmed_search.py:235` — first 500 chars of result content (DEBUG).
- `server/chat/tools/wiki_search.py:132` — post-sanitization search query.
- `server/chat/tools/literature_search.py:30` — raw disease name and raw clinical question.
- `server/chat/tools/create_note.py:64, 71, 117, 162, 190` — UR numbers.
- `server/chat/tools/create_note.py:154, 158` — patient name (and UR at 158).
- `server/chat/tools/create_note.py:216` — note ID (lower risk).
- `server/chat/tools/patient_utils.py:56-58` — queried name, matched patient name and UR.
- `server/chat/tools/patient_utils.py:61-63` — queried patient name on no match.
- `server/chat/tools/previous_encounter.py:113, 117` — patient name.
- `server/database/repositories/analysis.py:44` — patient `jobs_list` content on parse error.
- `server/nlp_tools/summarization_manager.py:54, 86` — note ID (lower risk).
- `server/agent_live/tools.py:799` — note ID (lower risk).

## Test design notes

- **httpx/httpcore denylist.** `TestClient` sends requests through httpx, which logs `HTTP Request: GET http://testserver/api/patient/id/987654 ...` at INFO. That is a test-harness artifact, not application logging, and caused false positives in an earlier run. `_log_messages` drops records from loggers `httpx`, `httpcore` and their children. A denylist (not a `server.*` allowlist) was chosen so that a leak through any other logger (application, uvicorn, third-party used by the app) is still caught.
- **4-character token windows.** The test checks every 4-char substring of the supplied token instead of the full token, so any partial disclosure (prefix, suffix, middle slice, a different truncation length) is detected, not only the current `[:8]` slice. The token `Zq7xK9pWv2Rj4Tn8` is random-looking so windows do not accidentally match normal log words.
- **Static uvicorn check.** Starting uvicorn in a test would bind a port and make the test slow/flaky, and importing `server.py` triggers app-wide side effects (logging config, DB init). The test parses `server.py` with `ast` and requires either `access_log=False` on every `uvicorn.Config`/`uvicorn.run` call, or a module-level `addFilter`, `setLevel(>= WARNING)` or `disabled = True` on `logging.getLogger("uvicorn.access")` (directly or via a variable).
- **Sanitizer preconditions.** Before checking logs, the test asserts the return value differs from the input and no longer contains the MRN or email. This keeps the test about logging: if the sanitizer itself stopped stripping these, the test fails with an explicit "sanitizer weakness" message instead of a misleading logging failure.
- **Violations collected, single assert.** Log-based tests gather all leaks (labelled) and assert once, so one run lists every leak.
- **Preconditions keep fixes honest.** Each test also asserts the security function still works (audit row recorded with correct method/status; 403 and a WARNING on bad token; 429 and a WARNING on rate limit), so "fixing" by deleting the audit/log call does not make the test pass.
- **Isolation.** Audit test baselines on `MAX(id)` after a flush; rate-limit test monkeypatches a fresh `_request_history` and a 1-req limit; token test restores the previous request token in `finally`. All data is fake.

## Limitations

- **caplog only.** Tests see records emitted through Python `logging`. Output written with `print()` or directly to stdout/stderr (e.g. `server.py:384` prints the startup token line) is not checked.
- **Single-middleware apps.** Each test builds a minimal FastAPI app with one middleware and one route, not the full middleware stack from `server.py`. Ordering effects (e.g. `client_ip` from TrustedProxy, actor from auth) and real routes are not exercised.
- **Static uvicorn check.** Verifies configuration in source, not runtime behaviour: a filter added in another module, via `log_config`/dictConfig, CLI flags or env vars would not be detected (false negative of the "fixed" state), and a filter that does not actually redact would be accepted.
- **Existing audit rows.** Tests only check newly written rows. Rows already stored with raw paths (up to the retention period) and existing exports/backups are not addressed; a fix needs a migration or purge.
- **Coverage.** Only the five in-scope sites are tested; the "other leak sites" list has no tests. Only the patient-detail path pattern is used; other ID-bearing routes (notes, letters, etc.) are not individually tested.
- **Docker vs desktop.** Run in the Docker test image; the desktop token path is simulated via `monkeypatch` of `IS_DOCKER`, not tested in a real Tauri sidecar.

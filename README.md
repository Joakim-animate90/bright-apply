# BrightApply

A production-grade Manifest V3 Chrome extension that lets a logged-in
BrighterMonday user paste a job URL, optionally attach a resume and cover
letter, and apply in **one click**.

The extension never sees your password, never stores tokens, and never
exfiltrates cookies. It works by piggy-backing on your existing
authenticated browser session.

---

## How it works

1. You paste a `https://www.brightermonday.co.ke/...` job URL into the popup.
2. The background service worker checks `chrome.cookies` for an active
   BrighterMonday session — it inspects cookie *presence*, never values.
3. It opens the job page in an **inactive background tab**.
4. The scraper is injected on demand via
   `chrome.scripting.executeScript({ func, args })` — a single
   self-contained function that runs inside the page's isolated world.
   No declarative content scripts, no dynamic-import loader stubs, no
   load-order races.
5. The scraper uses `MutationObserver` + interval polling to wait for
   the apply form to render, then extracts:
   - The form's `action` URL → apply endpoint
   - Method, enctype, and all hidden + visible inputs
   - File-input fields, separately (`looksLikeResume` heuristics)
   - CSRF token from `_token` / `csrf_token` / `<meta name="csrf-token">`
   - The job ID from named fields, `data-*` attributes, or the URL slug
6. The orchestrator picks the cover-letter slot (textarea-first heuristic,
   falls back to name-hint matching), overwrites it with your text or a
   bundled default, attaches the resume as a `Blob` in multipart
   `FormData`, and `fetch`es the apply endpoint with
   `credentials: 'include'`, `X-CSRF-TOKEN` headers, and an
   `AbortController`-driven timeout.
7. The popup renders the outcome — endpoint, HTTP status, redacted
   payload preview, response snippet, and structured logs.
8. The background tab is **always** closed in a `finally` block, even on
   error or user cancellation.

---

## Features

- **Session badge** — Logged In / Not Logged In / Unknown, with refresh.
- **URL input** — live validation against `brightermonday.co.ke`,
  slug detection.
- **Resume upload** — PDF / DOC / DOCX / TXT / RTF, up to 10 MB. Read
  with `FileReader.readAsDataURL`, base64-shipped popup→background via
  `chrome.runtime.sendMessage`, reconstructed as a `Blob` in the
  service worker and attached to multipart `FormData`.
- **Cover letter editor** — 5-row textarea with character counter and
  "Use generic" pre-fill. If left blank, a bundled
  `DEFAULT_COVER_LETTER` is used. The orchestrator picks the target
  textarea heuristically (single-textarea → use it; multiple → hint
  match; no textarea → exact-then-substring match on inputs; otherwise
  appends an explicit `description` field as a safety net).
- **Apply / Cancel** — Cancel aborts the in-flight fetch and closes
  the background tab via `AbortController`.
- **Result panel** — endpoint, HTTP status, duration, redacted payload
  preview (sensitive fields masked, resume shown as
  `<file: name (mime, bytes)>`), response snippet.
- **Structured logs** — every step from session check to submission,
  with inline context (e.g. which cover-letter field was picked, what
  the alternatives were). Helpful for diagnosing form changes.
- **Popover → window fallback** — Chrome's action popup closes the
  instant focus leaves it, killing native file pickers. The popup
  detects this, persists state in `chrome.storage.session`, and
  re-launches itself as a real `chrome.windows.create` popup window
  via the **"Pop out ↗"** button or automatically when you click the
  resume picker.

---

## Tech stack

- **TypeScript 5.6** (strict mode: `noUnusedLocals`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `noImplicitOverride`)
- **React 18** + **Vite 5** for the popup
- **TailwindCSS 3** for styling
- **Zustand** for popup state
- **Manifest V3** via `@crxjs/vite-plugin`
- **ESLint** + **Prettier**

---

## Project layout

```
bright-apply/
├── index.html                  # popup entry
├── commit.md                   # commit-by-commit history of the project
├── src/
│   ├── manifest.ts             # MV3 manifest (typed); no content_scripts
│   ├── background/             # service worker
│   │   ├── index.ts            # message router
│   │   ├── orchestrator.ts     # the full apply pipeline
│   │   ├── session.ts          # cookie-based login detection
│   │   ├── tabManager.ts       # open / wait-complete / close
│   │   └── inPageScraper.ts    # self-contained scraper injected via
│   │                           # chrome.scripting.executeScript
│   ├── popup/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── store.ts            # zustand store
│   │   ├── popupMode.ts        # popover vs windowed detection +
│   │   │                       # openInWindow(state)
│   │   ├── index.css           # Tailwind entry
│   │   └── components/
│   │       ├── StatusBadge.tsx
│   │       ├── JobUrlInput.tsx
│   │       ├── ResumePicker.tsx
│   │       ├── CoverLetterEditor.tsx
│   │       ├── ApplyButton.tsx
│   │       ├── ResultPanel.tsx
│   │       ├── LogsView.tsx
│   │       └── Spinner.tsx
│   └── shared/
│       ├── constants.ts        # TIMEOUTS, hints, default cover letter
│       ├── errors.ts           # BrightApplyError + stable error codes
│       ├── logger.ts           # structured logger
│       ├── messages.ts         # popup ⇄ background protocol
│       ├── redact.ts           # sensitive-field redaction
│       ├── sessionState.ts     # chrome.storage.session persistence
│       │                       # across popover→window transition
│       ├── fileEncoding.ts     # File ↔ base64 ↔ Blob
│       ├── timeout.ts          # withTimeout + AbortController
│       ├── types.ts
│       └── url.ts              # validation + host gating
└── (config: package.json, tsconfig.json, vite.config.ts, tailwind/postcss/eslint/prettier)
```

---

## Building & running

Requirements: Node 18+.

```bash
npm install
npm run build      # outputs unpacked extension to ./dist
```

Load it in Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and choose this project's `dist/` folder.
4. Pin **BrightApply** to your toolbar.

To use it:

1. Log into [brightermonday.co.ke](https://www.brightermonday.co.ke/login) in another tab.
2. Click the BrightApply icon. The badge should read **Logged In**.
3. Paste a job URL.
4. (Optional) Click **Pop out ↗** if you want to attach a resume — this
   opens the popup as a real window so the file picker won't dismiss it.
5. (Optional) Attach a resume and tweak the cover letter.
6. Click **Apply**.

For iterative development with HMR for the popup:

```bash
npm run dev        # serves the popup
```

Reload the extension at `chrome://extensions` after changes to the
background service worker.

Other scripts:

```bash
npm run lint
npm run typecheck
npm run format
```

---

## Security model

| Concern                    | Mitigation                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credentials                | Never requested. Never stored. Never typed.                                                                                                                             |
| Cookies                    | Read **only** via `chrome.cookies.getAll` to check *presence* of session-style cookie names. Values are never exposed to the popup or persisted.                        |
| Domain scope               | All operations gated to `brightermonday.co.ke`. Manifest `host_permissions` + runtime `isAllowedHost` checks in popup and background. The scraper itself bails on a non-allowed host. |
| CSRF / XSRF                | Tokens are read from the live DOM (`_token`, `<meta name="csrf-token">`, etc.) and forwarded as `X-CSRF-TOKEN` / `X-XSRF-TOKEN` headers. Never persisted.               |
| Sensitive field display    | `redact.ts` masks any field whose name contains `password`, `token`, `csrf`, `auth`, `session`, etc. before the payload is shown in the popup.                          |
| Resume bytes               | Live in popup memory only for the duration of the apply request, plus a session-only `chrome.storage.session` snapshot to survive the popover→window transition.       |
| Abort / cleanup            | Every async stage uses `AbortController` + a timeout; the background tab is closed in `finally`.                                                                       |
| Cancellation               | The popup can cancel an in-flight apply — the orchestrator aborts the fetch and closes the tab.                                                                        |
| Scraper boundary           | Injected per-request, runs in the isolated world, communicates only via its return value (no listener left behind, no message channel kept open).                       |

---

## Error codes

`BrightApplyError` codes returned in `ApplyOutcome.failure.code`:

| Code                       | Meaning                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `INVALID_URL`              | Job URL didn't parse or used a non-https scheme.                                         |
| `DOMAIN_NOT_ALLOWED`       | URL hostname isn't a `brightermonday.co.ke` host.                                        |
| `NOT_LOGGED_IN`            | No session-style cookies present.                                                        |
| `TAB_OPEN_FAILED`          | `chrome.tabs.create` rejected or returned without an id.                                 |
| `TAB_LOAD_TIMEOUT`         | Background tab didn't reach `complete` in time.                                          |
| `CONTENT_SCRIPT_UNREACHABLE` | `chrome.scripting.executeScript` failed or returned no result (page navigated away).   |
| `FORM_NOT_FOUND`           | Scraper couldn't locate an apply form on the page.                                       |
| `FORM_SCRAPE_TIMEOUT`      | Form didn't render within `formScrapeMs`.                                                |
| `SUBMIT_FAILED`            | `fetch` to the apply endpoint threw before getting a response.                           |
| `SUBMIT_TIMEOUT`           | The submission exceeded `fetchMs`.                                                       |
| `SUBMIT_REJECTED`          | Endpoint returned non-2xx, or 2xx but the response body / redirect looked like a login wall. |
| `ABORTED`                  | User clicked Cancel, or the popup-side timeout fired.                                    |
| `UNEXPECTED`               | Catch-all.                                                                               |

---

## Caveats

- The scraper uses generic heuristics for finding the apply form, CSRF
  token, and cover-letter field. If BrighterMonday changes their markup,
  the popup will surface a `FORM_NOT_FOUND` or `CSRF_TOKEN_NOT_FOUND`
  error code — open the **Logs** panel and the structured context will
  tell you exactly which stage failed.
- The cover-letter picker is textarea-first; if BrighterMonday adds a
  second textarea to the apply form for an unrelated purpose, you may
  want to tighten `COVER_LETTER_FIELD_HINTS` in
  [src/shared/constants.ts](src/shared/constants.ts).
- Required file fields with no resume attached are surfaced as a
  `SUBMIT_REJECTED` with a helpful message instead of being submitted
  empty.

---

## License

MIT.

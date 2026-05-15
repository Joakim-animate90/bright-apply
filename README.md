# BrightApply

A production-grade Manifest V3 Chrome Extension that lets a logged-in
BrighterMonday user paste a job URL and apply in **one click**.

The extension never sees your password, never stores tokens, and never
exfiltrates cookies. It works exclusively by piggy-backing on your existing
authenticated browser session.

---

## How it works

1. You paste a `https://www.brightermonday.co.ke/...` job URL into the popup.
2. The background service worker checks `chrome.cookies` for an active
   BrighterMonday session.
3. It opens the job URL in an **inactive background tab**.
4. A content script attaches, waits for the apply form to render
   (`MutationObserver` + polling for React-rendered pages), and extracts:
   - The form's `action` URL → apply endpoint
   - The HTTP method and enctype
   - All hidden + visible inputs (file inputs are skipped — cannot be streamed)
   - CSRF token from `_token` / `csrf_token` / `<meta name="csrf-token">`
   - The job ID from named inputs, `data-*` attributes, or the URL slug
5. The background worker `fetch`es the apply endpoint with
   `credentials: 'include'`, adding `X-CSRF-TOKEN` headers, and submits the
   payload. All requests have an `AbortController`-driven timeout.
6. The popup renders the outcome — endpoint, HTTP status, redacted payload
   preview, response snippet, and structured logs.
7. The background tab is **always** closed inside `finally`, even on error or
   cancellation.

---

## Tech stack

- **TypeScript 5.6** (strict mode, `noUnusedLocals`, `noImplicitReturns`)
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
├── src/
│   ├── manifest.ts             # MV3 manifest (typed)
│   ├── background/             # service worker
│   │   ├── index.ts
│   │   ├── orchestrator.ts     # the full apply pipeline
│   │   ├── session.ts          # cookie-based login detection
│   │   └── tabManager.ts       # open / wait / close background tabs
│   ├── content/                # only runs on brightermonday.co.ke
│   │   ├── index.ts
│   │   ├── scraper.ts          # apply-form scraper
│   │   └── waiter.ts           # MutationObserver + poll
│   ├── popup/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── store.ts            # zustand
│   │   ├── index.css           # Tailwind entry
│   │   └── components/
│   └── shared/
│       ├── constants.ts
│       ├── errors.ts           # typed error codes
│       ├── logger.ts           # structured logger
│       ├── messages.ts         # popup⇄bg⇄content protocol
│       ├── redact.ts           # sensitive-field redaction
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

To load it in Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked** and choose this project's `dist/` folder.
4. Pin **BrightApply** to your toolbar.

For iterative development with HMR for the popup:

```bash
npm run dev        # serves the popup; reload the extension to pick up SW/content changes
```

Other scripts:

```bash
npm run lint
npm run typecheck
npm run format
```

---

## Security model

| Concern                | Mitigation                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| Credentials            | Never requested. Never stored. Never typed.                                                 |
| Cookies                | Read **only** via `chrome.cookies.getAll` to check *presence* of session-style cookies. Values are never exposed to the popup or persisted. |
| Domain scope           | All operations gated to `brightermonday.co.ke`. Manifest `host_permissions` + runtime `isAllowedHost` checks in popup, background, and content. |
| CSRF / XSRF            | Tokens are read from the live DOM (`_token`, `<meta name="csrf-token">`, etc.) and forwarded as request headers — never persisted. |
| Sensitive field display| `redact.ts` masks any field whose name contains `password`, `token`, `csrf`, `auth`, etc., before the payload is shown in the popup. |
| Abort / cleanup        | Every async stage uses `AbortController` + a timeout; the background tab is closed in `finally`. |
| Cancellation           | The popup can cancel an in-flight apply — the orchestrator aborts the fetch and closes the tab. |
| Content script trust   | The content script bails out if it ever finds itself on a non-allowed host.                 |

---

## Caveats

- **File uploads** (e.g. resume attachments) are intentionally not supported
  from the hidden-tab apply flow — you cannot stream a user-selected file from
  a tab the user never interacted with. If the apply form has a `required`
  file input you must visit the job page directly.
- The scraper uses generic heuristics for finding apply forms / CSRF tokens.
  If BrighterMonday changes their markup, expect the popup to surface a
  `FORM_NOT_FOUND` or `CSRF_TOKEN_NOT_FOUND` error code — the structured logs
  in the popup will tell you exactly which stage failed.

---

## License

MIT.

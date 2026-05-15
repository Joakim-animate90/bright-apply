# Commits

This file documents the commit history of BrightApply. Each commit
represents one self-contained step in the project's development.

| # | Subject | Summary |
|---|---------|---------|
| 1 | `feat: scaffold BrightApply MV3 extension with one-click apply pipeline` | Project scaffold, configs, popup, background, declarative content script. |
| 2 | `feat: support resume uploads from the popup` | File picker + base64 messaging + multipart submission. |
| 3 | `fix: keep popup alive during file picker via windowed-mode fallback` | Chrome closes the action popover when the file dialog opens; re-launches as a `chrome.windows.create` popup. |
| 4 | `refactor: replace declarative content script with chrome.scripting.executeScript` | Removes content-script load-order races by injecting a self-contained scraper on demand. |
| 5 | `feat: add optional cover letter with bundled default` | CoverLetterEditor + automatic field detection + sensible default text. |
| 6 | `fix: prefer textareas for cover letter field detection + log diagnostics` | Avoids picking hidden marker fields like `cover_letter_provided`; surfaces context in the popup log view. |

## Commit 1 — scaffold and apply pipeline

* TypeScript strict mode, React 18, Vite 5, Tailwind 3, Zustand, MV3 via `@crxjs/vite-plugin`.
* Popup: session badge, URL input with validation, Apply/Cancel buttons, logs panel.
* Background service worker: orchestrator, cookie-based session check, tab open/wait/close.
* Content script: MutationObserver-based form scraping (CSRF tokens, hidden inputs, job ID).
* Shared: typed `BrightApplyError`, structured logger, AbortController-driven timeouts, redaction of sensitive fields in payload preview.

## Commit 2 — resume uploads

* New `ResumePicker` component with size/MIME validation (10 MB cap; PDF/DOC/DOCX/TXT/RTF).
* `fileEncoding.ts` converts a `File` → base64 `ResumeAttachment` for messaging, and back to a `Blob` in the service worker.
* Scraper now reports file fields separately; multipart `FormData` is built when a resume is attached.
* Orchestrator picks the target file-input by `looksLikeResume` hint, falls back to the first file field.

## Commit 3 — popover → window fallback

* Chrome closes the action popover when focus leaves it, killing the file dialog.
* New `popupMode.ts` detects `?windowed=1`; `openInWindow()` spawns a real popup window via `chrome.windows.create` and dismisses the popover.
* `sessionState.ts` persists transient state across the transition using `chrome.storage.session`.
* Manual "Pop out ↗" button + automatic redirect when clicking the resume picker in popover mode.

## Commit 4 — chrome.scripting.executeScript refactor

* Removes the declarative `content_scripts` entry and the `src/content/` folder.
* New `inPageScraper.ts` is a self-contained `async function` injected per request via `chrome.scripting.executeScript({ func, args })`. No closures, no imports, no load-order races.
* Drops obsolete message types (`PING_CONTENT`, `SCRAPE_APPLY_FORM`) and the `sendToTab` helper.
* Drops `waitForContentScript` from `tabManager.ts`.

## Commit 5 — cover letter editor

* New `CoverLetterEditor` component with character counter and "Use generic" pre-fill.
* `DEFAULT_COVER_LETTER` ships a role-agnostic professional letter used when the textarea is blank.
* Orchestrator detects a matching field via `COVER_LETTER_FIELD_HINTS` and overwrites its value before submission.
* `coverLetter` is carried in `ApplyToJobRequest` and `PopupSessionState` (so it survives the pop-out transition).

## Commit 6 — picker fix and diagnostics

* The previous picker's substring matching could land the cover letter into a hidden marker field (e.g. `cover_letter_provided`), leaving the real `<textarea name="description">` empty.
* New `pickCoverLetterFieldName` strongly prefers `<textarea>` (a single textarea wins regardless of name), then exact-name matches, then substring matches.
* Hint order now starts with `description` — BrighterMonday's exact API key.
* Added fallback that appends an explicit `description` field if no cover-letter field is detected.
* `LogsView` renders each entry's context object inline (was tooltip-only) so the picker's decision is debuggable from the popup.


# GroundedTheory Frontend

This frontend is a Vite + React + TypeScript app using TipTap + Yjs for collaborative editing.

## Local collaboration modes

The app supports two collaboration transports:

- **WebSocket mode** (default when enabled): Yjs updates and presence go through the backend `/ws`.
- **Local mode** (when WS is disabled): collaboration runs **between browser tabs** using `BroadcastChannel` + `localStorage`.

The mode is controlled by:

- `VITE_DISABLE_WS=true` → local mode (no backend WS)
- `VITE_DISABLE_WS=false` → WS mode

### Production configuration

By default the frontend assumes the backend is served from the **same origin** as the frontend.

If your production backend is on a different origin (e.g. `api.example.com`), set:

- `VITE_API_BASE=https://api.example.com`

If WebSockets are on a different base than the API, set:

- `VITE_WS_BASE=https://api.example.com`

Repository defaults:

- [frontend/.env](frontend/.env) defaults to `VITE_DISABLE_WS=false` (production-friendly)
- [frontend/.env.development](frontend/.env.development) sets `VITE_DISABLE_WS=true` for local dev

## Debug logging

Most high-signal logs are gated behind a localStorage flag.

Enable:

- In browser console: `localStorage.setItem('gt-debug','true'); location.reload();`

Disable:

- In browser console: `localStorage.removeItem('gt-debug'); location.reload();`

### Useful log prefixes

- `[DocEditor] ...` → TipTap editor updates + seeding decisions
- `[Project] ...` → React project state updates (document html/text patches)
- `[Autosave] ...` → autosave decisions and skips
- `[Project Save] ...` → backend persistence request/response
- `[Presence][local] ...` → local presence transport (WS disabled)
- `[Yjs][local] ...` → local Yjs BroadcastChannel sync and leader election (WS disabled)

## Known issues we fixed (and what to check if they return)

### 1) React error: “Cannot access refs during render”

**Symptom**
- Build/runtime error in `CollaborationLayer`.

**Cause**
- Reading `ref.current` during render for remote cursor/selection overlays.

**Fix**
- `CollaborationLayer` uses a state snapshot of editor instances updated from effects, instead of reading refs directly during render.

### 2) Document body not persisting / disappearing on refresh (while titles persisted)

**Symptom**
- Document titles saved, but the document body reset/vanished on refresh.

**Cause (typical chain)**
- TipTap content lives in Yjs fragments.
- If seeding/hydration gates never open (e.g. “sync received” was never reached in a given mode), the editor body wouldn’t seed/hydrate as expected.

**What to check**
- You should see this sequence when typing:
	- `[DocEditor] update` (TipTap emits html/text)
	- `[Project] updateDocument` (state receives html/text)
	- `[Autosave] persist ...` (or a clear skip reason)
	- `[Project Save] response ...` (backend result)

### 3) Duplicated text when opening multiple tabs on the same project (WS disabled)

**Symptom**
- Tab 1 shows `hej`.
- Tab 2 shows:
	- `hej`
	- `hej`
- Tab 3 shows 3 copies, etc.

**Root cause**
- In local mode, if a newly opened tab seeds `initialHtml` into Yjs **before** it receives the existing Yjs state from another tab, Yjs merges both inserts.
- In development, React `StrictMode` mounts/unmounts effects twice, which can amplify timing races if we clear leadership/sync state during cleanup.

**Fix**
- Local mode uses a per-project leader lock (`localStorage` key `gt-yjs-leader:${projectId}`) so only one tab is allowed to seed initial content.
- Followers wait for BroadcastChannel `yjs:sync`/`yjs:update`.
- The leader key is intentionally not removed during effect cleanup (StrictMode-safe); leadership relies on staleness/heartbeat.

**Logs to look for**
- `[Yjs][local] leader-check` → which tab is leader
- `[Yjs][local] recv sync` / `recv update`
- `[DocEditor] seeding setContent` → should generally happen only once per document when there is no prior Yjs state

### 4) Duplicated projects editing each other (cross-project text leakage)

**Symptom**
- After duplicating a project, editing the original affected the duplicate.

**Root cause**
- A single in-memory `Y.Doc` was reused across project switches, so Yjs state could bleed between projects.

**Fix**
- The Yjs document instance is scoped to `projectId` (new `Y.Doc` per project) and old instances are destroyed.

## React StrictMode note

`React.StrictMode` is enabled in development (see `src/main.tsx`). This is helpful, but it intentionally double-invokes certain lifecycles/effects in dev to surface unsafe patterns.

If you see a bug that happens only in dev but not in prod, check whether it’s due to StrictMode timing and make side-effect logic idempotent.


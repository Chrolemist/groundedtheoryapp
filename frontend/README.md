
# Grounded Theory App (Frontend)

## Local development

- Install deps: `npm install`
- Run dev server: `npm run dev`
- Build: `npm run build`

### WebSocket vs local mode

The app supports two collaboration modes:

- **WebSocket mode (prod-like):** `VITE_DISABLE_WS=false`
  - Frontend connects to `/ws` and receives `hello`, `presence:update`, `yjs:sync`, `yjs:update`.
- **Local mode:** `VITE_DISABLE_WS=true`
  - Collaboration/presence uses `BroadcastChannel` + `localStorage` heartbeats (no backend WS).

By default, local dev typically uses `VITE_DISABLE_WS=true` via `.env.development`.

## Debugging switches

Runtime toggles (browser console):

- Enable debug logs: `localStorage.setItem('gt-debug', 'true')`
- Disable debug logs: `localStorage.removeItem('gt-debug')`

Other toggles used during troubleshooting:

- Disable WS at runtime: `localStorage.setItem('gt-disable-ws', 'true')`
- Isolation mode: `localStorage.setItem('gt-isolation', 'true')`
- Plain editor (no Yjs/Collab): `localStorage.setItem('gt-plain-editor', 'true')`
- Hide sidebar: `localStorage.setItem('gt-hide-sidebar', 'true')`

Remove any of them with `localStorage.removeItem('<key>')`.

## Postmortem: “saved in wrong project / only first document saves”

### What the problem ultimately was

Symptoms we observed:

- Text sometimes disappeared after close/reopen even though the backend save returned `200`.
- After switching projects/documents, edits could end up saved into the *previous* project/document.
- In some cases a “new” document appeared (similar to pressing “Create document”), and titles could look like they were taken from the project name.

Root cause:

- **Stale WebSocket reconnect race:** when the shared WS disconnected, a reconnect was scheduled using an *old* URL (captured in a closure). If you switched project while reconnect was pending, the app could reconnect to the previous project and still deliver `hello` / `yjs:*` messages.
- **No reliable project identity on messages:** the client had no `project_id` on WS payloads, so it could not safely ignore late/stale messages that belonged to a different project.
- **Stale editor instance snapshotting:** manual save snapshots TipTap editor instances from a map keyed by document id. When switching projects, stale editor instances from the previous project could still exist and be snapshotted into the next save.

### How we prevent it now

Guardrails added to stop the bug class (race + cross-project bleed):

1. **Backend includes `project_id` in WS messages**
	- `hello`, `yjs:sync`, and broadcasts now include `project_id`.

2. **Frontend ignores WS/Yjs messages for the wrong project**
	- Presence/project updates and Yjs updates are ignored when `payload.project_id !== currentProjectId`.

3. **Reconnect always targets the latest active URL**
	- Reconnect uses the current `sharedUrl`, not a stale URL captured when the socket was created.
	- If an active socket is connected to the wrong URL, it is closed and replaced.

4. **Clear editor instance caches on project switch**
	- TipTap editor instance maps are cleared when `projectId` changes to prevent saving from stale editors.

### How to avoid regressions

- Treat **project identity** as part of the protocol: keep `project_id` on all messages that can mutate state.
- When using a **shared singleton WS** with reconnect timers, ensure reconnect logic is always keyed to the *current* connection target.
- On project switch/close, reset state that can “leak” across projects (presence, cursors, editor instance maps, pending timers).
- When investigating: enable `gt-debug` and verify that the WS URL `project_id=...` always matches the currently active project.


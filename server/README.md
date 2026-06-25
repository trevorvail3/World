# `server/` — the future friends-server (stub)

This folder is a **placeholder** for the multiplayer server we can add later.
There is **no running server here yet** — just `serverStub.ts`, which documents
exactly how it would slot in.

## Why it can be added without a rewrite

The whole game is split so this is possible:

- **`src/core`** is a *pure* rules engine. It never reads the clock or rolls
  dice on its own — it receives time and randomness through a `ctx` argument.
  Feed every player the same `ctx` and they compute the same world.
- The client only ever talks to the core by **sending intents** and
  **reading back state + events**. It never edits the world directly.

So a server just needs to:

1. Become the **single source of truth**: it owns one `WorldState` created from
   the same `src/content` data.
2. Use a **seeded RNG** (see `makeSeededRng` in `serverStub.ts`) so random
   outcomes are identical for everyone.
3. **Receive intents** from each connected friend (`applyIntent`), run a fixed
   **server tick** (`tick`), and **broadcast** the resulting state/events.

The client's `CoreBridge` (in `src/client/loop.ts`) is the seam: today
`src/main.ts` fills it with a local core; tomorrow a networked build fills it
with a socket connection to this server. **The core and client don't change.**

## Likely next steps when we build it for real

- Add a small WebSocket layer (e.g. `ws`) around `AuthoritativeWorld`.
- Give each player their own `Player` inside the world (the core's `Player`
  type would become a `players` map).
- Send periodic snapshots + event streams; reconcile on the client.

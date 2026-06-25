# Varath World

A 2D, top-down, tile-based world game with an old-school RuneScape feel:
tap the ground to walk, tap things to interact. Mobile-first, single-player
for now — but built so a play-with-friends server can be added later
**without a rewrite**.

This repository (**World**) holds Varath World only. It is intentionally kept
separate from any other project.

---

## The first playable slice

A small hand-made zone, **The Knuckle Hills**:

- An avatar that walks tile-to-tile with **A\*** pathfinding (8-directional,
  no cutting through wall corners), smooth movement, and a camera that follows.
- **Tap the ground** to walk there. **Tap an object** to walk next to it and
  then perform the action.
- Things to do, all routed through the rules engine:
  - **Trees** → Forestry XP + _Ashwood Log_; the tree depletes, then respawns.
  - **Rocks** → Mining XP + _Knucklestone Ore_; depletes, then respawns.
  - **Fishing spots** in the pond → Fishing XP + _Ashfin_ (chance-based).
  - **Aldric** the NPC → opens a short dialogue box.
  - **Knuckle Boar** → timed combat; drops _Boar Hide_ and _Worn Coin_ and
    respawns. You have HP and respawn if you’re knocked out.
- A RuneScape-style **XP curve**, per-skill levels (Forestry, Mining, Fishing,
  Combat), a **28-slot inventory**, an OSRS-style **game log**, and live skill
  readouts on screen.

---

## The three rules (please don’t break these)

These three rules are what make a multiplayer server possible later. Everything
is organised around them.

1. **The core is pure.** No DOM, no `Date.now()`, no `Math.random()` anywhere in
   `src/core`. Time and randomness are passed in via a `ctx = { now, rng }`
   argument. This makes the game logic deterministic — the same inputs always
   produce the same result, which is exactly what a server needs.

2. **The client never changes game state directly.** It sends **intents**
   (e.g. `{ type: 'INTERACT', objId }`) to the core, then renders the core’s
   state plus the **events** the core returns. All change flows through
   `applyIntent` and `tick`.

3. **Content is data, and lives only in `src/content`.** The map, items, the XP
   curve, skills and spawns are plain data. Player state is kept separate from
   content.

---

## Project layout

```
src/
  content/   game DATA — xp curve, items, skills, the map, spawns
  core/      pure game logic — types.ts, worldCore.ts  (RULE 1)
  client/    presentation only — pathfinding, render, hud, dialogue, the loop
  main.ts    wires a LOCAL core to the client (the swap-point for multiplayer)
server/      a documented STUB for the future friends-server
```

The client talks to the core through one small seam, the **`CoreBridge`** in
`src/client/loop.ts`. Today `src/main.ts` fills it with a local core. A future
multiplayer build would fill the same seam with a network connection to the
`server/` — without touching the core or the client. See `server/README.md`.

---

## How to run it

You’ll need **Node.js** (v18 or newer). Then, from this folder:

```bash
npm install      # download the tools (one time)
npm run dev      # start the game; open the printed http://localhost:5173 link
```

Open that link in a browser (or on your phone, using the network URL it prints)
and tap around The Knuckle Hills.

### Other commands

```bash
npm run typecheck   # check the TypeScript types — should report zero errors
npm run build       # type-check then produce an optimised /dist folder
npm run preview     # serve the built /dist locally to test it
```

---

## A note for non-coders

If you only ever want to *see it run*: install Node, then run `npm install`
once, and `npm run dev` whenever you want to play. The terminal prints a link —
click it. To stop the game, press `Ctrl + C` in the terminal.

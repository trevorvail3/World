/**
 * server/serverStub.ts
 * --------------------
 * A DOCUMENTED STUB for the future "play with friends" server. Nothing here
 * runs yet — it exists to prove (and protect) the seam that makes multiplayer
 * possible without a rewrite. See server/README.md for the full plan.
 *
 * The key idea: the server would import the EXACT SAME pure core the client
 * uses (src/core), make itself the single source of truth for the world, and
 * exchange the EXACT SAME intents and events over the network. Because the
 * core is pure (RULE 1), feeding every connected player the same time and the
 * same seeded random numbers makes everyone see an identical world.
 */

import { content } from "../src/content/index.ts";
import { playerStart } from "../src/content/index.ts";
import type { Ctx, Intent, WorldEvent } from "../src/core/types.ts";
import { applyIntent, createWorld, tick } from "../src/core/worldCore.ts";

/**
 * A tiny seeded RNG (mulberry32). On a real server you'd seed this once so
 * that every client, replaying the same intents, computes the same outcomes.
 * This is exactly why the core forbids Math.random(): randomness must be
 * controllable and shared, not ambient.
 */
export function makeSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * What an authoritative server session might look like. This is illustrative
 * pseudo-wiring, not a running server — there is no socket code here on
 * purpose, so the stub has zero runtime dependencies.
 */
export class AuthoritativeWorld {
  private rng: () => number;
  private state;

  constructor(seed: number, startTimeMs: number) {
    this.rng = makeSeededRng(seed);
    this.state = createWorld(content, playerStart, this.ctx(startTimeMs));
  }

  private ctx(nowMs: number): Ctx {
    // A server tick is authoritative wall-clock time, so epoch tracks `now`.
    return { now: nowMs, rng: this.rng, epoch: nowMs };
  }

  /** A client sent us an intent; apply it and return events to broadcast. */
  receiveIntent(intent: Intent, nowMs: number): WorldEvent[] {
    return applyIntent(this.state, content, intent, this.ctx(nowMs));
  }

  /** The server's fixed-step clock; events would be broadcast to all clients. */
  step(nowMs: number): WorldEvent[] {
    return tick(this.state, content, this.ctx(nowMs));
  }

  /** A full snapshot a newly-connected client would receive. */
  snapshot() {
    return this.state;
  }
}

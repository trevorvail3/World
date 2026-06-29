/**
 * src/client/trade.ts
 * -------------------
 * Client API for live, face-to-face player trading. A `trades` row is the
 * rendezvous between two players; every change goes through atomic Postgres
 * functions (rpc) so the two clients can only touch their own side and an
 * accept can't slip through after the offer changed.
 *
 * Items and gold live in each player's own save (the same trust model as the
 * Grand Exchange), so the row never holds goods — when both sides confirm, each
 * client applies its own half of the swap via the TRADE_APPLY intent.
 */

import type { ItemId } from "../core/types.ts";
import { currentUser, rest } from "./supabase.ts";

export interface TradeItem { item: ItemId; qty: number }
export interface TradeSide { items: TradeItem[]; gold: number; ok: boolean }
export type TradeStatus = "offered" | "active" | "settled" | "cancelled";

export interface TradeRow {
  id: number;
  status: TradeStatus;
  rev: number;
  /** true if I'm the player who sent the request (side A). */
  iAmA: boolean;
  /** true if I'm the one being asked (only meaningful while `offered`). */
  iAmAsked: boolean;
  partnerName: string;
  mine: TradeSide;
  theirs: TradeSide;
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await rest(`rpc/${fn}`, { method: "POST", body: args });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(humanise(msg) || `Trade error (${res.status})`);
  }
  return res.json().catch(() => null);
}

function humanise(body: string): string {
  try {
    const m = String(JSON.parse(body).message ?? "");
    if (/already trading/i.test(m)) return "One of you is already in a trade.";
    if (/not signed in/i.test(m)) return "Sign in to trade.";
    if (/yourself/i.test(m)) return "You can't trade with yourself.";
    return m;
  } catch { return ""; }
}

function parseItems(v: unknown): TradeItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => ({ item: String((x as TradeItem).item) as ItemId, qty: Math.floor(Number((x as TradeItem).qty)) }))
    .filter((x) => x.item && x.qty > 0);
}

/** The one trade I'm currently involved in (offered/active/settled), or null. */
export async function currentTrade(): Promise<TradeRow | null> {
  const me = currentUser();
  if (!me) return null;
  const res = await rest(
    `trades?select=*&or=(a_user.eq.${me.id},b_user.eq.${me.id})&status=in.(offered,active,settled)&order=updated_at.desc&limit=1`,
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows) || !rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  const iAmA = r["a_user"] === me.id;
  const sideA: TradeSide = { items: parseItems(r["a_items"]), gold: Number(r["a_gold"]) || 0, ok: !!r["a_ok"] };
  const sideB: TradeSide = { items: parseItems(r["b_items"]), gold: Number(r["b_gold"]) || 0, ok: !!r["b_ok"] };
  return {
    id: Number(r["id"]),
    status: r["status"] as TradeStatus,
    rev: Number(r["rev"]) || 0,
    iAmA,
    iAmAsked: !iAmA && r["status"] === "offered",
    partnerName: String((iAmA ? r["b_name"] : r["a_name"]) || "Wanderer"),
    mine: iAmA ? sideA : sideB,
    theirs: iAmA ? sideB : sideA,
  };
}

/** Ask another player to trade. Returns the new trade id. */
export async function requestTrade(toId: string, myName: string, theirName: string): Promise<number> {
  return Number(await rpc("trade_request", { p_to: toId, p_my_name: myName, p_their_name: theirName }));
}

/** The asked player accepts (opens the window) or declines. */
export const respondTrade = (id: number, accept: boolean): Promise<unknown> =>
  rpc("trade_respond", { p_id: id, p_accept: accept });

/** Replace my side's offer (items + gold). Bumps the revision; clears both accepts. */
export const setOffer = (id: number, items: TradeItem[], gold: number): Promise<unknown> =>
  rpc("trade_offer", { p_id: id, p_items: items, p_gold: gold });

/** Mark my side accepted — but only against the revision I'm looking at. */
export const confirmTrade = (id: number, rev: number): Promise<unknown> =>
  rpc("trade_confirm", { p_id: id, p_rev: rev });

/** Back out (either side, any time before it settles). */
export const cancelTrade = (id: number): Promise<unknown> => rpc("trade_cancel", { p_id: id });

/** Tell the server I've applied a settled swap (lets it retire the row). */
export const ackTrade = (id: number): Promise<unknown> => rpc("trade_ack", { p_id: id });

/**
 * src/client/exchange.ts
 * ----------------------
 * Client API for the Grand Exchange. Reads go straight to PostgREST (the public
 * order book + your private balances under RLS); writes go through the atomic
 * Postgres functions (rpc) so trades settle in a single transaction — no dupes,
 * no half-fills, even when the other party is offline.
 *
 * The Exchange holds escrowed gold/items server-side. The caller pairs each
 * deposit/withdraw with a GE_MOVE intent so the character's pack stays in sync.
 */

import type { ItemId } from "../core/types.ts";
import { currentUser, rest } from "./supabase.ts";

export interface GeItem { item: ItemId; qty: number }
export interface GeOrder {
  id: number;
  side: "buy" | "sell";
  item: ItemId;
  qty: number;
  filled: number;
  price: number;
  status: string;
  created_at: string;
}
export interface GeTrade { qty: number; price: number; at: string }
export interface GeQuote { bid: number | null; ask: number | null; last: number | null }

async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await rest(`rpc/${fn}`, { method: "POST", body: args });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(humanise(msg) || `Exchange error (${res.status})`);
  }
  return res.json().catch(() => null);
}

/** Pull a readable message out of a PostgREST/Postgres error blob. */
function humanise(body: string): string {
  try {
    const j = JSON.parse(body);
    const m = String(j.message ?? j.hint ?? "");
    if (/insufficient gold/i.test(m)) return "Not enough Exchange gold.";
    if (/insufficient items/i.test(m)) return "Not enough of that item in the Exchange.";
    if (/not signed in/i.test(m)) return "Sign in to use the Exchange.";
    return m;
  } catch { return ""; }
}

async function get(query: string): Promise<unknown[]> {
  const res = await rest(query);
  if (!res.ok) throw new Error(`Exchange read failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Your escrowed gold balance. */
export async function wallet(): Promise<number> {
  const rows = await get("ge_wallet?select=gold");
  const r = rows[0] as { gold?: number } | undefined;
  return r?.gold ?? 0;
}

/** Items sitting in your Exchange account (proceeds of sales + deposits). */
export async function items(): Promise<GeItem[]> {
  const rows = await get("ge_items?select=item,qty&qty=gt.0&order=item.asc");
  return rows.map((r) => r as GeItem);
}

/** Your live (open) offers. */
export async function myOrders(): Promise<GeOrder[]> {
  const u = currentUser();
  if (!u) return [];
  const rows = await get(
    `ge_orders?select=*&user_id=eq.${u.id}&status=eq.open&order=created_at.desc`,
  );
  return rows.map((r) => r as GeOrder);
}

/** Best bid, best ask and last traded price for an item — the price guide. */
export async function quote(item: ItemId): Promise<GeQuote> {
  const enc = encodeURIComponent(item);
  const [bids, asks, last] = await Promise.all([
    get(`ge_orders?select=price&item=eq.${enc}&side=eq.buy&status=eq.open&order=price.desc&limit=1`),
    get(`ge_orders?select=price&item=eq.${enc}&side=eq.sell&status=eq.open&order=price.asc&limit=1`),
    get(`ge_trades?select=price&item=eq.${enc}&order=at.desc&limit=1`),
  ]);
  const px = (a: unknown[]): number | null =>
    a.length ? Number((a[0] as { price: number }).price) : null;
  return { bid: px(bids), ask: px(asks), last: px(last) };
}

/** Recent trades for an item (for a little price history). */
export async function recentTrades(item: ItemId): Promise<GeTrade[]> {
  const rows = await get(
    `ge_trades?select=qty,price,at&item=eq.${encodeURIComponent(item)}&order=at.desc&limit=12`,
  );
  return rows.map((r) => r as GeTrade);
}

// --- Writes (atomic server functions) ---
export const depositGold = (amount: number): Promise<unknown> => rpc("ge_deposit_gold", { amount });
export const withdrawGold = (amount: number): Promise<unknown> => rpc("ge_withdraw_gold", { amount });
export const depositItem = (item: ItemId, qty: number): Promise<unknown> =>
  rpc("ge_deposit_item", { p_item: item, p_qty: qty });
export const withdrawItem = (item: ItemId, qty: number): Promise<unknown> =>
  rpc("ge_withdraw_item", { p_item: item, p_qty: qty });
export const placeOrder = (side: "buy" | "sell", item: ItemId, qty: number, price: number): Promise<unknown> =>
  rpc("ge_place_order", { p_side: side, p_item: item, p_qty: qty, p_price: price });
export const cancelOrder = (id: number): Promise<unknown> => rpc("ge_cancel_order", { p_id: id });

/**
 * src/client/friends.ts
 * ---------------------
 * The social graph: who's online right now, and your friends list. Online is
 * read straight from the shared presence table; friends live in `friendships`
 * (request → accept). Names resolve via the presence table (which persists one
 * row per player), so you can add anyone who has ever played.
 */

import { currentUser, rest } from "./supabase.ts";

const ONLINE_MS = 60_000; // "online" = moved within the last minute

export interface OnlinePlayer { id: string; name: string; agoMs: number }
export type FriendStatus = "accepted" | "pending_in" | "pending_out";
export interface Friend { rowId: number; id: string; name: string; status: FriendStatus; online: boolean }

async function get(query: string): Promise<Record<string, unknown>[]> {
  const res = await rest(query);
  if (!res.ok) throw new Error(`social read failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Everyone seen moving in the last minute (excluding you). */
export async function onlineNow(): Promise<OnlinePlayer[]> {
  const me = currentUser()?.id;
  const since = new Date(Date.now() - ONLINE_MS).toISOString();
  const rows = await get(
    `world_presence?select=user_id,name,updated_at&updated_at=gte.${encodeURIComponent(since)}&order=updated_at.desc&limit=100`,
  );
  const now = Date.now();
  return rows
    .filter((r) => r["user_id"] !== me)
    .map((r) => ({
      id: String(r["user_id"]),
      name: typeof r["name"] === "string" && r["name"] ? (r["name"] as string) : "Wanderer",
      agoMs: now - Date.parse(String(r["updated_at"])),
    }));
}

/** Look up a player's id by their (most recent) name. */
export async function resolveByName(name: string): Promise<string | null> {
  const rows = await get(
    `world_presence?select=user_id&name=eq.${encodeURIComponent(name.trim())}&limit=1`,
  );
  return rows.length ? String(rows[0]!["user_id"]) : null;
}

/** Names + online state for a set of user ids. */
async function profilesFor(ids: string[]): Promise<Record<string, { name: string; online: boolean }>> {
  const out: Record<string, { name: string; online: boolean }> = {};
  if (ids.length === 0) return out;
  const rows = await get(
    `world_presence?select=user_id,name,updated_at&user_id=in.(${ids.join(",")})`,
  );
  const now = Date.now();
  for (const r of rows) {
    out[String(r["user_id"])] = {
      name: typeof r["name"] === "string" && r["name"] ? (r["name"] as string) : "Wanderer",
      online: now - Date.parse(String(r["updated_at"])) < ONLINE_MS,
    };
  }
  return out;
}

/** Your friendships: accepted, plus incoming/outgoing pending requests. */
export async function listFriends(): Promise<Friend[]> {
  const me = currentUser();
  if (!me) return [];
  const rows = await get(
    `friendships?select=id,requester,addressee,status&or=(requester.eq.${me.id},addressee.eq.${me.id})`,
  );
  const others = rows.map((r) => (r["requester"] === me.id ? r["addressee"] : r["requester"])).map(String);
  const profs = await profilesFor([...new Set(others)]);
  return rows.map((r) => {
    const otherId = String(r["requester"] === me.id ? r["addressee"] : r["requester"]);
    const status: FriendStatus = r["status"] === "accepted"
      ? "accepted"
      : (r["addressee"] === me.id ? "pending_in" : "pending_out");
    return {
      rowId: Number(r["id"]),
      id: otherId,
      name: profs[otherId]?.name ?? "Wanderer",
      status,
      online: profs[otherId]?.online ?? false,
    };
  });
}

/** Send a friend request by name. Returns a short status message. */
export async function addFriend(name: string): Promise<string> {
  const me = currentUser();
  if (!me) throw new Error("Sign in first.");
  const id = await resolveByName(name);
  if (!id) throw new Error("No player by that name has played yet.");
  if (id === me.id) throw new Error("That's you.");
  const res = await rest("friendships", {
    method: "POST",
    prefer: "return=minimal",
    body: { requester: me.id, addressee: id },
  });
  if (!res.ok) {
    if (res.status === 409) return "You've already sent that request.";
    throw new Error(`Couldn't send request (${res.status}).`);
  }
  return `Request sent to ${name}.`;
}

export async function acceptFriend(rowId: number): Promise<void> {
  await rest(`friendships?id=eq.${rowId}`, { method: "PATCH", prefer: "return=minimal", body: { status: "accepted" } });
}

export async function removeFriend(rowId: number): Promise<void> {
  await rest(`friendships?id=eq.${rowId}`, { method: "DELETE", prefer: "return=minimal" });
}

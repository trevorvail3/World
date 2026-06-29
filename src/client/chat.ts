/**
 * src/client/chat.ts
 * ------------------
 * The world chat channel: one shared room, read by anyone signed in, posted to
 * as yourself. Thin wrapper over the `world_chat` table (polled by the UI).
 */

import { currentUser, rest } from "./supabase.ts";

export interface ChatMsg { id: number; name: string; body: string; at: string; you: boolean }
export const CHAT_MAX = 200;

/** The most recent messages, oldest-first (ready to append in order). */
export async function recentChat(): Promise<ChatMsg[]> {
  const res = await rest("world_chat?select=id,name,body,at,user_id&order=at.desc&limit=60");
  if (!res.ok) throw new Error(`chat read failed (${res.status})`);
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  const me = currentUser()?.id;
  return rows.reverse().map((r) => ({
    id: Number(r.id),
    name: typeof r.name === "string" && r.name ? r.name : "Wanderer",
    body: String(r.body ?? ""),
    at: String(r.at ?? ""),
    you: r.user_id === me,
  }));
}

/** Post a message as the current player. */
export async function sendChat(name: string, body: string): Promise<void> {
  const me = currentUser();
  const text = body.trim().slice(0, CHAT_MAX);
  if (!me || !text) return;
  const res = await rest("world_chat", {
    method: "POST",
    prefer: "return=minimal",
    body: { user_id: me.id, name, body: text },
  });
  if (!res.ok) throw new Error(`couldn't send (${res.status})`);
}

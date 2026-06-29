/**
 * src/client/playersUI.ts
 * -----------------------
 * The Players panel: who's online right now, and your friends list (send a
 * request by name, accept incoming ones, see which friends are online). Pure
 * presentation over friends.ts.
 */

import {
  acceptFriend, addFriend, listFriends, onlineNow, removeFriend, resolveByName,
  type Friend, type OnlinePlayer,
} from "./friends.ts";

type Tab = "online" | "friends";

function ago(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}

export class PlayersUI {
  private backdrop: HTMLElement;
  private body: HTMLElement;
  private note: HTMLElement;
  private tabsEl: HTMLElement;
  private open = false;
  private tab: Tab = "online";

  constructor(root: HTMLElement) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "players-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="players-modal">
        <div class="players-head">
          <span class="players-title">Players</span>
          <button class="players-close" type="button">✕</button>
        </div>
        <div class="players-tabs"></div>
        <div class="players-note"></div>
        <div class="players-body"></div>
      </div>`;
    this.tabsEl = this.backdrop.querySelector(".players-tabs") as HTMLElement;
    this.body = this.backdrop.querySelector(".players-body") as HTMLElement;
    this.note = this.backdrop.querySelector(".players-note") as HTMLElement;
    root.appendChild(this.backdrop);

    (this.backdrop.querySelector(".players-close") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.close(); },
    );
    this.backdrop.addEventListener("pointerdown", (e) => { if (e.target === this.backdrop) this.close(); });

    for (const [id, label] of [["online", "Online Now"], ["friends", "Friends"]] as [Tab, string][]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `players-tab${id === this.tab ? " on" : ""}`;
      b.textContent = label;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.tab = id;
        this.tabsEl.querySelectorAll(".players-tab").forEach((t) => t.classList.remove("on"));
        b.classList.add("on");
        void this.refresh();
      });
      this.tabsEl.appendChild(b);
    }
  }

  isOpen(): boolean { return this.open; }
  close(): void { this.open = false; this.backdrop.classList.add("hidden"); }

  async show(): Promise<void> {
    this.open = true;
    this.backdrop.classList.remove("hidden");
    await this.refresh();
  }

  private msg(text: string, ok = false): void {
    this.note.textContent = text;
    this.note.classList.toggle("ok", ok);
  }

  private async refresh(): Promise<void> {
    this.body.innerHTML = `<div class="players-empty">Loading…</div>`;
    try {
      if (this.tab === "online") this.renderOnline(await onlineNow());
      else this.renderFriends(await listFriends());
    } catch {
      this.body.innerHTML = `<div class="players-empty">Couldn't reach the server.</div>`;
    }
  }

  private renderOnline(list: OnlinePlayer[]): void {
    if (list.length === 0) {
      this.body.innerHTML = `<div class="players-empty">No one else is online right now.</div>`;
      return;
    }
    this.body.innerHTML = list.map((p) => `
      <div class="players-row">
        <span class="players-dot on"></span>
        <span class="players-name">${escapeHtml(p.name)}</span>
        <span class="players-ago">${ago(p.agoMs)}</span>
        <button class="players-btn add-friend" data-name="${escapeHtml(p.name)}" type="button">+ Friend</button>
      </div>`).join("");
    this.body.querySelectorAll(".add-friend").forEach((el) => {
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        void this.doAdd((el as HTMLElement).dataset.name ?? "");
      });
    });
  }

  private renderFriends(list: Friend[]): void {
    const incoming = list.filter((f) => f.status === "pending_in");
    const accepted = list.filter((f) => f.status === "accepted");
    const outgoing = list.filter((f) => f.status === "pending_out");
    const row = (f: Friend, actions: string): string => `
      <div class="players-row">
        <span class="players-dot${f.online ? " on" : ""}"></span>
        <span class="players-name">${escapeHtml(f.name)}</span>
        ${actions}
      </div>`;
    this.body.innerHTML = `
      <div class="players-add">
        <input class="players-input" type="text" placeholder="add a friend by name" />
        <button class="players-btn players-add-go" type="button">Add</button>
      </div>
      ${incoming.length ? `<div class="players-sub">Requests</div>` + incoming.map((f) => row(f,
        `<button class="players-btn accept" data-id="${f.rowId}" type="button">Accept</button>
         <button class="players-btn dim decline" data-id="${f.rowId}" type="button">✕</button>`)).join("") : ""}
      <div class="players-sub">Friends${accepted.length ? ` (${accepted.filter((f) => f.online).length} online)` : ""}</div>
      ${accepted.length ? accepted.map((f) => row(f,
        `<span class="players-ago">${f.online ? "online" : "offline"}</span>
         <button class="players-btn dim remove" data-id="${f.rowId}" type="button">✕</button>`)).join("")
        : `<div class="players-empty">No friends yet — add someone from Online Now, or by name.</div>`}
      ${outgoing.length ? `<div class="players-sub">Sent</div>` + outgoing.map((f) => row(f,
        `<span class="players-ago">pending</span>
         <button class="players-btn dim remove" data-id="${f.rowId}" type="button">✕</button>`)).join("") : ""}`;

    const input = this.body.querySelector(".players-input") as HTMLInputElement;
    (this.body.querySelector(".players-add-go") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); void this.doAdd(input.value); },
    );
    this.body.querySelectorAll(".accept").forEach((el) => el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      void acceptFriend(Number((el as HTMLElement).dataset.id)).then(() => this.refresh());
    }));
    this.body.querySelectorAll(".decline, .remove").forEach((el) => el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      void removeFriend(Number((el as HTMLElement).dataset.id)).then(() => this.refresh());
    }));
  }

  private async doAdd(name: string): Promise<void> {
    if (!name.trim()) { this.msg("Enter a name."); return; }
    try {
      // Guard against an obvious typo before hitting the server.
      const id = await resolveByName(name);
      if (!id) { this.msg("No player by that name has played yet."); return; }
      this.msg(await addFriend(name), true);
    } catch (e) { this.msg(e instanceof Error ? e.message : "Couldn't add friend."); }
    await this.refresh();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}

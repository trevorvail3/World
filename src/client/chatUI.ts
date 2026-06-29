/**
 * src/client/chatUI.ts
 * --------------------
 * The world chat box: a shared channel you can open from the World tab. Shows
 * recent messages, lets you post, and polls every few seconds while open (it
 * stops polling when closed, so it costs nothing in the background).
 */

import { CHAT_MAX, recentChat, sendChat, type ChatMsg } from "./chat.ts";

const POLL_MS = 3000;

export class ChatUI {
  private backdrop: HTMLElement;
  private log: HTMLElement;
  private input: HTMLInputElement;
  private open = false;
  private timer = 0;
  private lastId = -1;

  constructor(root: HTMLElement, private myName: () => string) {
    this.backdrop = document.createElement("div");
    this.backdrop.className = "chat-backdrop hidden";
    this.backdrop.innerHTML = `
      <div class="chat-modal">
        <div class="chat-head">
          <span class="chat-title">World Chat</span>
          <button class="chat-close" type="button">✕</button>
        </div>
        <div class="chat-log"></div>
        <form class="chat-form">
          <input class="chat-input" type="text" maxlength="${CHAT_MAX}" placeholder="say something…" autocomplete="off" />
          <button class="chat-send" type="submit">Send</button>
        </form>
      </div>`;
    this.log = this.backdrop.querySelector(".chat-log") as HTMLElement;
    this.input = this.backdrop.querySelector(".chat-input") as HTMLInputElement;
    root.appendChild(this.backdrop);

    (this.backdrop.querySelector(".chat-close") as HTMLElement).addEventListener(
      "pointerdown", (e) => { e.stopPropagation(); this.close(); },
    );
    this.backdrop.addEventListener("pointerdown", (e) => { if (e.target === this.backdrop) this.close(); });
    (this.backdrop.querySelector(".chat-form") as HTMLFormElement).addEventListener("submit", (e) => {
      e.preventDefault();
      void this.post();
    });
  }

  isOpen(): boolean { return this.open; }

  close(): void {
    this.open = false;
    this.backdrop.classList.add("hidden");
    if (this.timer) { clearInterval(this.timer); this.timer = 0; }
  }

  async show(): Promise<void> {
    this.open = true;
    this.backdrop.classList.remove("hidden");
    await this.refresh();
    this.input.focus();
    if (!this.timer) this.timer = window.setInterval(() => void this.refresh(), POLL_MS);
  }

  private async post(): Promise<void> {
    const text = this.input.value.trim();
    if (!text) return;
    this.input.value = "";
    try { await sendChat(this.myName(), text); } catch { /* shown on next refresh */ }
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    let msgs: ChatMsg[];
    try { msgs = await recentChat(); }
    catch {
      if (!this.log.childElementCount) this.log.innerHTML = `<div class="chat-empty">Couldn't reach the channel.</div>`;
      return;
    }
    const top = msgs[msgs.length - 1]?.id ?? -1;
    if (top === this.lastId && this.log.childElementCount) return; // nothing new
    this.lastId = top;
    this.log.innerHTML = msgs.length
      ? msgs.map((m) => `
        <div class="chat-msg${m.you ? " you" : ""}">
          <span class="chat-name">${escapeHtml(m.name)}</span>
          <span class="chat-body">${escapeHtml(m.body)}</span>
        </div>`).join("")
      : `<div class="chat-empty">No messages yet — say hello.</div>`;
    this.log.scrollTop = this.log.scrollHeight;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}

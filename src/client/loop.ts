/**
 * src/client/loop.ts
 * ------------------
 * The client game loop and all input handling.
 *
 * The loop's job each frame: read the clock, ask the core to advance time
 * (tick), react to the events the core returns (log lines, dialogue, hit
 * numbers), move the camera, and paint. Taps are turned into INTENTS and
 * handed to the core — the loop NEVER edits world state itself (RULE 2).
 *
 * Input is OSRS-flavoured:
 *   - a short tap does the obvious thing (walk there / interact with that),
 *   - a long press (or right-click) opens an action menu (Interact / Walk
 *     here / Examine),
 *   - a marker shows where you tapped, and the thing you're busy with glows.
 */

import type {
  Content,
  Intent,
  ItemId,
  MonsterStats,
  ObjKind,
  SkillAction,
  TileType,
  Vec2,
  WorldEvent,
  WorldObjectDef,
  WorldState,
} from "../core/types.ts";
import { BankUI } from "./bankUI.ts";
import { ShopUI } from "./shopUI.ts";
import { BountyUI } from "./bountyUI.ts";
import { LevelUp } from "./levelUp.ts";
import type { ContextMenu, MenuItem } from "./contextMenu.ts";
import { Dialogue } from "./dialogue.ts";
import type { Guide } from "./guide.ts";
import { Hud } from "./hud.ts";
import { Minimap, WorldMapModal } from "./minimap.ts";
import { Camera, drawWorld, TILE } from "./render.ts";
import { objectPos, travelFare } from "../core/worldCore.ts";
import { findPath, pathToAdjacent } from "./pathfinding.ts";

/**
 * The bridge to the core. main.ts builds this so the loop never imports the
 * core directly with its own clock/RNG — keeping the seam where a network
 * connection could slot in later (RULE 2 / multiplayer-ready).
 */
export interface CoreBridge {
  readonly state: WorldState;
  readonly content: Content;
  walkable(x: number, y: number): boolean;
  /** The recipes a station (fire/furnace/anvil) offers. */
  stationRecipes(station: ObjKind): SkillAction[];
  send(intent: Intent): WorldEvent[];
  tick(nowMs: number): WorldEvent[];
}

interface FloatText {
  x: number; // tile coords
  y: number;
  text: string;
  color: string;
  born: number;
  size?: number;
}

/** A short impact burst (chips / sparks / splash) at a tile, for action feel. */
interface Spark {
  x: number; // tile coords
  y: number;
  born: number;
  color: string;
  n: number; // number of shards
}

/** Impact-burst colour by the skill being trained (wood chips, stone, splash…). */
const SPARK_COLOR: Record<string, string> = {
  forestry: "#9a7a4a",
  mining: "#a59a8c",
  fishing: "#6fa0c0",
  hunter: "#9a7a4a",
  smithing: "#e0903a",
  cooking: "#e08a3a",
  crafting: "#caa05a",
  herblore: "#7fae6a",
  construction: "#a59a8c",
  woodcraft: "#9a7a4a",
  farming: "#7fae6a",
};

interface Marker {
  x: number;
  y: number;
  born: number;
}

interface TapFlash {
  objId: string;
  born: number;
}

interface Press {
  startX: number;
  startY: number;
  tile: Vec2;
  longFired: boolean;
  moved: boolean;
}

const LONG_PRESS_MS = 330;
const MOVE_CANCEL_PX = 12;
const MARKER_LIFE = 600;
const FLASH_LIFE = 450;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2.4;
const ZOOM_KEY = "varath-zoom"; // a client display preference, kept in localStorage
const clampZoom = (z: number): number => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
function readZoom(): number {
  const raw = Number(localStorage.getItem(ZOOM_KEY));
  return Number.isFinite(raw) && raw > 0 ? clampZoom(raw) : 1;
}

/** The verb shown for interacting with each kind of object. */
const VERB: Record<ObjKind, string> = {
  tree: "Chop",
  rock: "Mine",
  fishing_spot: "Fish",
  npc: "Talk to",
  monster: "Attack",
  bank: "Open",
  fire: "Cook at",
  furnace: "Smelt at",
  anvil: "Forge at",
  shrine: "Examine",
  plant_patch: "Tend",
  tree_patch: "Tend",
  portal: "Enter",
  trap: "Set snare",
  bounty_board: "Read",
  housing_plot: "Claim",
  build_hotspot: "Build at",
  house_door: "Enter",
  room_seal: "Build wing",
  cauldron: "Brew at",
  workbench: "Build at",
  crafting_table: "Craft at",
  cart: "Examine",
  fountain: "Examine",
  sawmill: "Mill at",
  critter: "Watch",
  lamppost: "Examine",
  signpost: "Read",
  waystone: "Travel from",
  agility_obstacle: "Traverse",
  relic: "Read",
};

const EXAMINE_OBJECT: Record<ObjKind, string> = {
  tree: "A pale ashwood — common as dirt, and the forester's first tree.",
  rock: "A workable seam of stone.",
  fishing_spot: "Dark ripples at the head of the Redrun; ashfin move below.",
  npc: "Someone met on the road.",
  monster: "A wild thing of the hills.",
  bank: "A sturdy iron-bound chest. Your goods are safe in it.",
  fire: "A steady cooking fire. Raw catch goes in; a meal comes out.",
  furnace: "A small stone furnace, hot enough to render ore to bar.",
  anvil: "A pitted iron anvil. Bring bars and a hammer to beat out gear.",
  shrine: "A weathered standing stone, older than any road here.",
  plant_patch: "A bed of tilled soil, waiting for a seed.",
  tree_patch: "A cleared plot where a sapling could take root.",
  portal: "A dark archway. Something waits on the other side.",
  trap: "A snare set among the runs and burrows. Patience catches game.",
  bounty_board: "A board of nailed-up notices — slaying contracts, paid in Hunt Marks.",
  housing_plot: "A vacant homestead yard. Claim it, and its house is yours to furnish.",
  build_hotspot: "A space for furniture — build a piece here from your Construction materials.",
  house_door: "The door to a home. Step through to its own quiet interior.",
  room_seal: "A walled-off doorway. Build the extension to add the room beyond it onto your house.",
  cauldron: "A blackened cauldron over coals. Flask in hand, you can brew here.",
  workbench: "A sturdy builder's bench, racked with saws and chisels.",
  crafting_table: "An artisan's table — tanning frame, glass-pipe and a jeweller's vice.",
  cart: "A market stall, its awning faded by weather and woodsmoke.",
  fountain: "A stone fountain, the water bright over old green-stained basins.",
  sawmill: "A sawmill bench — frame-saws, a shaving-horse and a bowyer's vice.",
  critter: "A wild thing, going about its small business. It startles as you near.",
  lamppost: "An iron lamp on a tall post. Lit against the dark by whoever walks the rounds.",
  signpost: "A weathered fingerpost, its boards pointing the old roads.",
  waystone: "A Courier waystone. Pay the toll and a rider will see you to another.",
  agility_obstacle: "Part of a training circuit. Clear each leg in turn to build your Agility.",
  relic: "Something was left here to be found — a page, a rubbing, a mark. Read it.",
};

const EXAMINE_TILE: Record<TileType, string> = {
  grass: "Tufts of pale hill grass.",
  dirt: "Bare, trodden earth.",
  path: "A worn stone path.",
  stone: "Cold grey stone underfoot.",
  water: "The cold head of the Redrun, where the hill-streams braid.",
  moss: "Deep moss of the Greyoak floor, soft and damp underfoot.",
  mountain: "Sheer Spine rock — no way up here. The pass lies around it.",
  snow: "Hard-packed snow of the high Spine. The wind never quite stops.",
  bog: "Soft Heartmoor ground. The peat keeps whatever it takes whole.",
  ash: "Warm cracked earth of the Ashfen Flats. The ground is uncomfortable to stand on.",
  cave: "The dark floor of the Marrow Deeps. Your torchlight finds no far wall.",
  cave_wall: "Dressed cave rock — too smooth, in places, to be only the dark's work.",
  deep: "The open grey of the Eyeless Sea. It gives back no landmark.",
  wall: "Ironvale's dressed-stone rampart. Old work, and still sound.",
  plank: "A swept timber floor, warm underfoot. The boards of a home.",
};

/** Examine flavour for the tree species. */
const EXAMINE_TREE: Record<string, string> = {
  ashwood: "A pale ashwood — common as dirt, and the forester's first tree.",
  coldpine: "A cold blue-green pine of the Greyoak edge. Resinous and straight.",
  greyoak: "A wide-canopied greyoak, old before Ironvale was named. Hard timber.",
};

export class Game {
  private g: CanvasRenderingContext2D;
  private cam: Camera = { x: 0, y: 0 };
  private zoom = readZoom();
  /** Device-pixel ratio baked into the backing store for crisp rendering. */
  private dpr = 1;
  /** Pending deferred re-measure (mobile rotation reports stale sizes). */
  private resizeTimer = 0;
  /** Active touch points, for pinch-to-zoom. */
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private floats: FloatText[] = [];
  private sparks: Spark[] = [];
  private levelUp: LevelUp;
  private camInitialised = false;

  private menu: ContextMenu;
  private minimap: Minimap;
  private worldMap: WorldMapModal;
  private bank: BankUI;
  private shop: ShopUI;
  private bounty: BountyUI;
  private press: Press | null = null;
  private longTimer: number | null = null;
  private marker: Marker | null = null;
  private tapFlash: TapFlash | null = null;
  /** A loot tile the player is walking toward to pick up, polled each frame. */
  private pickupTarget: Vec2 | null = null;
  /** Timestamp of the last hit the player took — drives a red screen flash. */
  private hurtFlash = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private bridge: CoreBridge,
    private hud: Hud,
    private dialogue: Dialogue,
    uiRoot: HTMLElement,
    menu: ContextMenu,
    private guide: Guide,
  ) {
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Could not get a 2D canvas context.");
    this.g = g;
    this.menu = menu;
    this.worldMap = new WorldMapModal(uiRoot, bridge.content, (tile) => this.walkToWorldTile(tile));
    this.minimap = new Minimap(
      uiRoot,
      () => this.worldMap.show(),
      (tile) => this.walkToWorldTile(tile),
    );
    this.bank = new BankUI(uiRoot, bridge.content, (intent) => this.dispatch(intent));
    this.shop = new ShopUI(uiRoot, bridge.content, (intent) => this.dispatch(intent));
    this.bounty = new BountyUI(uiRoot, bridge.content, (intent) => this.dispatch(intent));
    this.levelUp = new LevelUp(uiRoot, bridge.content);

    this.resize();
    window.addEventListener("resize", () => this.resize());
    // Mobile rotation is the awkward case: the `resize`/`orientationchange`
    // events fire before the browser has settled the new viewport size, so a
    // single measurement reads stale dimensions and the canvas ends up the wrong
    // shape. Re-measure a few times after the event, and lean on visualViewport
    // (which fires once the URL bar / safe-area has actually resized).
    window.addEventListener("orientationchange", () => this.scheduleResize());
    window.visualViewport?.addEventListener("resize", () => this.resize());

    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    window.addEventListener("pointercancel", (e) => this.pointers.delete(e.pointerId));
    // Mouse-wheel zoom.
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.setZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });
    // Suppress the browser's own right-click menu; we provide our own.
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  start(): void {
    this.hud.log("Welcome to The Knuckle Hills.");
    const frame = (now: number) => {
      requestAnimationFrame(frame); // schedule next first so one bad frame can't stop the loop
      this.update(now);
    };
    requestAnimationFrame(frame);
  }

  /** Send an intent and immediately react to its events (for UI actions). */
  dispatch(intent: Intent): void {
    const events = this.bridge.send(intent);
    this.handleEvents(events, performance.now());
  }

  /**
   * Size the backing store to the element's CSS box × the device-pixel ratio,
   * so the world is rendered crisply on high-density (phone/retina) screens
   * instead of being upscaled from a low-res buffer. The DPR is folded into the
   * draw transform (see `update`), and every screen↔world conversion divides it
   * back out, so input mapping is unaffected.
   */
  private resize(): void {
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    // Prefer visualViewport: on mobile it reports the *settled* visible size
    // (excluding the URL bar) and updates correctly through a rotation.
    const cssW = Math.round(this.canvas.clientWidth || window.innerWidth);
    const cssH = Math.round(this.canvas.clientHeight || window.innerHeight);
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (w === this.canvas.width && h === this.canvas.height && dpr === this.dpr) {
      return; // nothing changed — avoid clearing the canvas needlessly
    }
    this.dpr = dpr;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  /**
   * Re-measure now and again shortly after — orientation changes don't settle
   * the viewport synchronously, so one measurement isn't enough on mobile.
   */
  private scheduleResize(): void {
    this.resize();
    requestAnimationFrame(() => this.resize());
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resize(), 300);
  }

  /** Visible view width in world pixels (DPR- and zoom-independent). */
  private get viewW(): number {
    return this.canvas.width / (this.zoom * this.dpr);
  }

  /** Visible view height in world pixels (DPR- and zoom-independent). */
  private get viewH(): number {
    return this.canvas.height / (this.zoom * this.dpr);
  }

  private update(now: number): void {
    // 1) Advance the world and react to what happened.
    const events = this.bridge.tick(now);
    this.handleEvents(events, now);
    this.guide.update(this.bridge.state);
    this.checkPickup();

    // 2) Camera follows the player.
    this.followCamera();

    // 3) Paint the world (and its world-space overlays) under the zoom transform.
    //    The DPR is folded in here so one world pixel covers `zoom` CSS pixels at
    //    full device resolution; everything below works in world pixels.
    const s = this.zoom * this.dpr;
    this.g.setTransform(s, 0, 0, s, 0, 0);
    drawWorld(
      this.g, this.canvas, this.bridge.state, this.bridge.content, this.cam, now,
      this.viewW, this.viewH,
    );
    this.drawMarker(now);
    this.drawHighlights(now);
    this.drawActivityFeedback(now);
    this.drawTutorialArrow(now);
    this.drawQuestMarkers(now);
    this.drawSparks(now);
    this.drawFloats(now);
    this.g.setTransform(1, 0, 0, 1, 0, 0); // back to device space for the HUD/minimap
    this.drawHurtVignette(now);
    this.drawDeathOverlay(now);

    // 4) Refresh the HUD readouts and the minimap.
    this.hud.update(this.bridge.state);
    this.minimap.draw(this.bridge.state, this.bridge.content);
    if (this.worldMap.isOpen()) {
      this.worldMap.draw(
        this.bridge.state,
        this.bridge.content,
        this.cam,
        this.viewW,
        this.viewH,
      );
    }
  }

  private followCamera(): void {
    const p = this.bridge.state.player.pos;
    const targetX = p.x * TILE + TILE / 2 - this.viewW / 2;
    const targetY = p.y * TILE + TILE / 2 - this.viewH / 2;
    if (!this.camInitialised) {
      this.cam.x = targetX;
      this.cam.y = targetY;
      this.camInitialised = true;
    } else {
      this.cam.x += (targetX - this.cam.x) * 0.12;
      this.cam.y += (targetY - this.cam.y) * 0.12;
    }
  }

  /** Current view zoom (1 = default). */
  getZoom(): number {
    return this.zoom;
  }

  /** Set the view zoom (clamped) and remember it across sessions. */
  setZoom(z: number): void {
    this.zoom = clampZoom(z);
    try { localStorage.setItem(ZOOM_KEY, String(this.zoom)); } catch { /* ignore */ }
  }

  private handleEvents(events: WorldEvent[], now: number): void {
    let xpSum = 0;
    for (const ev of events) {
      switch (ev.type) {
        case "LOG":
          this.hud.log(ev.message);
          break;
        case "XP_GAINED": {
          xpSum += ev.amount;
          // A little impact burst on the thing you're working, on the beat.
          const tid = this.bridge.state.player.activity.targetId;
          const tp = tid ? this.positionOf(tid) : null;
          if (tp) this.sparks.push({ x: tp.x, y: tp.y, born: now, color: SPARK_COLOR[ev.skill] ?? "#caa05a", n: 5 });
          break;
        }
        case "LEVEL_UP": {
          const name = this.bridge.content.skills[ev.skill].name;
          this.hud.log(`You reach ${name} level ${ev.level}!`);
          this.levelUp.show(ev.skill, ev.level); // the OSRS "ding"
          break;
        }
        case "INVENTORY_FULL":
          this.hud.log("Your pack is full.");
          break;
        case "DIALOGUE":
          this.dialogue.show(ev.npc, ev.lines);
          break;
        case "PLAYER_DIED":
          this.hud.log("You have been knocked out...");
          break;
        case "PLAYER_RESPAWNED":
          this.hud.log("You wake up, dazed but alive.");
          break;
        case "OPEN_BANK":
          this.bank.show(this.bridge.state);
          break;
        case "OPEN_SHOP": {
          const shopDef = this.bridge.content.shops.find((s) => s.id === ev.shop);
          if (shopDef) this.shop.show(this.bridge.state, shopDef);
          break;
        }
        case "OPEN_PLANT":
          this.openPlant(ev.patchId, ev.patchType);
          break;
        case "OPEN_BOUNTY":
          this.bounty.show(this.bridge.state);
          break;
        case "OPEN_CRAFT":
          this.openCraft(ev.station, ev.objId);
          break;
        case "OPEN_BUILD":
          this.openBuild(ev.hotspotId, ev.category, ev.current);
          break;
        case "OPEN_EXTENSION":
          this.openExtension(ev.sealId, ev.name, ev.levelReq, ev.materials);
          break;
        case "OPEN_TRAVEL":
          this.openTravel(ev.objId);
          break;
        case "QUEST_COMPLETED": {
          const p = this.bridge.state.player.pos;
          this.floats.push({
            x: p.x,
            y: p.y - 0.6,
            text: "Quest complete!",
            color: "#f2cf6b",
            born: now,
            size: 17,
          });
          break;
        }
        case "QUEST_CHOICE":
          this.openChoice(ev.quest, ev.prompt, ev.options);
          break;
        case "QUEST_STARTED":
        case "QUEST_ADVANCED":
          break;
        case "COMPANION_FOUND": {
          const p = this.bridge.state.player.pos;
          const name = this.bridge.content.items[ev.item]?.name ?? "A companion";
          this.floats.push({ x: p.x, y: p.y - 0.7, text: `${name} joins you!`, color: "#9fd07a", born: now, size: 17 });
          break;
        }
        case "ACHIEVEMENT": {
          const p = this.bridge.state.player.pos;
          this.floats.push({ x: p.x, y: p.y - 0.9, text: `Achievement: ${ev.name}`, color: "#f2cf6b", born: now, size: 16 });
          break;
        }
        case "HEALED": {
          const p = this.bridge.state.player.pos;
          this.floats.push({ x: p.x, y: p.y - 0.3, text: `+${ev.amount}`, color: "#5fd06a", born: now, size: 15 });
          this.sparks.push({ x: p.x, y: p.y, born: now, color: "#5fd06a", n: 6 });
          break;
        }
        case "DAMAGE": {
          // Taking a real hit flashes the screen edges red — the harder the hit
          // (relative to max HP), the stronger the flash.
          if (ev.targetId === "player" && ev.amount > 0) this.hurtFlash = now;
          const pos = this.positionOf(ev.targetId);
          if (pos) {
            // A weakness-exploiting hit reads in bright gold ("super effective"),
            // a normal hit in red, a miss in grey — so the triangle is legible.
            const hit = ev.amount > 0;
            const color = !hit ? "#9aa0a6" : ev.weak ? "#ffcf4a" : "#e2483a";
            this.floats.push({
              x: pos.x,
              y: pos.y,
              text: hit ? (ev.weak ? `${ev.amount}!` : String(ev.amount)) : "miss",
              color,
              born: now,
              ...(ev.weak && hit ? { size: 16 } : {}),
            });
            this.sparks.push({
              x: pos.x, y: pos.y, born: now,
              color: !hit ? "#7a808a" : ev.weak ? "#ffcf4a" : "#e2483a",
              n: !hit ? 3 : ev.weak ? 9 : 6,
            });
          }
          break;
        }
        default:
          break;
      }
    }
    // One tidy "+N XP" rising off the player per tick, not one per skill.
    if (xpSum > 0) {
      const p = this.bridge.state.player.pos;
      this.floats.push({
        x: p.x,
        y: p.y,
        text: `+${Math.round(xpSum)} XP`,
        color: "#e0b54a",
        born: now,
      });
    }
  }

  /** A station's recipe menu: pick what to make from what you're carrying. */
  private openCraft(station: ObjKind, objId: string): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);
    const has = (a: SkillAction): boolean => {
      if (a.requires) {
        for (const [item, qty] of Object.entries(a.requires)) {
          if (have(item) < (qty ?? 0)) return false;
        }
      }
      if (a.requiresAny && a.requiresAny.length) {
        if (!a.requiresAny.some((it) => have(it) > 0)) return false;
      }
      return true;
    };

    // Show EVERY recipe for the station as a level ladder — the ones you can make
    // now are highlighted, ones above your level are greyed with their level req,
    // so you can see what's coming and what to train toward (OSRS-style).
    const recipes = this.bridge
      .stationRecipes(station)
      .filter((a) => a.produces)
      .sort((a, b) => a.levelReq - b.levelReq || content.items[a.produces!].name.localeCompare(content.items[b.produces!].name));

    const items: MenuItem[] = recipes.map((a) => {
      const out = content.items[a.produces!];
      const lvl = player.skills[a.skill].level;
      const leveled = lvl >= a.levelReq;
      const ready = leveled && has(a);
      const skillName = content.skills[a.skill].name;
      return {
        label: out.name,
        target: leveled ? this.costText(a) : `${skillName} Lv ${a.levelReq}`,
        tone: ready ? "action" : leveled ? "normal" : "locked",
        onSelect: () => {
          if (!leveled) {
            this.hud.log(`You need ${skillName} level ${a.levelReq} to make ${out.name}.`);
            return;
          }
          if (!has(a)) {
            this.hud.log(`You don't have the materials for ${out.name}.`);
            return;
          }
          this.dispatch({ type: "CRAFT", actionId: a.id, objId });
        },
      };
    });

    if (items.length === 0) {
      this.hud.log("You've nothing to make here yet.");
      return;
    }
    const title = VERB[station].replace(/ at$/, "");
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      title,
      items,
      "Pick a recipe — you'll keep making it until the materials run out.",
    );
  }

  /** A homestead footing: pick a furniture piece to build (or clear it). */
  private openBuild(hotspotId: string, category: string, current: string | null): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const conLvl = player.skills.construction.level;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);
    const hasMats = (f: { materials: Record<string, number | undefined> }): boolean =>
      Object.entries(f.materials).every(([item, qty]) => have(item) >= (qty ?? 0));

    const pieces = Object.values(content.furniture)
      .filter((f) => f.category === category)
      .sort((a, b) => a.levelReq - b.levelReq);

    const items: MenuItem[] = [];

    // If a functional piece is already built here, lead with using it (cook /
    // bank / build at home) — the everyday action — then offer to re-furnish.
    const built = current ? content.furniture[current] : undefined;
    if (built?.station) {
      const verbs: Record<string, string> = {
        bank: "Open", workbench: "Build at", anvil: "Forge at",
        cauldron: "Brew at", furnace: "Smelt at", fire: "Cook at",
      };
      items.push({
        label: `${verbs[built.station] ?? "Use"} the ${built.name}`,
        tone: "action",
        onSelect: () => this.dispatch({ type: "USE_FURNITURE", hotspotId }),
      });
    }

    items.push(...pieces.map((f): MenuItem => {
      const isBuilt = current === f.id;
      const leveled = conLvl >= f.levelReq;
      const ready = leveled && hasMats(f);
      const cost = Object.entries(f.materials)
        .map(([item, qty]) => `${qty}× ${content.items[item as ItemId].name}`).join(", ");
      return {
        label: isBuilt ? `${f.name} ✓` : `${f.name}  ·  Con ${f.levelReq}`,
        target: isBuilt ? "built here" : leveled ? cost : `needs Construction ${f.levelReq}`,
        tone: ready && !isBuilt ? "action" : "normal",
        onSelect: () => {
          if (isBuilt) { this.hud.log(`The ${f.name} is already built here.`); return; }
          if (!leveled) { this.hud.log(`You need Construction level ${f.levelReq} to build the ${f.name}.`); return; }
          if (!hasMats(f)) { this.hud.log(`You're short of materials for the ${f.name}.`); return; }
          this.dispatch({ type: "BUILD_FURNITURE", hotspotId, furnitureId: f.id });
        },
      };
    }));

    if (current) {
      items.push({
        label: "Clear this footing",
        tone: "normal",
        onSelect: () => this.dispatch({ type: "REMOVE_FURNITURE", hotspotId }),
      });
    }

    const label = category[0]!.toUpperCase() + category.slice(1);
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      `Build — ${label}`,
      items,
      "Build from your Construction materials. Replace a piece any time to redecorate.",
    );
  }

  /** Offer to build an add-on room (a wing): show the cost, confirm to build. */
  private openExtension(sealId: string, name: string, levelReq: number, materials: Record<string, number>): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);
    const leveled = player.skills.construction.level >= levelReq;
    const hasMats = Object.entries(materials).every(([item, qty]) => have(item) >= qty);
    const cost = Object.entries(materials)
      .map(([item, qty]) => `${qty}× ${content.items[item as ItemId].name}`).join(", ");
    const items: MenuItem[] = [{
      label: `Build the ${name} wing  ·  Con ${levelReq}`,
      target: leveled ? cost : `needs Construction ${levelReq}`,
      tone: leveled && hasMats ? "action" : "normal",
      onSelect: () => {
        if (!leveled) { this.hud.log(`Building the ${name} wing needs Construction level ${levelReq}.`); return; }
        if (!hasMats) { this.hud.log(`You're short of materials for the ${name} wing.`); return; }
        this.dispatch({ type: "BUILD_ROOM", sealId });
      },
    }];
    this.menu.show(
      window.innerWidth / 2, window.innerHeight / 2,
      `Add a room — ${name}`, items,
      "Raise the extension to add this room onto your house. The doorway opens once it's built.",
    );
  }

  /** The Courier's waystone network: pick a destination and pay the toll. */
  private openTravel(srcId: string): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const dests = content.objects
      .filter((o) => o.kind === "waystone" && o.id !== srcId && o.target)
      .map((o) => ({ o, fare: travelFare(player.pos, o.target!) }))
      .sort((a, b) => a.fare - b.fare);

    const items: MenuItem[] = dests.map(({ o, fare }) => {
      const afford = player.gold >= fare;
      return {
        label: o.name,
        target: `${fare}g`,
        tone: afford ? "action" : "normal",
        onSelect: () => {
          if (!afford) {
            this.hud.log(`The toll to ${o.name} is ${fare}g — you can't cover it.`);
            return;
          }
          this.dispatch({ type: "TRAVEL", to: o.id });
        },
      };
    });
    if (items.length === 0) {
      this.hud.log("This is the only waystone you know.");
      return;
    }
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      "Courier Waystone",
      items,
      `Pay the toll to ride elsewhere. You carry ${player.gold.toLocaleString()}g.`,
    );
  }

  /**
   * A quest's branching question: show each option as a tappable line. Picking
   * one sends a CHOOSE intent; the core sets the flags and advances the quest.
   */
  private openChoice(quest: string, prompt: string, options: string[]): void {
    const items: MenuItem[] = options.map((label, index) => ({
      label,
      tone: "action",
      onSelect: () => {
        this.dispatch({ type: "CHOOSE", quest, option: index });
      },
    }));
    if (items.length === 0) return;
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      prompt,
      items,
      "Choose carefully — this answer is remembered.",
    );
  }

  /** A farming patch's seed menu: what you can plant here right now. */
  private openPlant(patchId: string, patchType: "plant" | "tree"): void {
    const content = this.bridge.content;
    const player = this.bridge.state.player;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);
    const farmLvl = player.skills.farming.level;

    const crops = Object.values(content.crops)
      .filter((c) => c.type === patchType)
      .sort((a, b) => a.levelReq - b.levelReq);

    const items: MenuItem[] = crops.map((c) => {
      const seeds = have(c.seed);
      const ok = farmLvl >= c.levelReq && seeds > 0;
      const mins = Math.round(c.growthMs / 60000);
      const time = mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`;
      return {
        label: c.name,
        target: ok ? `${time} · ${seeds} seed${seeds === 1 ? "" : "s"}` : `Lv ${c.levelReq}`,
        tone: ok ? "action" : "normal",
        onSelect: () => {
          if (farmLvl < c.levelReq) {
            this.hud.log(`You need Farming level ${c.levelReq} to plant ${c.name}.`);
            return;
          }
          if (seeds <= 0) {
            this.hud.log(`You have no ${content.items[c.seed].name}.`);
            return;
          }
          this.dispatch({ type: "PLANT", patchId, crop: c.id });
        },
      };
    });
    if (items.length === 0) return;
    this.menu.show(
      window.innerWidth / 2,
      window.innerHeight / 2,
      patchType === "tree" ? "Plant a tree" : "Plant a seed",
      items,
      "Crops grow in real time — come back when they're ripe.",
    );
  }

  /** A short "2× Knucklestone, 1× Charcoal" cost line for a recipe. */
  private costText(a: SkillAction): string {
    const items = this.bridge.content.items;
    const parts: string[] = [];
    if (a.requires) {
      for (const [item, qty] of Object.entries(a.requires)) {
        parts.push(`${qty}× ${items[item as ItemId].name}`);
      }
    }
    if (a.requiresAny && a.requiresAny.length) parts.push("any log");
    return parts.join(", ");
  }

  private positionOf(targetId: string): Vec2 | null {
    if (targetId === "player") return this.bridge.state.player.pos;
    const def = this.bridge.content.objects.find((o) => o.id === targetId);
    if (!def) return null;
    return objectPos(def, this.bridge.state.objects[def.id]);
  }

  // --- Drawing overlays --------------------------------------------------

  private toScreen(tileX: number, tileY: number): Vec2 {
    return {
      x: tileX * TILE + TILE / 2 - this.cam.x,
      y: tileY * TILE + TILE / 2 - this.cam.y,
    };
  }

  private drawMarker(now: number): void {
    if (!this.marker) return;
    const age = now - this.marker.born;
    if (age >= MARKER_LIFE) {
      this.marker = null;
      return;
    }
    const t = Math.max(0, Math.min(1, age / MARKER_LIFE));
    const { x: cx, y: cy } = this.toScreen(this.marker.x, this.marker.y);
    const alpha = 1 - t;

    // An expanding ember ring...
    this.g.globalAlpha = alpha * 0.7;
    this.g.strokeStyle = "#e0b54a";
    this.g.lineWidth = 2;
    this.g.beginPath();
    this.g.arc(cx, cy, TILE * (0.18 + t * 0.3), 0, Math.PI * 2);
    this.g.stroke();

    // ...with a shrinking gold cross at the centre (the classic walk marker).
    const s = TILE * 0.26 * (1 - 0.45 * t);
    this.g.globalAlpha = alpha;
    this.g.strokeStyle = "#f2cf6b";
    this.g.lineWidth = 3;
    this.g.beginPath();
    this.g.moveTo(cx - s, cy - s);
    this.g.lineTo(cx + s, cy + s);
    this.g.moveTo(cx - s, cy + s);
    this.g.lineTo(cx + s, cy - s);
    this.g.stroke();
    this.g.globalAlpha = 1;
  }

  private drawHighlights(now: number): void {
    const player = this.bridge.state.player;

    // Persistent glow on whatever the player is busy with (or walking to).
    const targetId = player.activity.targetId ?? player.pendingInteractId;
    if (targetId) {
      const pos = this.positionOf(targetId);
      if (pos) {
        const { x: cx, y: cy } = this.toScreen(pos.x, pos.y);
        const pulse = 0.45 + 0.3 * Math.sin(now / 200);
        this.g.globalAlpha = pulse;
        this.g.strokeStyle = "#d2742c";
        this.g.lineWidth = 2.5;
        this.g.strokeRect(cx - TILE * 0.46, cy - TILE * 0.46, TILE * 0.92, TILE * 0.92);
        this.g.globalAlpha = 1;
      }
    }

    // A brief ring when an object is tapped.
    if (this.tapFlash) {
      const age = now - this.tapFlash.born;
      if (age >= FLASH_LIFE) {
        this.tapFlash = null;
      } else {
        const pos = this.positionOf(this.tapFlash.objId);
        if (pos) {
          const t = Math.max(0, Math.min(1, age / FLASH_LIFE));
          const { x: cx, y: cy } = this.toScreen(pos.x, pos.y);
          this.g.globalAlpha = 1 - t;
          this.g.strokeStyle = "#f2cf6b";
          this.g.lineWidth = 2;
          this.g.beginPath();
          this.g.arc(cx, cy, TILE * (0.3 + t * 0.35), 0, Math.PI * 2);
          this.g.stroke();
          this.g.globalAlpha = 1;
        }
      }
    }
  }

  /** Enemy HP bar in combat; a progress ring for timed gathering/processing. */
  private drawActivityFeedback(now: number): void {
    const act = this.bridge.state.player.activity;
    if (act.kind === "idle" || !act.targetId) return;
    const def = this.bridge.content.objects.find((o) => o.id === act.targetId);
    if (!def) return;
    const ap = objectPos(def, this.bridge.state.objects[def.id]);
    const { x: cx, y: cy } = this.toScreen(ap.x, ap.y);

    if (act.kind === "combat") {
      const stats = def.monster ? this.bridge.content.monsters[def.monster] : undefined;
      const obj = this.bridge.state.objects[def.id];
      if (stats && obj && obj.hp !== undefined) {
        const w = TILE * 0.7;
        const h = 4;
        const pct = Math.max(0, Math.min(1, obj.hp / stats.hp));
        const bx = cx - w / 2;
        const by = cy - TILE * 0.6;
        this.g.fillStyle = "rgba(0,0,0,0.6)";
        this.g.fillRect(bx - 1, by - 1, w + 2, h + 2);
        this.g.fillStyle = "#3a1410";
        this.g.fillRect(bx, by, w, h);
        this.g.fillStyle = "#c43a23";
        this.g.fillRect(bx, by, w * pct, h);
      }
      return;
    }

    // Timed gathering / cooking / smelting: a filling progress ring.
    if (act.actionInterval > 0) {
      const remain = Math.max(0, act.nextActionAt - now);
      const progress = 1 - Math.min(1, remain / act.actionInterval);
      const r = TILE * 0.42;
      this.g.lineWidth = 3;
      this.g.strokeStyle = "rgba(0,0,0,0.4)";
      this.g.beginPath();
      this.g.arc(cx, cy, r, 0, Math.PI * 2);
      this.g.stroke();
      this.g.strokeStyle = "#e0b54a";
      this.g.beginPath();
      this.g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      this.g.stroke();
    }
  }

  /** A bobbing gold chevron over whatever the onboarding guide points at. */
  /**
   * Hand-holding for the first couple of tasks: a flashing arrow at the next
   * objective — bobbing above it when on-screen, or pinned to the screen edge
   * pointing the way when it's off-screen. The quest tracker says what to do;
   * this says where.
   */
  private drawTutorialArrow(now: number): void {
    const t = this.tutorialTarget();
    if (!t) return;
    const sx = t.x * TILE + TILE / 2 - this.cam.x;
    const sy = t.y * TILE + TILE / 2 - this.cam.y;
    // This draws under the zoom transform, so work in logical (world) view px.
    const W = this.viewW, H = this.viewH;
    const m = 48; // edge inset
    const flash = 0.5 + 0.5 * Math.sin(now / 180); // the "flashing"
    const onScreen = sx >= 0 && sx <= W && sy >= 0 && sy <= H;
    this.g.save();
    this.g.globalAlpha = 0.45 + 0.55 * flash;
    this.g.fillStyle = "#f2cf6b";
    this.g.strokeStyle = "rgba(0,0,0,0.55)";
    this.g.lineWidth = 1.5;
    if (onScreen) {
      const bob = Math.sin(now / 240) * 5;
      this.tri(sx, sy - TILE * 0.95 + bob, Math.PI / 2, 13); // points down at it
    } else {
      const ang = Math.atan2(sy - H / 2, sx - W / 2);
      const ex = Math.max(m, Math.min(W - m, sx));
      const ey = Math.max(m, Math.min(H - m, sy));
      this.tri(ex, ey, ang, 17); // points toward the off-screen target
    }
    this.g.restore();
  }

  /** A filled triangle at (x,y) pointing along `ang`. */
  private tri(x: number, y: number, ang: number, size: number): void {
    this.g.save();
    this.g.translate(x, y);
    this.g.rotate(ang);
    this.g.beginPath();
    this.g.moveTo(size, 0);
    this.g.lineTo(-size * 0.7, -size * 0.75);
    this.g.lineTo(-size * 0.7, size * 0.75);
    this.g.closePath();
    this.g.fill();
    this.g.stroke();
    this.g.restore();
  }

  /** The tile the next objective sits on, while still hand-holding (else null). */
  private tutorialTarget(): { x: number; y: number } | null {
    const { state, content } = this.bridge;
    const player = state.player;
    if (player.questsDone.length >= 2) return null; // only the first couple of tasks

    const activeId = Object.keys(player.quests)[0];
    if (activeId) {
      const def = content.quests.find((q) => q.id === activeId);
      const st = player.quests[activeId];
      const step = def && st ? def.steps[st.step] : undefined;
      if (step) {
        const s = step as { type: string; npc?: string; monster?: string; item?: string };
        if ((s.type === "talk" || s.type === "deliver" || s.type === "choice") && s.npc) {
          return this.objTile(s.npc);
        }
        if (s.type === "kill" && s.monster) return this.nearestMonster(s.monster);
        if (s.type === "gather" && s.item) return this.gatherTarget(s.item);
        return null; // "reach a skill level" has nowhere to point
      }
    }
    // Not started yet: point to whoever offers the opening quest.
    const offer = content.quests.find(
      (q) =>
        q.giver && !player.quests[q.id] && !player.questsDone.includes(q.id) &&
        (!q.requires || player.questsDone.includes(q.requires)) &&
        (!q.requiresFlags || q.requiresFlags.every((f) => player.flags.includes(f))),
    );
    return offer?.giver ? this.objTile(offer.giver) : null;
  }

  private objTile(id: string): { x: number; y: number } | null {
    const def = this.bridge.content.objects.find((o) => o.id === id);
    return def ? objectPos(def, this.bridge.state.objects[id]) : null;
  }

  private nearestMonster(monster: string): { x: number; y: number } | null {
    const p = this.bridge.state.player.pos;
    let best = Infinity, found: { x: number; y: number } | null = null;
    for (const o of this.bridge.content.objects) {
      if (o.kind !== "monster" || o.monster !== monster) continue;
      if (!this.bridge.state.objects[o.id]?.available) continue;
      const op = objectPos(o, this.bridge.state.objects[o.id]);
      const d = (op.x - p.x) ** 2 + (op.y - p.y) ** 2;
      if (d < best) { best = d; found = op; }
    }
    return found;
  }

  /** Where to get a gathered/made item: a resource node, a station, or (last) a monster. */
  private gatherTarget(item: string): { x: number; y: number } | null {
    const { state, content } = this.bridge;
    const p = state.player.pos;
    const nearestOf = (pred: (o: typeof content.objects[number]) => boolean): { x: number; y: number } | null => {
      let best = Infinity, found: { x: number; y: number } | null = null;
      for (const o of content.objects) {
        if (!pred(o)) continue;
        const op = objectPos(o, state.objects[o.id]);
        const d = (op.x - p.x) ** 2 + (op.y - p.y) ** 2;
        if (d < best) { best = d; found = op; }
      }
      return found;
    };
    // 1) A resource node that yields the item directly (mine/chop/fish/snare).
    const node = nearestOf((o) => {
      if (!o.resource) return false;
      return content.actions.find((a) => a.id === o.resource)?.produces === item;
    });
    if (node) return node;
    // 2) A station whose recipes make the item (smelt at a furnace, etc.).
    const kinds: ObjKind[] = ["furnace", "anvil", "fire", "cauldron", "workbench", "crafting_table", "sawmill"];
    const kind = kinds.find((k) => this.bridge.stationRecipes(k).some((a) => a.produces === item));
    if (kind) { const st = nearestOf((o) => o.kind === kind); if (st) return st; }
    // 3) Otherwise it's a drop — point at the nearest creature.
    return nearestOf((o) => o.kind === "monster" && !!state.objects[o.id]?.available);
  }

  /** A "!" over an NPC with a quest to give, or "?" when one's ready to hand in. */
  private drawQuestMarkers(now: number): void {
    const player = this.bridge.state.player;
    const quests = this.bridge.content.quests;
    const have = (id: string): number =>
      player.inventory.reduce((n, s) => (s?.item === id ? n + s.qty : n), 0);

    for (const obj of this.bridge.content.objects) {
      if (obj.kind !== "npc") continue;
      let mark: "!" | "?" | null = null;

      // Ready to act here: any active quest whose current step targets THIS NPC
      // (the core advances steps at the targeted NPC, not only the giver).
      for (const id of Object.keys(player.quests)) {
        const def = quests.find((q) => q.id === id);
        if (!def) continue;
        const step = def.steps[player.quests[id]!.step];
        if (!step) continue;
        if (step.type === "talk" && step.npc === obj.id) mark = "?";
        else if (step.type === "choice" && step.npc === obj.id) mark = "?";
        else if (step.type === "deliver" && step.npc === obj.id && have(step.item) >= step.count) {
          mark = "?";
        }
      }
      // Otherwise: a new quest available here (mirrors the core's gating so a
      // flag-locked quest doesn't show a false "!").
      if (!mark) {
        const offer = quests.find(
          (q) =>
            q.giver === obj.id &&
            !player.quests[q.id] &&
            !player.questsDone.includes(q.id) &&
            (!q.requires || player.questsDone.includes(q.requires)) &&
            (!q.requiresFlags || q.requiresFlags.every((f) => player.flags.includes(f))) &&
            (!q.blockedByFlags || !q.blockedByFlags.some((f) => player.flags.includes(f))),
        );
        if (offer) mark = "!";
      }
      if (!mark) continue;

      const mp = objectPos(obj, this.bridge.state.objects[obj.id]);
      const { x: cx, y: cy } = this.toScreen(mp.x, mp.y);
      const bob = Math.sin(now / 280) * 3;
      const my = cy - TILE * 0.85 + bob;
      this.g.font = "bold 20px 'Cinzel', serif";
      this.g.textAlign = "center";
      this.g.fillStyle = "rgba(0,0,0,0.6)";
      this.g.fillText(mark, cx + 1, my + 1);
      this.g.fillStyle = mark === "!" ? "#f2cf6b" : "#cde0a0";
      this.g.fillText(mark, cx, my);
    }
    this.g.textAlign = "left";
  }

  /**
   * Screen-edge red vignette: a quick flash when the player is hit, plus a
   * steady pulse while HP is critically low — so danger reads even with eyes
   * on the fight, not the HP bar. Drawn in device space over the whole canvas.
   */
  private drawHurtVignette(now: number): void {
    const player = this.bridge.state.player;
    const lowFrac = player.maxHp > 0 ? player.hp / player.maxHp : 1;
    const FLASH = 420;
    const flashAge = now - this.hurtFlash;
    const flash = flashAge >= 0 && flashAge < FLASH ? 1 - flashAge / FLASH : 0;
    // Steady danger pulse below 25% HP (and only while alive).
    const low = player.hp > 0 && lowFrac < 0.25 ? (1 - lowFrac / 0.25) : 0;
    const pulse = low > 0 ? 0.5 + 0.5 * Math.sin(now / 220) : 0;
    const alpha = Math.min(0.6, flash * 0.5 + low * pulse * 0.32);
    if (alpha <= 0.01) return;

    const g = this.g;
    const w = this.canvas.width, h = this.canvas.height;
    const grad = g.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.32,
      w / 2, h / 2, Math.max(w, h) * 0.62,
    );
    grad.addColorStop(0, "rgba(150,12,12,0)");
    grad.addColorStop(1, `rgba(150,12,12,${alpha.toFixed(3)})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }

  /**
   * A dark "knocked out" curtain while the player is down, with the seconds
   * left until they wake. Fades in fast and out as they respawn.
   */
  private drawDeathOverlay(now: number): void {
    const player = this.bridge.state.player;
    if (player.alive) return;
    const g = this.g;
    const w = this.canvas.width, h = this.canvas.height;
    g.fillStyle = "rgba(8,4,4,0.68)";
    g.fillRect(0, 0, w, h);
    const secs = Math.max(0, Math.ceil((player.respawnAt - now) / 1000));
    const px = (n: number): number => n * this.dpr;
    g.save();
    g.textAlign = "center";
    g.fillStyle = "#e2483a";
    g.font = `700 ${px(30)}px "Cinzel", serif`;
    g.fillText("Knocked out", w / 2, h / 2 - px(8));
    g.fillStyle = "#cdbfae";
    g.font = `${px(15)}px "EB Garamond", serif`;
    g.fillText(secs > 0 ? `Waking in ${secs}…` : "Waking…", w / 2, h / 2 + px(22));
    g.restore();
  }

  /** Short radiating impact bursts on the worked tile (chips, sparks, splash). */
  private drawSparks(now: number): void {
    const LIFE = 300;
    this.sparks = this.sparks.filter((s) => now - s.born < LIFE);
    const g = this.g;
    for (const s of this.sparks) {
      const t = (now - s.born) / LIFE;
      const cx = s.x * TILE + TILE / 2 - this.cam.x;
      const cy = s.y * TILE + TILE / 2 - this.cam.y;
      g.globalAlpha = 1 - t;
      g.strokeStyle = s.color;
      g.lineWidth = 2;
      const reach = 4 + t * 12;
      for (let i = 0; i < s.n; i++) {
        // Stable per-shard angle so a given burst doesn't jitter frame to frame.
        const a = (i / s.n) * Math.PI * 2 + (s.born % 6);
        const dx = Math.cos(a), dy = Math.sin(a);
        g.beginPath();
        g.moveTo(cx + dx * (reach - 4), cy + dy * (reach - 4));
        g.lineTo(cx + dx * reach, cy + dy * reach);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }

  private drawFloats(now: number): void {
    const LIFE = 900;
    this.floats = this.floats.filter((f) => now - f.born < LIFE);
    for (const f of this.floats) {
      const t = (now - f.born) / LIFE;
      const px = f.x * TILE + TILE / 2 - this.cam.x;
      const py = f.y * TILE + TILE / 2 - this.cam.y - t * 22;
      this.g.globalAlpha = 1 - t;
      this.g.font = `bold ${f.size ?? 16}px 'Cinzel', serif`;
      this.g.textAlign = "center";
      this.g.fillStyle = "rgba(0,0,0,0.7)";
      this.g.fillText(f.text, px + 1, py + 1);
      this.g.fillStyle = f.color;
      this.g.fillText(f.text, px, py);
      this.g.globalAlpha = 1;
    }
    this.g.textAlign = "left";
  }

  // --- Input -------------------------------------------------------------

  private tileAtScreen(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: Math.floor((sx / this.zoom + this.cam.x) / TILE),
      y: Math.floor((sy / this.zoom + this.cam.y) / TILE),
    };
  }

  private onPointerDown(e: PointerEvent): void {
    e.preventDefault();

    // Track touch points for pinch-to-zoom. A second finger cancels any pending
    // tap and starts a pinch instead.
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size >= 2) {
      this.press = null;
      this.clearLongTimer();
      this.pinchDist = this.currentPinchDist();
      return;
    }

    // A tap closes / advances dialogue first; no menu while talking.
    if (this.dialogue.isOpen()) {
      this.dialogue.advance();
      return;
    }
    if (this.menu.isOpen() || this.bank.isOpen() || this.shop.isOpen() || this.bounty.isOpen() || this.worldMap.isOpen()) return;

    const tile = this.tileAtScreen(e.clientX, e.clientY);
    this.press = {
      startX: e.clientX,
      startY: e.clientY,
      tile,
      longFired: false,
      moved: false,
    };

    // Right-click opens the menu immediately; touch/left-click waits for a hold.
    if (e.button === 2) {
      this.openMenu(e.clientX, e.clientY, tile);
      this.press.longFired = true;
      return;
    }
    this.longTimer = window.setTimeout(() => {
      if (this.press && !this.press.moved) {
        this.press.longFired = true;
        this.openMenu(e.clientX, e.clientY, tile);
      }
    }, LONG_PRESS_MS);
  }

  private onPointerMove(e: PointerEvent): void {
    // Pinch-to-zoom: with two fingers down, the change in their spacing scales.
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size >= 2) {
      const d = this.currentPinchDist();
      if (this.pinchDist > 0 && d > 0) this.setZoom(this.zoom * (d / this.pinchDist));
      this.pinchDist = d;
      return;
    }
    if (!this.press) return;
    const dx = e.clientX - this.press.startX;
    const dy = e.clientY - this.press.startY;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
      this.press.moved = true;
      this.clearLongTimer();
    }
  }

  private onPointerUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    // Lifting one finger mid-pinch shouldn't fire a tap.
    if (this.pointers.size >= 1 && !this.press) return;
    this.clearLongTimer();
    const press = this.press;
    this.press = null;
    if (!press || press.longFired || press.moved) return;
    this.defaultAction(press.tile, press.startX, press.startY);
  }

  /** Distance between the first two active touch points (0 if fewer than two). */
  private currentPinchDist(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
  }

  private clearLongTimer(): void {
    if (this.longTimer !== null) {
      window.clearTimeout(this.longTimer);
      this.longTimer = null;
    }
  }

  /** A plain tap: do the obvious thing for whatever was under the finger. */
  private defaultAction(tile: Vec2, sx: number, sy: number): void {
    const obj = this.objectAt(tile);
    const st = obj ? this.bridge.state.objects[obj.id] : undefined;
    // A felled monster's body lingers on its tile while it respawns; don't try to
    // re-attack it — let loot there be picked up instead.
    const deadMonster = obj?.kind === "monster" && !!st && !st.available;
    if (obj && !deadMonster) {
      // A shopkeeper offers a choice — Talk or Shop — rather than one or the other.
      if (obj.kind === "npc" && this.isShopkeeper(obj.id)) {
        this.shopkeeperMenu(obj, sx, sy);
        return;
      }
      this.interactObject(obj.id, this.liveTile(obj));
      return;
    }
    if (this.groundAt(tile)) { this.pickupAt(tile); return; }
    this.walkTo(tile);
  }

  /** Is there loot on this tile? */
  private groundAt(tile: Vec2): boolean {
    return this.bridge.state.ground.some((g) => g.x === tile.x && g.y === tile.y);
  }

  /** Walk to the loot tile (if needed) and pick it up on arrival. */
  private pickupAt(tile: Vec2): void {
    const player = this.bridge.state.player;
    const near =
      Math.max(Math.abs(Math.round(player.pos.x) - tile.x), Math.abs(Math.round(player.pos.y) - tile.y)) <= 1;
    if (near) {
      this.dispatch({ type: "PICKUP", x: tile.x, y: tile.y });
      this.pickupTarget = null;
      return;
    }
    const { path, reachable } = pathToAdjacent(this.bridge.walkable, player.pos, tile);
    if (!reachable) { this.hud.log("You can't reach that."); return; }
    this.setMarker(tile);
    this.pickupTarget = { x: tile.x, y: tile.y };
    if (path.length) this.dispatch({ type: "MOVE", path });
  }

  /** Each frame: if we're walking to loot and have arrived, grab it. */
  private checkPickup(): void {
    const t = this.pickupTarget;
    if (!t) return;
    const p = this.bridge.state.player;
    const near = Math.max(Math.abs(Math.round(p.pos.x) - t.x), Math.abs(Math.round(p.pos.y) - t.y)) <= 1;
    if (near) {
      this.dispatch({ type: "PICKUP", x: t.x, y: t.y });
      this.pickupTarget = null;
    } else if (p.path.length === 0) {
      this.pickupTarget = null; // stopped short — give up
    }
  }

  private openMenu(screenX: number, screenY: number, tile: Vec2): void {
    const obj = this.objectAt(tile);
    const items: MenuItem[] = [];
    let title: string;
    let description: string;

    if (obj) {
      title = obj.name;
      description = this.examineObject(obj); // shown as the inspect line
      if (obj.kind === "npc" && this.isShopkeeper(obj.id)) {
        // Shopkeepers list both Talk and Shop.
        items.push({
          label: "Talk to", target: obj.name, tone: "action",
          onSelect: () => this.interactObject(obj.id, this.liveTile(obj), "talk"),
        });
        items.push({
          label: "Shop with", target: obj.name,
          onSelect: () => this.interactObject(obj.id, this.liveTile(obj), "shop"),
        });
      } else {
        items.push({
          label: VERB[obj.kind],
          target: obj.name,
          tone: "action",
          onSelect: () => this.interactObject(obj.id, this.liveTile(obj)),
        });
      }
      items.push({
        label: "Walk here",
        onSelect: () => this.walkBeside(this.liveTile(obj)),
      });
    } else {
      title = "Ground";
      description = EXAMINE_TILE[this.tileType(tile)];
      if (this.bridge.walkable(tile.x, tile.y)) {
        items.push({
          label: "Walk here",
          tone: "action",
          onSelect: () => this.walkTo(tile),
        });
      }
    }

    // Loot on the tile is always grabbable, listed first (even under a creature).
    const loot = this.bridge.state.ground.filter((g) => g.x === tile.x && g.y === tile.y);
    if (loot.length) {
      const first = this.bridge.content.items[loot[0]!.item].name;
      const target = loot.length > 1
        ? `${first} & more`
        : loot[0]!.qty > 1 ? `${loot[0]!.qty}× ${first}` : first;
      items.unshift({ label: "Pick up", target, tone: "action", onSelect: () => this.pickupAt(tile) });
    }

    this.menu.show(screenX, screenY, title, items, description);
  }

  private objectAt(tile: Vec2) {
    return this.bridge.content.objects.find((o) => {
      const p = objectPos(o, this.bridge.state.objects[o.id]);
      return Math.round(p.x) === tile.x && Math.round(p.y) === tile.y;
    });
  }

  /** The creature/object's current tile (rounded), for pathing toward it. */
  private liveTile(obj: WorldObjectDef): Vec2 {
    const p = objectPos(obj, this.bridge.state.objects[obj.id]);
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  /** Examine text: a monster shows its canon description; others use the map. */
  private examineObject(obj: WorldObjectDef): string {
    if (obj.kind === "monster" && obj.monster) {
      const stats = this.bridge.content.monsters[obj.monster];
      if (stats) return `${stats.desc} Combat level ${stats.level}. ${this.weaknessNote(stats)}`;
    }
    if (obj.kind === "tree" && obj.species && EXAMINE_TREE[obj.species]) {
      return EXAMINE_TREE[obj.species]!;
    }
    if (obj.kind === "shrine" && obj.lines?.[0]) return obj.lines[0];
    if (obj.kind === "npc") return `${obj.name}, met on the road.`;
    return EXAMINE_OBJECT[obj.kind];
  }

  /** A plain-English line telling the player what a monster is weak to. */
  private weaknessNote(stats: MonsterStats): string {
    const labels: Record<string, string> = {
      slash: "slashing", stab: "stabbing", crush: "crushing", ranged: "ranged",
    };
    const w = (stats.weakness ?? []).map((s) => labels[s] ?? s);
    if (w.length === 0) return "It has no obvious weakness.";
    const list = w.length === 1 ? w[0] : `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}`;
    return `Weak to ${list} attacks.`;
  }

  private tileType(tile: Vec2): TileType {
    const m = this.bridge.state.map;
    if (tile.x < 0 || tile.y < 0 || tile.x >= m.width || tile.y >= m.height) {
      return "grass";
    }
    return m.tiles[tile.y * m.width + tile.x]!;
  }

  private setMarker(tile: Vec2): void {
    this.marker = { x: tile.x, y: tile.y, born: performance.now() };
  }

  private walkTo(tile: Vec2): void {
    const player = this.bridge.state.player;
    if (!this.bridge.walkable(tile.x, tile.y)) {
      this.hud.log("You can't walk there.");
      return;
    }
    const path = findPath(this.bridge.walkable, player.pos, tile);
    if (path.length === 0) return; // already there, or unreachable
    this.setMarker(tile);
    this.dispatch({ type: "MOVE", path });
  }

  /**
   * Walk toward a tile picked on the minimap or world map. The exact tile might
   * be water/wall/off-map, so snap to the nearest walkable tile and path there.
   */
  walkToWorldTile(tile: Vec2): void {
    const target = this.nearestWalkable(tile);
    if (!target) {
      this.hud.log("You can't walk there.");
      return;
    }
    const path = findPath(this.bridge.walkable, this.bridge.state.player.pos, target);
    if (path.length === 0) {
      this.hud.log("There's no path there from here.");
      return;
    }
    this.setMarker(target);
    this.dispatch({ type: "MOVE", path });
  }

  /** The walkable tile nearest a target (spiral search, capped). */
  private nearestWalkable(tile: Vec2): Vec2 | null {
    const tx = Math.round(tile.x), ty = Math.round(tile.y);
    if (this.bridge.walkable(tx, ty)) return { x: tx, y: ty };
    for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring only
          const x = tx + dx, y = ty + dy;
          if (this.bridge.walkable(x, y)) return { x, y };
        }
      }
    }
    return null;
  }

  private walkBeside(tile: Vec2): void {
    const player = this.bridge.state.player;
    const { path, reachable, alreadyAdjacent } = pathToAdjacent(
      this.bridge.walkable,
      player.pos,
      tile,
    );
    if (!reachable || alreadyAdjacent) return;
    this.setMarker(path[path.length - 1] ?? tile);
    this.dispatch({ type: "MOVE", path });
  }

  private interactObject(objId: string, tile: Vec2, mode?: "talk" | "shop"): void {
    const player = this.bridge.state.player;
    const { path, reachable } = pathToAdjacent(
      this.bridge.walkable,
      player.pos,
      tile,
    );
    if (!reachable) {
      this.hud.log("You can't reach that.");
      return;
    }
    this.setMarker(tile);
    this.tapFlash = { objId, born: performance.now() };
    this.dispatch({ type: "INTERACT", objId, path, ...(mode ? { mode } : {}) });
  }

  /** Is this NPC a shopkeeper (so a tap offers Talk vs Shop)? */
  private isShopkeeper(id: string): boolean {
    return this.bridge.content.shops.some((s) => s.npc === id);
  }

  /** The Talk / Shop / Walk menu for a shopkeeper, at screen (sx, sy). */
  private shopkeeperMenu(obj: WorldObjectDef, sx: number, sy: number): void {
    const tile = this.liveTile(obj);
    this.menu.show(sx, sy, obj.name, [
      { label: "Talk to", target: obj.name, tone: "action", onSelect: () => this.interactObject(obj.id, tile, "talk") },
      { label: "Shop with", target: obj.name, onSelect: () => this.interactObject(obj.id, tile, "shop") },
      { label: "Walk here", onSelect: () => this.walkBeside(tile) },
    ], this.examineObject(obj));
  }
}

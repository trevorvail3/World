# Varath World — Canon Transfer Ledger

The single source of truth for porting the **Varath idle game** (`varath_21.html`,
~19,400 lines) into this spatial world game. Every datum the idle game defines is
listed here with a destination and a status, so nothing is invented and nothing is
lost. The World Bible (`Varath_World_Bible.md`) governs lore, names, and zone layout.

> This file is a **tracker**, not a copy. The literal data (every item id, every
> recipe number) lives in `src/content/`. This ledger records *what exists, where it
> goes, and whether it's done.*

## Transfer decisions (locked)

1. **Registries first.** Port the global registries — Skills, Items, XP curve,
   Recipes, Combat — in full *before* building zones on top of them. Some data sits
   unused until its zone exists; that's accepted.
2. **Faithful but re-tuned.** Item ids, display names, descriptions, gear stats,
   drop tables, level requirements, and the tier ladders are copied **exactly**.
   Only *pacing* numbers — action timers, XP-per-action, respawn delays — are
   re-tuned so a walk-around game doesn't feel idle-slow. Every re-tune is noted in
   the relevant content file.
3. **Three rules still hold.** Content is data (`src/content/`), the core stays pure,
   the client only sends intents. Porting = filling in data + small core extensions.

## Status legend

- ✅ done · 🟡 in progress · ⬜ to do · ⏭️ deferred (needs design / later phase) ·
  ❌ won't port (doesn't fit a spatial game)

---

## Phase 1 — Global registries

### 1a. Skills  ⬜
Source: `SKILLS` (line ~3383), `COMBAT_SKILLS` (~3766), `SKILL_ORDER`/`ALL_SKILLS`.
Dest: `src/content/skills.ts`, `src/core/types.ts` (SkillId union).

| skill | id | type | have? |
|---|---|---|---|
| Mining | `mining` | gather | ✅ |
| Smithing | `smithing` | process | ✅ |
| Forestry | `forestry` | gather | ✅ |
| Fishing | `fishing` | gather | ✅ |
| Cooking | `cooking` | process | ✅ |
| Hunter | `hunter` | gather | ⬜ |
| Woodcraft | `woodcraft` | process | ⬜ |
| Farming | `farming` | farming | ⏭️ (needs patch system) |
| Survivalist | `survivalist` | process | ⬜ |
| Herblore | `herblore` | process | ⬜ |
| Construction | `construction` | process | ⏭️ (needs build sites) |
| Crafting | `crafting` | process | ⬜ |
| Bounty | `bounty` | task | ⏭️ (needs task UI) |
| Vitality | `vitality` | combat | ✅ |
| Edge | `edge` | combat | ✅ |
| Vigour | `vigour` | combat | ✅ |
| Ward | `ward` | combat | ⬜ (defence; needs combat hook) |
| Draw | `draw` | combat | ⬜ (ranged; needs bows) |

### 1b. XP curve & gates  ✅ (verify)
Source: `XP_TABLE` (~2226). `LEVEL_CAP=110`, anchor 15,000,000 XP at L100.
Dest: `src/content/xpCurve.ts`. **Already matches** — confirm formula parity, then ✅.
Gate tables to port: `GEAR_TIER_REQS` `[0,1,10,20,30,40,50,55,60,65,72]` (~13201),
zone `minCombat` (Spine 25 / Heartmoor 45 / Marrow 65 / Redrun 85).

### 1c. Items registry  ⬜
Source: `ITEMS` (~2272–2835) + `GOLD_VALUES` (~2839). Dest: `src/content/items.ts`,
`src/core/types.ts` (ItemId), `src/client/itemColors.ts`.
Copy ids/names/descriptions/stats **exactly**. Add a `sell` value field (new).

| group | count (approx) | notes | status |
|---|---|---|---|
| Ores | 9 | knucklestone→voidstone + silica, embercite(flux), hearthite(drop-only) | ⬜ |
| Bars | 7 | smelt outputs | ⬜ |
| Logs | 8 | ashwood→deeproot | ⬜ |
| Raw fish | 6 | ashfin→eyeless_pike | ⬜ |
| Meat / hunter | ~9 | raw meats, hides, sinew, trophy | ⬜ |
| Hides / leathers | ~8 | raw_hide→master_leather | ⬜ |
| Herbs / foraged | ~20 | herbs ×12, forage ×8 | ⬜ |
| Seeds | ~18 | plant ×12, tree ×6 | ⏭️ (with farming) |
| Planks / construction | ~20 | planks, blocks, beams, frames | ⏭️ (with construction) |
| Glass / gems | ~6 | vial/bead/flask, rough/cut gem | ⬜ |
| Food: cooked fish/meat | ~14 | heal values quoted in inventory | ⬜ |
| Food: broths/smoked/meals | ~17 | heal + buff (buff needs core hook) | 🟡 (heals now, buffs later) |
| Potions (herblore) | ~20 | speed/combat/xp buffs | ⏭️ (buff system) |
| Melee weapons | ~50 | sword/dagger/spear/hammer/claymore ×10 tiers | ⬜ |
| Bows + arrows + tips | ~30 | ranged set | ⏭️ (with Draw) |
| Armour (body/helm/legs/boots/shield) | ~46 | def stats | ⬜ |
| Leather armour | ~16 | craftTier 1–4 ×4 slots | ⬜ |
| Jewellery | ~20 | rings/necklaces (acc/dmg/def) | ⬜ |
| Legendary boss gear | ~12 | dungeon drops, `lore` tag | ⬜ (with dungeons) |
| Tools (pickaxe/hatchet/rod) | ~16 | tier-gated, speed slots | ⬜ |
| Skilling gear sets | ~16 | Prospector/Lumberjack/Angler/Farmer | ⏭️ |
| Capes | ~20 | 18 skill capes + cape_max + charter | ⏭️ (gold sink) |
| Mounts | 30 | movement perks | ⏭️ (→ faster walking later) |
| Companion pets | ~17 | skilling + boss pets | ⏭️ |
| Quest items | ~25 | tokens, lore items, `shard_of_orun` | ⬜ (ids only now) |

### 1d. Recipes / actions  ⬜
Source: `SKILLS[*].actions` (~3383–3749). Dest: per-skill content files
(`src/content/processing.ts`, new `forestry.ts`, `mining.ts`, etc.).
Copy `levelReq`, `xp`, `requires`, `produces` **exactly**; **re-tune** `baseTime`.

| skill block | #actions | status |
|---|---|---|
| Mining | 9 | 🟡 (1 of 9) |
| Smithing (smelt + forge) | 54 | 🟡 (smelt 1, forge 4) |
| Forestry | 8 | 🟡 (1) |
| Hunter | 6 | ⬜ |
| Woodcraft | 36 | ⬜ |
| Fishing | 6 | 🟡 (1) |
| Cooking | 35 | 🟡 (3) |
| Survivalist | 13 | ⬜ |
| Herblore | 21 | ⏭️ |
| Construction | 18 | ⏭️ |
| Crafting | 27 | ⬜ |

### 1e. Combat registry  ⬜
Source: `MONSTERS` (~3801–4018), `DUNGEONS` (~4025). Dest: `src/content/monsters.ts`.
Copy level/hp/acc/def/maxHit/speed/xp/style/weakness + full drop tables **exactly**.
Re-tune only respawn/encounter pacing. Core needs: accuracy/defence/weakness combat
math (currently simplified), `ward` defence, attack styles.

| group | count | status |
|---|---|---|
| Open-world monsters | ~20 | 🟡 (moor_rat, hill_wolf) |
| Quest-only monsters | ~6 | ⬜ |
| Dungeon bosses | 4 | ⬜ |

---

## Phase 2 — The world, zone by zone

Each zone bundles a hand-built map + spawns (resources, monsters, fishing, NPCs,
landmarks). Bible §X gives implementation-ready landmark ids. Build in canon order.

| zone | id | gate | content | status |
|---|---|---|---|---|
| The Knuckle Hills | `knuckle_hills` | start | moor_rat, hill_wolf, ashfin fishing, knucklestone, ashwood | 🟡 (slice exists) |
| Greyoak Wood | `greyoak_wood` | — | wild_boar, forest_bear, coldpine/greyoak wood, boar/bear | ⬜ |
| The Spine | `spine` | cmb 25 | ridge_wolf, stone_crawler, troll, wraith; ashiron/ribstone | ⬜ |
| Heartmoor | `heartmoor` | cmb 45 | hounds, bog_knight, mire_serpent; hearthite, herbs | ⬜ |
| The Marrow Deeps | `marrow_deeps` | cmb 65 | crawlers, golems, wraiths; voidstone | ⬜ |
| The Redrun | `redrun` | cmb 85 | serpents, brigands, ancient_orc, ferryman; bloodore | ⬜ |
| The Ashfen Flats | `ashfen_flats` | — | embercite flux mining | ⬜ |
| Ironvale (home hub) | `ironvale` | start | bank, forge, archive, market, mending, NPCs | ⬜ |
| Dungeons ×4 | — | per-req | hollow_barrows, spine_vault, bog_barrow, marrow_vault | ⬜ |

---

## Phase 3 — Meta & narrative layers (after mechanics land)

| system | source | maps to spatial how | status |
|---|---|---|---|
| NPCs | `NPCS` (~7491) | placed characters in Ironvale/zones | ⬜ |
| Quests (~14, 3 acts) | `QUESTS` (~7504) | quest log + objectives + dialogue | ⏭️ |
| Factions (4) + reputation | `factionFlags` (~7142) | join/rep consequences | ⏭️ |
| Romance (3 NPCs) | `G.relationships` | affinity arcs | ⏭️ |
| Bounty system | `BOUNTY_*` (~3266) | kill-task board + Hunt Marks | ⏭️ |
| Backgrounds (20) | `BACKGROUNDS` (~3044) | character creation modifiers | ⏭️ |
| Achievements (34) | `ACHIEVEMENTS` (~6721) | progress tracking | ⏭️ |
| Merchant / shops | `MERCHANT_POOL` (~6784) | vendor NPC | ⬜ |
| Skill milestones | `SKILL_MILESTONES` (~6768) | level reward popups | ⬜ |

## Idle-only systems — reinterpret or drop  ❌/⏭️

These are core to an *idle* game but don't map 1:1 to a walk-around game. Decide per
item later; none block the registries or zones.

| system | source | call |
|---|---|---|
| Businesses + staff (20) | `BUSINESSES` (~5410) | ⏭️ reinterpret as owned buildings that yield passive resources |
| Offline progress | `applyOffline` (~13743) | ⏭️ optional lite version |
| Expeditions / House Members | (~16985) | ⏭️ later, as "send NPCs out" |
| House / Estate rooms | `HOUSE_ROOMS_UI` (~18507) | ⏭️ Mending House → auto-eat already conceptually here |
| Game modes (Adventure/Hardcore) | (~4714) | ⬜ a settings toggle |

---

## Source data location map (quick jump into `varath_21.html`)

```
2226 XP_TABLE/LEVEL_CAP   2258 TOOL_SPEEDS   2262 DESCENT_BANDS
2272 ITEMS (→2835)        2839 GOLD_VALUES   3017 CROPS   3044 BACKGROUNDS
3243 SURV_PASSIVES        3266 BOUNTY_*      3352 MASTER_CAPES
3383 SKILLS+actions(→3749) 3766 COMBAT_SKILLS 3787 AUTO_EAT_TIERS
3801 MONSTERS(→4018)      4025 DUNGEONS      4338 LOCATIONS
5109 MOUNT_PERKS 5139 MOUNT_IDS  5162 GATHERING_GEAR  5388 STAFF_TIERS
5410 BUSINESSES(→5711)    6721 ACHIEVEMENTS 6768 SKILL_MILESTONES 6784 MERCHANT
7491 NPCS  7504 QUESTS/DIALOGUE(→12208)  12306 GUILD_BADGES  12441 FISHING_LOCATIONS
13201 GEAR_TIER_REQS  13295 FORGE_COST/MASTERWORK  13743 applyOffline
13916 legacy-id migration maps  16985 House Members/expeditions
```

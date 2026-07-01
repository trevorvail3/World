# Faith — Magic + Prayer, fused (build spec)

A single skill that folds OSRS Prayer and Magic into one thing, built on Varath's
existing pieces: bones (drop from everything), shrines (dotted across the map),
gems, housing, and the Orun faith. This is the design contract for the first
shippable slice plus the roadmap beyond it.

## 1. The skill: Faith

- New `SkillId`: `"faith"`. Appears in the Skills tab like any other skill.
- Levels 1–100 on the standard xpCurve (level 100 = 12M XP).
- **Max Grace = current Faith level** (a level-70 caster has a 70-point pool).
- Trained two ways:
  1. **Fighting with a staff** — magic is a combat style, so damage dealt grants
     Faith XP (per-damage, like the other combat styles).
  2. **Burying bones** — a flat lump of Faith XP per bone, portable and anytime.

## 2. Grace (the resource)

- `player.grace` (current) — clamped to `[0, faithLevel]`.
- **Refills ONLY** by praying at an altar/shrine (free, fixed) or by drinking a
  **Faith Potion** (crafted, portable). Never regenerates in the field on its own.
- Bones do **not** refill Grace — they are XP only.
- Spent by casting spellbook spells. The basic staff bolt is **free**.

## 3. Staffs (the weapon — rod-style ladder)

- Wooden staff ladder, each a **2-handed mainhand weapon** (occupies the normal
  weapon slot, not a separate magic slot).
- New item flag `magic: true` (mirrors `ranged: true` for bows). Wielding a staff
  = your combat style is **magic** and your basic attack is a free magic bolt.
- Each tier is a **flat casting boost** (magic accuracy + max hit) — nothing tied
  to specific spells. Equip gated by Faith level, like rod tiers by Fishing.

| Staff            | Faith req | Boost |
|------------------|-----------|-------|
| Ashwood Staff    | 1         | +     |
| Coldpine Staff   | 15        | ++    |
| Stonewood Staff  | 30        | +++   |
| Greyoak Staff    | 45        | ++++  |
| Ruewood Staff    | 60        | +++++ |
| Deeproot Staff   | 75        | ++++++|

Sold by a staff vendor and/or craftable from the matching logs.

## 4. Combat triangle

Magic is the 4th style. Wielding a staff makes you `attackStyle: "magic"`.
- **Strong vs** heavy-armour melee foes; **weak vs** ranged/fast skirmishers.
- Enemies carry a magic weakness/resist entry like the other styles.
- Basic bolt damage scales with Faith level + staff boost + triangle multiplier.

## 5. Spellbook (one book, mixed)

Grace-fuelled specials layered on top of the free basic bolt. Faith-gated, each
with a Grace cost. Launch set:

| Spell         | Faith | Grace | Type    | Effect                                   |
|---------------|-------|-------|---------|------------------------------------------|
| Orun's Spark  | 1     | 3     | attack  | small burst on current target            |
| Mend          | 5     | 5     | utility | heal a chunk of HP                       |
| Emberbolt     | 20    | 6     | attack  | bigger burst, chance to burn             |
| Aegis         | 35    | 10    | utility | ~15s damage-reduction ward               |
| Wayfare       | 25    | 10    | utility | teleport to a known shrine               |
| Marrow Grip   | 45    | 8     | attack  | curse: lowers target defence briefly     |
| Kindle        | 40    | 4     | utility | superheat one ore in the pack into a bar |
| Enchant       | 50    | 8     | utility | set an uncut gem into a ring/amulet       |
| Orun's Wrath  | 70    | 20    | attack  | heavy nuke (finisher)                     |

## 6. Faith Potion (portable Grace refill)

- **Grind bones → Bonemeal** (a quick action).
- **Brew Bonemeal + herb + vial of water → Faith Potion** (Herblore path).
- Drinking restores a **chunk** of Grace (not full), anywhere.
- Ladder: Faith Potion (`bones`) small–medium; Greater Faith Potion
  (`big_bones`/`marrow_shard`) large. Brewing in a Glass Flask = more doses.
- Creates a real choice per bone pile: **bury for XP** vs **grind for potions**.

## 7. Gameplay loop

1. Kill & gather bones → split: bury some for XP, grind some into potions.
2. Upgrade your staff as Faith rises (rod-style).
3. Kneel at a shrine → fill Grace for free.
4. Adventure: staff bolt attacks free; spend Grace on spellbook specials; sip a
   Faith Potion to refill on the move when far from an altar.
5. Grace low → head back to a shrine, burying bones on the way. Repeat.

Two progression tracks (Faith level via bones+combat; staff tier via
shops/crafting) with Grace as the tactical layer on top.

---

## First slice (this batch)

Ships the core loop end-to-end:

- `faith` skill (skills.ts, xp curve, Skills tab).
- `magic: true` item flag + ~6 wooden staffs (2H weapons) gated by Faith level,
  buyable from a vendor.
- Magic combat style: wielding a staff routes combat XP to Faith and applies the
  magic triangle multiplier; basic bolt is free.
- `grace`/graceMax on the player (+ save/load), Grace bar in the HUD.
- Altar/shrine **Pray** interaction to refill Grace.
- Spellbook tab with the launch spells; implement the mechanically-simple,
  high-impact ones first: Orun's Spark, Emberbolt, Mend, Aegis, Wayfare.
- Bury bones (Faith XP) + grind bones → bonemeal + brew Faith Potion (restores
  Grace on the move).

Deferred to a follow-up: Marrow Grip curse, Kindle superheat, Enchant, Greater
Faith Potion, staff crafting recipes, magic-specific enemy resist tuning pass.

/**
 * src/content/lore.ts
 * -------------------
 * The found-lore fragments — the readable pages, grave-rubbings and old markers
 * scattered across Varath. Each one is revealed by reading a "relic" object in
 * the world (matched by loreId); finding it records the fragment in the Archive
 * tab and grants a small finder's reward.
 *
 * These deliberately deepen the world's central mystery WITHOUT settling it:
 * the Two, the Underloft dead, Orun's warm stone, the fall of Old Varath. The
 * voice is always a witness's — never the game's. Nothing here is stated as fact.
 */

import type { LoreDef } from "../core/types.ts";

export const lore: LoreDef[] = [
  // === THE TWO — the dueling gods before the world =========================
  {
    id: "lore_two_quarrel",
    title: "The Quarrel of the Two",
    category: "The Two",
    text: [
      "— copied from the scratch-marks worked into the Knuckle, by a hand that did not sign it —",
      "There were Two before there was a Before. They did not love and they did not hate; those came later, and from them. They only disagreed, the way a thing disagrees with its own reflection.",
      "One struck. One fell. And where the fallen one lies is the stone under your boots, the river at your back, the mountain at your north — his body, and it remembers being a god.",
      "The other did not strike again. She climbed into the cold and became the moon, and she watches, and she has never once said what the quarrel was about.",
    ],
    reward: { gold: 40 },
  },
  {
    id: "lore_two_moonwatch",
    title: "The Moon-Watcher's Verse",
    category: "The Two",
    text: [
      "— a verse cut into the wind-side of the Spine, the letters nearly gone —",
      "She does not blink. Mark that, if you mark nothing else.",
      "The faithful will tell you the mountain is Orun's back and the moon is his sister mourning him. The unfaithful will tell you it is a mountain and a moon. The verse only says: she watches, and she will not say what she did.",
      "A guilty thing watches. So does a grieving one. So does a guard. The verse does not choose for you.",
    ],
    reward: { gold: 60 },
  },
  {
    id: "lore_two_dreaming",
    title: "The Dead God Dreaming",
    category: "The Two",
    text: [
      "— found pressed flat in a niche above the Black Water, ink run almost to nothing —",
      "If the stone is a god's body, ask the question the priests will not: does it dream?",
      "I have set my ear to the deep walls of the Marrow and heard a sound that is not water and not wind. Slow. Patient. Like breathing, if you wanted very badly for it to be breathing.",
      "I wanted very badly. That is the trouble with this whole country. Everyone here wants very badly, and the stone is happy to oblige a want.",
    ],
    reward: { gold: 90 },
  },

  // === THE UNDERLOFT — the buried dead, and the worn coins =================
  {
    id: "lore_underloft_rite",
    title: "A Gravewright's Instruction",
    category: "The Underloft",
    text: [
      "— a torn page, the lettering older than Ironvale's charter —",
      "Lay the dead with a coin against the breast, and another in the closed hand, and a third beneath the tongue. Three: for the stone he came from, the road he walked, and the watcher he goes to answer.",
      "Strike the coins smooth first. A face on the coin is a name, and the dead are to go nameless to the watcher, so that she may not single them out.",
      "This is the Underloft way. We do not expect you to understand it. We expect you to do it.",
    ],
    reward: { gold: 50 },
  },
  {
    id: "lore_underloft_ferry",
    title: "The Ferryman's Toll",
    category: "The Underloft",
    text: [
      "— scratched on a dressed Underloft stone that surfaces in the Redrun at low water —",
      "They paid the dead's coins to the river, in the old days, and the river carried the dead down to the grey sea, and the grey sea kept them.",
      "Now the rats dig the coins up out of the hills and the river runs red and gives nothing back. Draw your own line between those two facts. The old fisher draws his. He will not say it aloud.",
      "A coin paid is a debt closed. A coin dug up again is a debt re-opened. That much, at least, every culture agrees on.",
    ],
    reward: { gold: 70 },
  },
  {
    id: "lore_underloft_bog",
    title: "What the Peat Kept",
    category: "The Underloft",
    text: [
      "— a cutter's note, left folded under a stone at the Peat Cuttings —",
      "Turned up a body in the black trench today, whole as the day it went down — leather skin, red hair, a coin still under the tongue. The bog keeps what it takes.",
      "His coin was not struck smooth. There is a face on it. Which means he went down NAMED, against all the Underloft rite — a punishment, or a warning, or a man his people wanted the watcher to find.",
      "I put him back. Some things you do not bring up into the light to sell. Calder would understand. The goblin would not.",
    ],
    reward: { gold: 80 },
  },

  // === ORUN & THE WARM STONE — the cult's god, the shards ==================
  {
    id: "lore_orun_catechism",
    title: "The Tender's Catechism",
    category: "Orun & the Warm Stone",
    text: [
      "— left beside a tended seam in the Ashfen, weighted with a warm black stone —",
      "Q. Why is the stone warm? A. Because the god is not dead, only fallen, and the fallen still bleed heat.",
      "Q. Then why do the miners say it is only rock? A. Because a true thing and a comforting thing can wear the same face. We do not argue with the miners. We out-wait them.",
      "Q. What do we owe the warmth? A. Witness. Not worship — witness. To stand in the discomfort and not look away. That is the whole of it.",
    ],
    reward: { gold: 55 },
  },
  {
    id: "lore_orun_heresy",
    title: "A Heresy, Half-Burned",
    category: "Orun & the Warm Stone",
    text: [
      "— the unburned half of a page, found at the False Seam —",
      "...and I say the warmth proves nothing. I have stood at a seam that gives off heat and no stone, dying or never real, and felt the same holy shiver the faithful feel. The shiver is in US. We bring it to the rock.",
      "The shards they call Orun's blood will cut you like glass and sell like gold and that is ALL I have ever seen one do. Let them burn this. The seam will go cold whether or not I am here to say so. That is rather my poin—",
    ],
    reward: { gold: 100 },
  },

  // === OLD VARATH — the fallen kingdom, the sealed Vaults ==================
  {
    id: "lore_varath_muster",
    title: "The Last Muster Roll",
    category: "Old Varath",
    text: [
      "— a soldier's tally, nailed inside the unfinished Watchtower frame —",
      "Names struck through are the dead. Names circled are the ones who walked into the Vaults under orders and did not walk out. There are more circles than strikes.",
      "We sealed the doors from the OUTSIDE, the records say. Every door I have found was sealed from the IN. Someone is lying, across a great distance of years, and I cannot tell whether it is the records or the doors.",
      "Ironvale builds walls again now. Against what, no one will write down. But a man does not raise a wall against a rumour. He raises it against a memory.",
    ],
    reward: { gold: 75 },
  },
  {
    id: "lore_varath_masons",
    title: "The Masons' Final Order",
    category: "Old Varath",
    text: [
      "— pressed from the tool-dressed Smooth Walls of the Marrow, where no living hand has worked —",
      "The order was: dress the stone, fit the door, and seal it after the last of us is within. We are not keeping a thing out. We are keeping a watch in.",
      "The marks we cut here are the same spine-shape that rides the Underloft coins. Sera believes this is the thread that ties the whole country together. She also believes it proves nothing, and she is right on both counts, and it costs her sleep.",
      "Whatever we were set to watch, we are watching it still. You felt the door let you pass. Ask yourself why a watch would open its own door — and to whom.",
    ],
    reward: { gold: 120 },
  },
];

# Founder's Pack — how it works, and how to wire Stripe

The Founder's Pack is a **one-time, cosmetic-only** supporter purchase. A founder
gets a pet (**The First Ember**), a cape (**Founder's Mantle**), and a gold
**Founder** name on the hiscores. It grants **no** XP, gold, gear stats, bank
space, or any gameplay advantage — the value is "I was here at the start," which
only holds if it never touches power or the leaderboards. Keep it that way.

## The three layers

1. **Entitlement — who is a founder** (per-account, server-authoritative).
   The truth lives in a Supabase `world_entitlements` row. `src/client/founder.ts`
   `loadFounderEntitlement()` reads it at login and caches the answer.
   Pre-Stripe, a `?founder=1` URL flag stands in so the pack can be tested — that
   dev override is the ONLY way to fake founder status today, and it should be
   removed (or left harmless — it's cosmetic) once Stripe is the source of truth.

2. **The flag — applied to the character.** In `src/main.ts` `boot()`, if the
   account is entitled the string `"founder"` is pushed onto `player.flags`
   (persists in the save automatically). The hiscore submit rides a `__founder`
   marker in the skills JSON, so a founder's gold name shows on the shared board
   with no board-schema change.

3. **The claim — handing over the cosmetics** (once). `maybeShowFounderClaim()`
   shows the one-time "Founder's Cache" window; its button fires the
   `FOUNDER_CLAIM` intent, and `claimFounder()` in `worldCore.ts` grants the
   items (bank-safe, never duplicated) and sets a `"founder_claimed"` flag.

## Testing it now (no Stripe needed)

Open the game with `?founder=1`:

    https://your-site/?founder=1

Sign in (or play offline), and the Founder's Cache window appears on entering the
world. Claim it — the Ember follows you, the Mantle is in your pack, and your
hiscores name turns gold with a Founder tag.

## Wiring Stripe (when you're ready)

You already have a Supabase project and a business account. The plumbing:

### 1. One SQL setup (Supabase → SQL Editor), run once

```sql
create table if not exists public.world_entitlements (
  user_id uuid primary key references auth.users(id),
  founder boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.world_entitlements enable row level security;

-- A player may READ their own entitlement row (so the client can check it).
drop policy if exists "entitlements_self_read" on public.world_entitlements;
create policy "entitlements_self_read" on public.world_entitlements
  for select to authenticated using (auth.uid() = user_id);
-- No insert/update policy: only the webhook (service_role) may WRITE, so a
-- player can never grant themselves founder status.
```

### 2. Stripe dashboard

- Create a **Product** "Varath Founder's Pack" with a **one-time Price** of $4.99.
- Add a **Checkout** link, or create sessions from a tiny endpoint. Pass the
  player's Supabase `user_id` as `client_reference_id` on the session so the
  webhook knows who paid.

### 3. A Supabase Edge Function as the webhook (~30 lines)

Subscribe to `checkout.session.completed`. On receipt, verify the Stripe
signature, read `client_reference_id` (the Supabase user id), and upsert:

```sql
insert into public.world_entitlements (user_id, founder)
values ($1, true)
on conflict (user_id) do update set founder = true, updated_at = now();
```

Use the **service_role** key inside the function (never in the browser). That's
the only server code the pack needs — the game already reads the row at login and
runs the claim.

### 4. Sell it in-game (later)

Add a "Support Varath" button somewhere quiet (Settings, or the title) that opens
the Stripe Checkout link for signed-in players. Non-founders see the offer;
founders see their status. (Not built yet — the item, claim and entitlement read
are all in place and waiting for this button + the webhook above.)

## Files

- `src/content/items.ts` — `pet_founder_wisp`, `cape_founder` (cosmetic, sell 0).
- `src/client/render.ts` — the Ember's art (`drawSkillPet` case).
- `src/client/gearLook.ts` — the Mantle's ember-orange (`capeColor`).
- `src/core/worldCore.ts` — `claimFounder()` + the `FOUNDER_CLAIM` intent.
- `src/client/founder.ts` — entitlement read + the claim window.
- `src/main.ts` — reads the entitlement at login, stamps the flag, shows the claim.
- `src/client/social.ts` / `hiscoresUI.ts` — the gold name + Founder tag.

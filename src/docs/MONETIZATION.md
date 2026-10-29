# MONETIZATION.md

## Moments ❤️

---

# 1. MONETIZATION PHILOSOPHY

Moments is built around **relationships, not individuals**.

So monetization must follow:

> One relationship = one shared experience = one subscription

No ads that break emotional flow. No aggressive paywalls.

---

# 2. CORE REVENUE MODEL

## Primary Model: Subscription (B2C2B Hybrid)

Each relationship unlocks premium together.

```text id="mon0"
Relationship = single billing unit
```

---

# 3. SUBSCRIPTION TIERS

---

## 3.1 Free Tier

Includes:

* basic chat
* limited moments (daily cap)
* basic activities
* simple calendar
* limited journal entries

Limitations:

* capped AI activity generation
* limited memory storage
* restricted wrapped features

---

## 3.2 Plus Tier (Paid)

Unlocks (what the app actually gates; keep the paywall's list in sync):

* unlimited moments (Free: 5 a day)
* your whole moments history (Free: the last 12)
* unlimited albums (Free: 3)
* unlimited games and conversations (new AI-made ones, made for the couple)
* live game nights with voice
* restoring a broken streak (within 24 hours)
* one plan for both partners

---

## 3.3 Premium Tier (Optional Expansion Later)

Adds:

* advanced wrapped yearly recap
* priority AI generation
* deeper personalization
* exclusive relationship themes
* enhanced memory timeline effects (subtle UI polish, not flashy)

---

# 4. PRICING STRATEGY

(Optimized for global + emerging markets)

---

## Current Pricing (one plan per relationship)

| Plan | Price | Trial | Shown |
|---|---|---|---|
| Yearly | $69.99/year ($5.83/month, $35 each, save 73%) | 7 days free | First, selected by default |
| Monthly | $9.99/month | none (starts today) | Second |
| Weekly | $4.99/week | $0.99 first week (paid intro offer) | Third |

* One introductory offer per person across the group (Apple / Google rule): the yearly free trial
  or the weekly $0.99 first week. After that, plans start at full price.
* The trial includes everything in Plus, AI included. AI has a monthly fair-use cap for every
  Plus couple, trial or paid (200 games / 400 questions a month), enforced on the server
  (`server/src/billing.ts`).
* Win back: a one time discounted first year, from a second yearly product `yearly_winback` whose
  introductory offer is the discounted year (shown 3 days after the first paywall close; off until
  that product exists in the store).
* Source of truth in code: `src/constants/subscription.ts`. Store prices (local currency) replace
  the USD figures on the paywall.

## Where the paywall shows

1. End of onboarding (`/pro`), closable.
2. When the partner joins (once per couple, for the inviter).
3. At each free limit (`requirePlus`): daily moments, history, albums, streak restore, AI games.
4. After a 7+ day streak milestone.
5. Home reminder, at most once a week.
6. The win back offer (above).

Never before the partner can join, in chat, or mid game.

On the paywall: the billed price is always the largest number; "Not now" is always visible when it
can close; "Send it to {partner}" sends a `plus_suggest` notification that opens the paywall on
their phone. When either partner subscribes, the other gets `plus_unlocked` ("Sam unlocked Moments
Plus for you both") from the billing webhook. Logic: `src/components/layout/PaywallMoments.tsx`.

## Streak restore ($0.99 one-time purchase)

A lost streak can be restored for 5 days from the midnight it ended, then it's gone for good.

* Day 1: free with Plus. Free users choose between $0.99 now or Plus (restores free).
* Days 2 to 5: $0.99 for everyone, Plus included.
* Starting a new streak in those 5 days doesn't cancel the offer: restoring joins the old and new
  streaks, and the missed days are drawn covered (like a freeze).
* While it's open, the owner gets one evening reminder a day (in the app and as a push), with the
  days left and a "last day" message on day 5.
* Product: `streak_restore`, a consumable in App Store Connect and Google Play, added to Superwall.
  The webhook records each purchase (one row per store transaction, refunds remove an unused one)
  in `streak_restore_purchases`; restoring uses the oldest unused one. It never turns Plus on.

Regional adjustments (optional later):

* Africa pricing tier (lower entry cost)
* student discount plan (future)

---

# 5. PAYMENT INFRASTRUCTURE

Uses:

Superwall (`expo-superwall`): StoreKit 2 / Google Play Billing, entitlements, remote paywalls and
paywall experiments. No RevenueCat.

## How it fits together

* App: `src/lib/purchases.ts`. Identifies each person with Superwall by a UUID derived from their
  Clerk id (StoreKit only accepts a UUID as appAccountToken) and sets a `clerkUserId` attribute.
  Prices, purchase and restore go through Superwall. Entitlement: `unlimited`.
* Paywall: ours (`PaywallScreen`) by default. `EXPO_PUBLIC_PAYWALL=superwall` shows the dashboard
  paywall for the placement instead (`onboarding`, `settings`, `limit`, `moment`, `reminder`,
  `winback`), and falls back to ours when Superwall shows nothing.
* Server: `POST /webhooks/superwall` (`server/src/billing.ts`), signed with Svix. Maps the buyer back
  to the couple and writes Plus onto the relationship, so both partners unlock.
* Manage / cancel / refunds: the App Store or Play subscription page.
* Superwall has no Expo Go module: billing runs in development and store builds only.

## Setup checklist

1. Stores: subscriptions `weekly` (7 day trial), `yearly` (7 day trial), `monthly` in one
   subscription group; optional `yearly_winback`. Android ids in `PRODUCT_IDS` use
   `subscriptionId:basePlanId`.
2. Superwall: iOS + Android apps (bundle `com.vasemti.moments`), App Store Connect / Play service
   credentials, the products, and an entitlement `unlimited` on all of them.
3. App env: `EXPO_PUBLIC_SUPERWALL_IOS_API_KEY`, `EXPO_PUBLIC_SUPERWALL_ANDROID_API_KEY`
   (EAS environment variables for builds).
4. Webhook: Superwall > Integrations > Webhooks, URL `https://<api>/webhooks/superwall`, then
   `npx wrangler secret put SUPERWALL_WEBHOOK_SECRET` with its `whsec_…` secret.
5. Database: `npx wrangler d1 migrations apply moments-db --remote` (0011 adds `billing_user_id`).
6. Test with TestFlight / Play internal testing and sandbox accounts (StoreKit local test
   transactions don't send webhooks).

---

# 6. ENTITLEMENT MODEL

```text id="mon1"
free → plus → premium
```

Entitlements are tied to:

```text id="mon2"
relationship_id (NOT user_id)
```

---

# 7. PAYWALL STRATEGY

---

## 7.1 Soft Paywalls (Preferred)

User can still:

* view features
* preview content
* interact partially

But cannot:

* unlock full generation
* save unlimited content
* access full history

---

## 7.2 Hard Paywalls (Selective)

Only for:

* AI-heavy features
* wrapped yearly recap
* unlimited storage features

---

# 8. FEATURE MONETIZATION MAPPING

---

## 8.1 Free Tier Limits

| Feature    | Limit                              |
| ---------- | ---------------------------------- |
| Moments    | capped daily                       |
| Activities | limited generator usage            |
| Chat       | unlimited but no media heavy usage |
| Journal    | limited entries                    |
| Wrapped    | preview only                       |

---

## 8.2 Paid Unlocks

| Feature               | Unlock          |
| --------------------- | --------------- |
| AI Activity Generator | full            |
| Daily Challenges      | unlimited       |
| Mood Tracking History | full            |
| Memory Timeline       | full access     |
| Streak System         | full tracking   |
| Wrapped Yearly Recap  | full experience |

---

# 9. VIRAL GROWTH MONETIZATION LOOP

---

## 9.1 Relationship Lock-In

Once a couple joins:

> subscription becomes emotionally tied, not just functional

---

## 9.2 Streak Dependency

Streaks create:

* daily engagement
* emotional continuity
* retention-based revenue stability

---

## 9.3 Wrapped Effect

Yearly recap drives:

* emotional nostalgia
* re-subscription spikes
* social sharing (optional, private-first)

---

# 10. MARKETPLACE MONETIZATION (FUTURE OPTIONAL)

---

## Relationship Experiences Layer

You can monetize:

* restaurants
* hotels
* date experiences
* activities

---

## Revenue Models

### 1. Affiliate Commission

* booking links (hotels, restaurants)

### 2. Sponsored Experiences

* curated date ideas

### 3. Featured Listings

* premium placement for partners

---

⚠️ Must remain:

> subtle, non-intrusive, relationship-first

---

# 11. AI MONETIZATION

Uses:

Anthropic

---

## AI Cost Offset Strategy

AI features are expensive, so monetization supports:

* activity generation
* wrapped recap generation
* conversation cards

---

## AI Usage Limits:

* free tier capped requests
* paid tier expanded usage
* premium tier priority generation

---

# 12. CONVERSION STRATEGY

---

## 12.1 Trigger Points

Users are prompted to upgrade when:

* they hit memory limits
* they reach activity cap
* they attempt wrapped preview
* they use AI generator frequently

---

## 12.2 Emotional Conversion Design

Upgrade prompts must feel:

* contextual
* non-intrusive
* emotionally aligned

NOT:

* aggressive paywalls
* popups
* interruptions

---

# 13. RETENTION STRATEGY

---

Revenue depends on emotional continuity:

* streaks
* memories
* shared calendar events
* daily challenges

---

# 14. UNIT ECONOMICS MODEL

---

Revenue drivers:

* subscription per relationship
* AI usage cost control
* storage optimization
* low churn via emotional engagement

---

# 15. CORE MONETIZATION RULE

> Monetization must enhance connection, not interrupt it.

---

# END OF MONETIZATION.md

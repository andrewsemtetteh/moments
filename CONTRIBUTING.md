# CONTRIBUTING.md

## Moments ❤️

---

# 1. PURPOSE

This document defines how to contribute to Moments in a way that preserves:

* emotional design integrity
* relationship-first architecture
* production-grade code quality
* scalability and maintainability

---

# 2. CORE CONTRIBUTION PRINCIPLE

> Every contribution must improve the experience of two people in a relationship.

If a change does not serve that goal, it does not belong in the system.

---

# 3. DEVELOPMENT STACK

Contributors must follow the official stack:

## Frontend

* React Native (Expo)
* TypeScript
* Expo Router
* NativeWind
* Zustand
* TanStack Query

## Backend

* Supabase (Auth, DB, Storage, Realtime)
* Edge Functions

## Services

* RevenueCat (subscriptions)
* PostHog (analytics)
* Sentry (error tracking)
* Expo Notifications
* Resend (email)

---

# 4. PROJECT STRUCTURE RULES

```text id="c1"
app/
components/
stores/
services/
hooks/
utils/
supabase/
edge-functions/
docs/
```

---

# 5. CODE QUALITY STANDARDS

---

## 5.1 TypeScript First

* no plain JavaScript in production code
* strict typing required
* avoid `any`

---

## 5.2 Component Rules

* small, reusable components
* no “god components”
* UI logic separated from business logic

---

## 5.3 State Management Rules

* Zustand for local UI state
* TanStack Query for server state
* never duplicate server state in Zustand

---

# 6. UI/UX CONTRIBUTION RULES

---

## 6.1 Design Philosophy

All UI must follow:

* minimal
* emotional
* gesture-first
* non-addictive
* calm aesthetic

No:

* neon gradients
* aggressive animations
* social media clutter patterns

---

## 6.2 Interaction Rules

* gestures > buttons
* one primary action per screen
* thumb-zone friendly layout

---

# 7. BACKEND CONTRIBUTION RULES

---

## 7.1 Supabase Rules

* all tables must include `relationship_id`
* enforce Row Level Security (RLS)
* no global tables unless explicitly justified

---

## 7.2 Edge Function Rules

* must validate auth (`auth.uid()`)
* must validate relationship membership
* must fail fast on invalid input
* must not contain UI logic

---

## 7.3 Database Changes

All schema changes must:

* be versioned migrations
* include rollback strategy
* maintain backward compatibility where possible

---

# 8. SECURITY RULES

---

## Mandatory:

* no cross-relationship data access
* no public storage buckets
* no insecure token handling
* no bypassing RLS

Refer to SECURITY.md for full rules.

---

# 9. PERFORMANCE RULES

---

* all lists must be paginated
* avoid heavy synchronous processing
* use optimistic UI updates
* cache aggressively where safe

---

# 10. AI INTEGRATION RULES

If contributing AI features:

* must use Claude API only via Edge Functions
* must not expose prompts in frontend
* must sanitize inputs before sending to AI
* must never make emotional decisions for users

---

# 11. FEATURE CONTRIBUTION RULES

---

## 11.1 Before Adding a Feature

Ask:

* Does this strengthen relationships?
* Does this improve emotional connection?
* Does this reduce friction between users?

If no → reject feature.

---

## 11.2 Feature Scope Rule

Every feature must be:

* scoped to `relationship_id`
* usable by two users
* emotionally meaningful

---

# 12. COMMIT STANDARDS

---

## Format

```text id="c2"
type(scope): description
```

Examples:

* feat(chat): add message reactions
* fix(moments): resolve upload crash
* refactor(activities): optimize generator logic

---

# 13. BRANCHING STRATEGY

---

* main → production
* dev → integration
* feature/* → feature work
* fix/* → bug fixes

---

# 14. TESTING REQUIREMENTS

---

## Required Testing Areas:

* authentication flows
* relationship creation/joining
* chat realtime sync
* media uploads
* Edge Functions logic
* RLS enforcement

---

# 15. REVIEW CHECKLIST

Before merging:

* [ ] follows relationship-scoped model
* [ ] passes security rules
* [ ] no UI clutter introduced
* [ ] performance safe
* [ ] tested on mobile
* [ ] no broken realtime flows

---

# 16. DESIGN REVIEW RULE

UI changes must be reviewed for:

* emotional clarity
* gesture consistency
* simplicity
* accessibility

---

# 17. DOCUMENTATION RULE

Any new feature must update:

* FEATURES.md
* API.md (if backend involved)
* DATABASE_SCHEMA.md (if data involved)

---

# 18. CORE CONTRIBUTION RULE

> If it does not improve the relationship experience, it does not ship.

---

# END OF CONTRIBUTING.md

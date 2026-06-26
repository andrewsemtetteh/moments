# SECURITY.md

## Moments ❤️

---

# 1. SECURITY OVERVIEW

Moments is a **private relationship system**, meaning security is not optional — it is the foundation of trust between two users.

Core principle:

> No data in Moments is ever public. Everything is relationship-scoped.

---

# 2. THREAT MODEL

Moments must protect against:

## 2.1 Unauthorized Access

* users accessing relationships they are not part of
* token misuse
* session hijacking

---

## 2.2 Data Leakage

* cross-relationship data exposure
* insecure storage access
* broken RLS policies

---

## 2.3 Media Exposure Risks

* public access to private images/videos
* unprotected storage URLs

---

## 2.4 API Abuse

* spam message injection
* brute-force invites
* activity farming
* notification abuse

---

# 3. AUTHENTICATION SECURITY

---

## 3.1 Auth Provider

Uses:

Supabase Auth

Supported methods:

* Email login (magic link or password optional)
* Apple OAuth
* Google OAuth

---

## 3.2 Session Rules

* sessions stored securely in secure storage
* tokens automatically refreshed
* logout invalidates session locally

---

## 3.3 Account Protection

* optional email verification
* device-based session tracking (future)
* rate-limited login attempts

---

# 4. AUTHORIZATION MODEL (CRITICAL)

---

## 4.1 Relationship-Based Access Control

Every request must validate:

```text id="sec1"
user ∈ relationship(user_1_id, user_2_id)
```

---

## 4.2 No Cross-Relationship Access Rule

A user can NEVER:

* read another relationship’s data
* access another chat
* view another timeline
* query foreign moments

---

## 4.3 Enforcement Layers

Security is enforced at:

* PostgreSQL Row Level Security (PRIMARY)
* Edge Functions validation (SECONDARY)
* Client-side filtering (UX only, NOT security)

---

# 5. DATABASE SECURITY (RLS)

---

## 5.1 Core RLS Pattern

Applied to all tables:

```sql id="rls1"
USING (
  relationship_id IN (
    SELECT id FROM relationships
    WHERE user_1_id = auth.uid()
       OR user_2_id = auth.uid()
  )
)
```

---

## 5.2 Insert Rules

Users can only insert:

* into their own relationship_id
* as themselves (user_id must match auth.uid())

---

## 5.3 Update/Delete Rules

Users can:

* update their own messages/moments
* delete their own content (optional restrictions)

---

# 6. STORAGE SECURITY

---

Uses:

Supabase Storage

---

## 6.1 Bucket Isolation

Buckets:

```text id="st1"
moments/
chat/
journal/
profiles/
```

---

## 6.2 Signed URLs (MANDATORY)

* no public file access
* all media served via signed URLs
* expiration-based access control

---

## 6.3 Upload Rules

Uploads must include:

* relationship_id folder separation
* user_id ownership tagging

---

# 7. EDGE FUNCTION SECURITY

---

All Edge Functions must:

## 7.1 Validate Auth

```text id="sec2"
auth.uid() must exist
```

---

## 7.2 Validate Relationship Membership

Every request must verify:

* user belongs to relationship
* relationship is active

---

## 7.3 Rate Limiting

Edge Functions enforce Postgres-backed sliding-window limits via `consume_rate_limit` (service_role only):

| Function | Scope | Limit |
| --- | --- | --- |
| `generate-activity` | per user + per relationship | 20/day user, 40/day relationship |
| `generate-daily-challenge` | per relationship | 12/hour |
| `generate-quiz-live` | per relationship | 15/hour |
| `update-mood` | per user | 60/hour |
| `send-push-notification` | per user | 120/hour |

Exceeded limits return HTTP `429` (or a soft `rate_limited` flag for push dispatch).

---

# 8. REAL-TIME SECURITY

---

## 8.1 Channel Isolation

Realtime channels must be scoped:

```text id="rt1"
relationship:{id}:messages
relationship:{id}:moments
relationship:{id}:mood
```

---

## 8.2 Subscription Validation

Users can ONLY subscribe to:

* their own relationship channel

---

# 9. INVITE SYSTEM SECURITY

---

## 9.1 Invite Codes

* single-use or limited-use tokens
* expiration time enforced
* cryptographically random strings

---

## 9.2 Abuse Prevention

* rate limit invite creation
* prevent brute-force guessing
* invalidate used invites immediately

---

# 10. MEDIA SECURITY

---

## 10.1 Upload Validation

* file type restrictions (images, audio, video only)
* size limits enforced
* compression before storage

---

## 10.2 Content Access

* only relationship members can access media
* signed URLs expire automatically

---

# 11. CLIENT SECURITY

---

## 11.1 Sensitive Data Handling

Never store:

* raw auth tokens in unsafe storage
* unnecessary personal metadata
* unencrypted sensitive payloads

---

## 11.2 Secure Storage

Use:

* Expo SecureStore (or equivalent)
* encrypted local caching for session data

---

# 12. API SECURITY (EDGE FUNCTIONS)

---

## 12.1 Input Validation

All inputs must be validated:

* type checking
* length limits
* sanitization of text fields

---

## 12.2 Injection Protection

Prevent:

* SQL injection (via Supabase ORM only)
* JSON injection
* script injection in messages

---

# 13. NOTIFICATION SECURITY

---

## 13.1 Push Notification Rules

Only send notifications:

* to relationship members
* tied to valid events

---

## 13.2 Abuse Prevention

* no user-triggered spam notifications
* rate-limited triggers

---

# 14. PRIVACY MODEL

---

## 14.1 Data Ownership

Each user owns:

* their messages
* their journal entries
* their moments

But relationship visibility applies.

---

## 14.2 Data Visibility Rules

* everything is private by default
* nothing is publicly indexed
* no discoverability layer exists

---

## 14.3 Data Export

Users can export:

* messages
* moments
* journal entries
* calendar events

---

## 14.4 Account Deletion

Deletion must:

* remove user from relationship
* optionally delete all related data
* invalidate all sessions

---

# 15. COMPLIANCE REQUIREMENTS

---

## 15.1 App Store Requirements

Must include:

* Privacy Policy URL
* Terms of Service URL
* data deletion mechanism
* user consent flows

---

## 15.2 GDPR-Style Principles

* right to deletion
* right to data export
* minimal data collection
* purpose limitation

---

# 16. MONITORING & ALERTING

---

## 16.1 Error Tracking

Uses:

Sentry

Tracks:

* API failures
* auth failures
* realtime breakdowns
* storage errors

---

## 16.2 Analytics Monitoring

Uses:

PostHog

Tracks:

* feature usage
* engagement patterns
* drop-off points
* retention signals

---

# 17. CORE SECURITY RULE

> If data is not explicitly allowed within a relationship boundary, it must not exist.

---

# END OF SECURITY.md

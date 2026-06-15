@AGENTS.md

# CLAUDE.md

## Moments ❤️

---

# 1. PURPOSE

This file defines how Moments uses **Claude API (AI layer)** inside the system.

AI is not the product.

AI is a **silent engine that enhances relationship experiences**.

---

# 2. CORE PRINCIPLE

> AI must never replace human connection. It only enhances it.

AI is used for:

* suggestions
* generation
* summarization
* personalization

NOT:

* social control
* decision making
* emotional replacement

---

# 3. AI PROVIDER

Moments integrates:

Anthropic

Primary model:

* Claude (latest stable API model)

---

# 4. AI ARCHITECTURE POSITION

AI is ONLY used in:

```text id="ai1"
Edge Functions Layer
```

Flow:

```text id="ai2"
React Native App
      ↓
Supabase Edge Function
      ↓
Claude API (Anthropic)
      ↓
Response returned to app
```

---

# 5. AI FEATURES IN MOMENTS

---

## 5.1 Activity Generator

Generates:

* date ideas
* conversation prompts
* games
* indoor/outdoor plans
* budget-based ideas

Input signals:

* mood
* time available
* budget
* location (optional)

---

## 5.2 Daily Challenge Engine

AI generates:

* deep questions
* fun prompts
* emotional reflection tasks
* bonding exercises

Rule:

> must feel human-written, not AI-generated

---

## 5.3 Relationship Insights

AI summarizes:

* weekly interaction patterns
* mood trends
* activity participation
* communication balance

Output:

* short readable insights
* not analytics dashboards

---

## 5.4 Conversation Cards Generator

Generates:

* funny prompts
* deep questions
* romantic prompts
* future planning prompts

Must feel:

> natural, not algorithmic

---

## 5.5 Wrapped Generator

At end of year:

* summarizes relationship journey
* highlights memories
* emotional recap
* activity breakdown

---

# 6. AI INPUT DATA RULES

AI can ONLY access:

* moments (user-provided content)
* activities history
* mood logs
* calendar events
* journal entries (if shared)

AI MUST NOT access:

* unrelated personal data
* external contacts
* device-level data
* third-party private data

---

# 7. AI OUTPUT RULES

---

## 7.1 Tone Requirements

AI output must be:

* warm
* natural
* human-like
* emotionally intelligent
* non-robotic

---

## 7.2 Forbidden Output Styles

AI must NOT produce:

* overly formal language
* generic chatbot tone
* “As an AI model…” statements
* overly long explanations

---

## 7.3 Length Rules

Outputs should be:

* short by default
* expandable only when requested

---

# 8. EDGE FUNCTION AI PIPELINE

---

## Standard Flow

```text id="ai3"
User action
→ Edge Function
→ Data aggregation (Supabase)
→ Prompt construction
→ Claude API call
→ Response formatting
→ Return to app
```

---

## Example Function:

* generate-activity
* generate-daily-challenge
* generate-wrapped
* generate-conversation-cards

---

# 9. PROMPT DESIGN RULES

---

## 9.1 Prompt Structure

All prompts must include:

* relationship context
* mood context
* recent activity summary
* user intent

---

## 9.2 Prompt Safety Layer

Always enforce:

* no manipulation
* no emotional dependency reinforcement
* no harmful suggestions

---

# 10. AI SAFETY MODEL

---

## 10.1 Emotional Safety Rules

AI must NEVER:

* take sides in relationship conflict
* escalate emotional tension
* suggest breakups or harmful decisions
* simulate real emotional dependency

---

## 10.2 Neutrality Rule

AI acts as:

> facilitator, not judge

---

# 11. PERFORMANCE REQUIREMENTS

---

* AI response time target: < 2s–4s
* fallback response if timeout
* caching for repeated prompts
* async generation for non-critical tasks

---

# 12. COST CONTROL STRATEGY

---

## 12.1 AI Usage Limits

* limit per relationship per day
* batch low-priority AI requests
* cache repeated activity suggestions

---

## 12.2 Optimization Rules

* avoid unnecessary long prompts
* reuse context summaries
* compress historical data before sending

---

# 13. PERSONALIZATION ENGINE

AI adapts based on:

* relationship duration
* activity history
* mood patterns
* communication frequency

BUT:

> personalization must never feel invasive

---

# 14. AI + REALTIME SYSTEM

AI does NOT run in realtime loops.

It is triggered only by:

* user actions
* scheduled events
* explicit requests

---

# 15. CORE AI RULE

> AI enhances connection, but never becomes the connection.

---

# END OF CLAUDE.md

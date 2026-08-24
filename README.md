# Voice AI Dashboard

An explorable architecture map of a no-code platform for voice AI — the system
that let product managers build, test, dial and monitor production phone agents
without touching a server.

Two views, one source. An **interactive isometric map** you click around, and a
**generated document** (`SYSTEM.md`) with the decisions table, every component,
and every open question. Both are built from a single data file.

> Companion to **[voice-ai-atlas](https://github.com/shaileshjaiswalwins/voice-ai-atlas)**,
> which maps the voice runtime this platform configures. This repo is the
> platform; that one is the bot.

---

## Run it

Needs Node 18+. Nothing to install — no dependencies.

```bash
git clone <this repo>
cd voice-ai-dashboard
node atlas/build.mjs
open atlas.html          # macOS  ·  Linux: xdg-open  ·  Windows: start
```

That's it. `atlas.html` is one self-contained file.

If your browser blocks local fonts over `file://`, serve the folder instead:

```bash
npx serve .        # or: python3 -m http.server 8000
```

### Reading the map

| Key | Does |
|---|---|
| `]` / `Next ▸` | Next chapter |
| `[` / `◂ Back` | Previous chapter |
| hover | Read a component |
| click | Pin it open |
| `→` | Go inside — see its execution steps |
| `←` | Come back out |
| click a moving dot | Inspect the data it carries |

Twelve chapters, revealed a few components at a time. The last one shows the
whole platform with a flow picker.

---

## What it maps

Changing what a voice bot said used to mean editing a Python file on a
production server. This platform replaced that.

A product manager writes a prompt, refines it with an assistant that knows which
field it sits beside, replays it against scripted test callers, talks to it in
the browser over WebRTC, watches the cost per minute update live — then
publishes. Publishing creates an immutable numbered version. The next phone call
picks it up. **Calls already in progress finish on the config they started
with**, because each call freezes its own copy the moment it begins. That
invariant is what makes publishing at 3pm on a Tuesday a non-event.

Bots come in two shapes. A prompt-driven agent, or a graph the manager draws —
where each node becomes its own live agent and each arrow becomes a function the
model calls to move between them, triggering a real framework-level handoff
inside the call.

Campaigns turn a lead list into a queue handed out under a lease. Something
handed out and never finished comes back after 45 minutes. Something that keeps
failing stops after five attempts and becomes visible rather than retrying
forever in silence.

**Seventeen components across twelve chapters**, including:

- the draft → publish → rollback lifecycle and its per-call snapshot guarantee
- two answers to "let a manager draw the conversation", one cheap and one real
- the campaign claim/lease engine, its stale reclaim and its retry cap
- a ₹/minute pricing model with a 65× spread between the cheapest and priciest voice
- alert rules that open tracked incidents rather than firing notifications
- SSO, roles, and an audit trail where authorship is a function argument

---

## Why it exists

Most architecture docs describe the shape and lose the reasoning. This one keeps
both. Every component carries its open questions, and the settled ones carry the
answer. Ten decisions are recorded with the trade-off behind them.

Some of what it records:

- Why publishing during business hours cannot affect a call already in progress
- Why the flow builder shipped as *guidance the model can ignore* — and the exact
  condition that would justify building the real interpreter
- Why the number resolver returns nothing instead of raising (a wrong persona
  beats a dropped call)
- Why the pricing module is forbidden from touching a database
- Why a scheduled job that demoted admins was the wrong fix, and what replaced it
- Why the retry cap exists: a failure nobody can see is worse than a failure

---

## Editing it

`atlas/data.mjs` is the only file you edit. Everything else is generated.

| File | What | Edit? |
|---|---|---|
| `atlas/data.mjs` | Components, flows, chapters, decisions, questions | ✅ **This one** |
| `atlas/build.mjs` | Generator | ❌ |
| `atlas/template.html` | The isometric renderer | ❌ |
| `SYSTEM.md` | Generated document | ❌ regenerate |
| `atlas.html` | Generated map | ❌ regenerate |

Change `data.mjs`, run `node atlas/build.mjs`, reload. Both views stay in sync
because there is only one source.

Questions carry a state: open (a string), resolved (`{q, r}` with the answer), or
routed (`{q, to}`). Currently **28 open · 8 resolved**.

---

## Anonymization

This is a case study, not a code dump. The company name is replaced with "the
marketplace", internal hostnames and database names are placeholders, and the
external dialer vendor is unnamed. No source code, credentials, customer data, or
real endpoints are included. The architecture, the decisions, and the reasoning
are as they were.

---

## Credits

Built by **Shailesh Jaiswal** — architecture and reasoning from the platform his
team designed and ran in production.

The atlas format (isometric renderer, progressive disclosure, generated text
twin) comes from the `system-atlas` skill.

---

**Live map:** https://claude.ai/code/artifact/448d3167-87d7-4b6b-85d0-e8a67b8fa21d

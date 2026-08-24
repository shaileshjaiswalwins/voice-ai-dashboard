# Voice AI Dashboard — System Definition

_**An anonymized architecture case study.** This file is the single source of truth; the interactive atlas and this document are both generated from it. It describes the platform that let product managers build, test, dial and monitor production voice agents without touching a server. Company name and internal endpoints have been replaced with placeholders._

_Question status: **28 open · 8 resolved**._

## One paragraph

Before this existed, changing what a voice bot said meant editing a Python file on a production server. The platform replaced that with a dashboard. A product manager writes a prompt, saves a draft, runs it against scripted test scenarios, listens to a live browser test call, and publishes — at which point the change becomes an immutable numbered version. The next phone call picks it up; calls already in flight finish on the config they started with, because each call copies its config into its own transcript at the moment it begins. Bots come in two shapes: a prompt-driven agent, or a visual graph where each node is a conversation state and each edge becomes a function the model calls to move between them — the platform compiles that graph into real agent handoffs at runtime. Campaigns upload a lead list, a worker feeds them to the external dialer a batch at a time, and webhooks report each call back. Everything a call produces flows into one analytics surface: outcomes, cost in rupees per minute, latency traces, and alert rules that open incidents when quality drops. Roughly 38,000 lines across a FastAPI backend, a React dashboard, and three independent workers.

## Decisions locked

| Axis | Decision | ADR |
|---|---|---|
| Config lifecycle | Draft → immutable numbered version → publish. A live call fetches the active version once at room start and copies it into its own transcript as `config_snapshot`, so publishing never changes a conversation already in progress | — |
| Product scope | Explicitly *not* a general drag-and-drop bot builder. It is a prompt, settings, catalog, test-call, transcript, observability and dialing platform — the boundary is written into the onboarding brief so it stops being re-litigated | — |
| Flow builder | Phase A compiles the visual graph into prompt text the model is asked to follow; Phase B (a real interpreter with code-decided transitions) deliberately deferred until usage proves the text approach fails | — |
| Workflow bots | Each conversation node becomes its own LiveKit `Agent`; each outgoing edge becomes a generated `@function_tool` whose return value triggers a real framework-level agent handoff — verified against the framework source, not assumed | — |
| Dialing | Campaigns are authored here but executed by the external dialer. The platform owns the queue, the lease and the retry cap; the dialer owns the phone line | — |
| Cost | `pricing.py` is pure arithmetic with no I/O, so the estimate shown to a PM and the cost charged to a campaign are computed by the same code and cannot drift | — |
| Database split | The platform DB and the call-transcript DB are separate databases with separate clients. `agent_resolver` reads the platform DB read-only and returns `None` on any failure, so an unreachable platform never fails a live call | — |
| Roles | Exactly one seeded admin; every other SSO login is a regular user. Fixed at the source after a bug where any new login defaulted to admin — `$setOnInsert` so a role granted later is never clobbered | — |
| Transcript truth | The realtime transcript shows what happened during the call, but recording-derived post-call speech-to-text is the final source of truth when available | — |
| Server safety | Live bot processes and the staging dashboard share a server. Ports, checkout paths and a read-only-checks-first rule are written into the onboarding brief rather than held as tribal knowledge | — |

## Cost model

Cost is a first-class product feature here, not an afterthought — the platform prices every call in ₹ and can route a bot to a cheaper provider stack to hold a budget.

| Layer | Cheapest | Most expensive | Spread |
|---|---|---|---|
| Speech-to-text | `sarvam_saras_v3` ₹0.25/min | `google_chirp` ₹1.44/min | 5.8× |
| Language model | `gemini_2_5_flash` ₹0.14/min | `gpt_4o` / `claude_3_5_sonnet` ₹3.85/min | 27× |
| Text-to-speech | self-hosted `indic_f5` ₹0.20/min | `google_studio` ₹12.96/min | 65× |

Two things make this honest rather than decorative. `pricing.py` is deliberately pure arithmetic — no I/O, no database — so the number the estimate shows and the number the campaign charges cannot drift apart. And the self-hosted TTS rate is labelled in the source as a compute-amortization guess rather than a metered vendor rate, so nobody mistakes it for an invoice.

Several catalog entries are priced but not wired to a live client, and the code says so explicitly — they appear in estimates and the admin pricing page, but no real call can be placed on them.
## Deep dives

The flow builder shipped in two deliberate phases, and the reasoning is written into `flow_compiler.py`: Phase A compiles the visual graph into structured text appended to the system prompt — the model is *told* to follow the steps but can still skip or reorder them. Phase B, a real interpreter tracking `current_node_id` as call state with code deciding transitions, was explicitly deferred until real usage proved the model doesn't follow the text reliably. Shipping the same-day version first, with no pipeline architecture risk, is the kind of sequencing decision that usually goes unrecorded.

## Reading order (the atlas chapters)

1. **The problem** — Changing what a voice bot said used to mean editing a file on a production server. _(adds UI, CFG)_
2. **Publishing without breaking a live call** — Eighty calls are in progress. You publish. Nothing about those eighty calls changes.
3. **Drawing the conversation** — Two answers to "let a manager draw the call as boxes and arrows" — one cheap, one real. _(adds FLOW, WF)_
4. **Helping the manager write** — The hardest part of building an agent is writing what it should say. _(adds AI)_
5. **Trying it before anyone hears it** — Speak to the draft in your browser, or replay a set of scripted callers against it. _(adds TEST, EV)_
6. **Which bot answers this number?** — One runtime, many agents — and a lookup built to fail softly. _(adds RES)_
7. **Calling four thousand people** — A spreadsheet becomes a queue, handed out one lease at a time. _(adds CAMP, DIAL, HOOK)_
8. **What a conversation costs** — The same call can cost a few paise or a few rupees, depending entirely on the stack. _(adds COST)_
9. **Is it working?** — Outcomes, cost and completion on one surface — and every conversation behind it. _(adds AN, TR)_
10. **Nobody watches at 2am** — A rule watches instead, and opens a tracked incident rather than firing a message into the void. _(adds ALERT)_
11. **Who may do what** — Publishing here changes what a stranger hears on the phone tomorrow. The trail matters. _(adds AUTH, AUD)_
12. **The whole platform** — Everything at once, for free exploration.

## Structures

### Building a bot

#### D · Dashboard

**In one line.** The React app where a product manager does all of this without opening a terminal.

**What it does.** The whole point of the platform. Someone who has never edited a Python file can create an agent, write what it should say, try it out loud, launch a calling campaign, and watch how it performs — from one browser tab.

**How it's built.** React + Vite, roughly 25,000 lines across **~90 components and 29 views**. Principal surfaces: `BotsView`, `BuilderView`, `FlowBuilderView`, `WorkflowBuilderView`, `CampaignsView`, `AnalyticsView`, `TranscriptsView`, `AdminView`. Supporting widgets carry real product weight: `CostEstimateStrip`, `BudgetCostWidget`, `CallDetailDrawer`, `CommandPalette`, `CreateWithAI`. Views ship with colocated `.test.tsx` files.

**Steps in execution.**

1. **Create** — Pick a template or start blank via <code>CreateAgentPicker</code>.
2. **Configure** — Prompt, voice, language, catalogs, functions — tabbed in <code>BotConfigTabs</code>.
3. **Estimate** — Live ₹/min cost strip updates as the provider stack changes.
4. **Try** — Browser test call, or scripted evals, without leaving the page.
5. **Publish** — One button turns the draft into the next immutable version.

**Questions.**

- **Q-D1** Views have colocated tests; roughly 90 components do not all. Which of the untested ones carry real logic rather than markup?
- ~~**Q-D2** Why build bespoke views rather than a generic admin framework?~~ ✓ The product boundary is explicit — this is a prompt/settings/test/monitor tool, not a drag-and-drop builder — so the screens are shaped to that workflow rather than to a table schema (recorded in the onboarding brief).

#### V · Version store

**In one line.** Turns an edit into an immutable numbered version — and guarantees a call in progress never changes underneath itself.

**What it does.** The single most important guarantee in the platform. A manager can publish a change mid-afternoon while eighty calls are live, and every one of those calls finishes on exactly the wording it started with. New versions affect only the next call. Rollback is picking an older number.

**How it's built.** `voicebot_platform/config_store.py`. `save_draft` → `publish_version` → `rollback_bot`, with `_next_version_number` assigning sequential numbers and `unpublish_version` as the reverse. `fetch_active_bot_config` is what the runtime calls once at room start; `build_runtime_snapshot` produces the frozen copy written into the transcript as **`config_snapshot`**. Collections: `bot`, `bot_versions`, `bot_templates`, `campaigns`.

**Steps in execution.**

1. **Draft** — Edits accumulate on a mutable draft version.
2. **Publish** — The draft becomes the next sequential immutable version and is marked active.
3. **Snapshot** — A starting call resolves the active version once and freezes a copy into its own record.
4. **Roll back** — Re-activate any earlier version by number — the history is never rewritten.

**Questions.**

- ~~**Q-V1** What stops a publish from changing a live conversation?~~ ✓ The call resolves config exactly once at room start and carries its own frozen copy for the rest of the call. Stated as a standing invariant in the onboarding brief: never break immutable per-call snapshots.
- **Q-V2** `fetch_active_bot_config` runs on every call start with no cache, despite identical read patterns being cached elsewhere in the codebase. Deliberate, or an oversight at current volume?
- **Q-V3** Versions accumulate forever with no retention policy. At what point does a long-lived bot's version list become a problem?

#### G · Flow compiler

**In one line.** Turns a drawn flowchart into written instructions the model is asked to follow — the deliberately cheap first half of a two-phase plan.

**What it does.** A manager draws the call as boxes and arrows. Rather than build a machine that walks that graph, the first version simply describes the graph in words and appends it to the instructions. The model is told the steps; it can still wander. That was a known, accepted trade — and the reason is written down.

**How it's built.** `flow_compiler.py`. Walks `Flow/FlowNode/FlowEdge` and emits a structured text block appended to the system prompt, capped at `_MAX_NODES = 200` to stop a cyclic graph from blowing up the prompt. The source is explicit that this is **not a deterministic interpreter** — Phase B, tracking `current_node_id` as real call state with code deciding transitions, was deferred on purpose until real usage showed the text approach failing.

**Steps in execution.**

1. **Read the graph** — Nodes and edges from the saved bot config.
2. **Describe** — Each node becomes a numbered instruction — greeting, message, question, branch.
3. **Cap** — 200 nodes maximum, guarding against pathological or cyclic graphs.
4. **Append** — The block joins the system prompt; the model is asked to follow it.

**Questions.**

- ~~**Q-G1** Why ship guidance the model can ignore instead of a real interpreter?~~ ✓ Same-day change, no pipeline architecture risk. The stated rule: only invest in Phase B once real usage shows the model does not follow this past a handful of nodes (recorded in the module docstring).
- **Q-G2** Has anyone measured where the model actually stops following — at five nodes, or fifty? That measurement is the trigger for Phase B.

#### W · Workflow engine

**In one line.** The other half of the answer: a graph where every node is its own agent and every arrow is a function the model calls to move.

**What it does.** Where the flow compiler describes a graph in words, this one actually runs it. Each state of the conversation is a separate agent with its own instructions, and moving between states is a real handoff inside the call framework — not a suggestion the model may ignore. A manager draws it; the platform executes it literally.

**How it's built.** `workflow_engine.py`. Exactly one `start` node seeds the opening line. Each `conversation` node becomes its own LiveKit `Agent`; each outgoing transition becomes a dynamically built `@function_tool`, and returning a new `Agent` from that tool makes the framework **swap the live session onto it**, firing `on_exit` and `on_enter` automatically. Function and condition nodes are transparent pass-throughs. The mechanism was confirmed by reading the framework's own `generation.py` and `agent_activity.py` — cited by file in the docstring rather than assumed.

**Steps in execution.**

1. **Resolve** — A bot whose <code>bot_type == "workflow"</code> hands off here instead of running a fixed assistant.
2. **Build agents** — One <code>Agent</code> per conversation node, each with its own instructions.
3. **Build tools** — Each transition becomes a generated function tool with the edge's condition as its description.
4. **Hand off** — The model calls a transition; the framework swaps the session onto the next agent.
5. **Extract** — Post-call, a schema-driven extractor pulls structured answers back out.

**Questions.**

- ~~**Q-W1** How was the handoff behaviour verified?~~ ✓ By reading the framework source directly — `make_tool_output`, `agent_activity.py`, `AgentSession.update_agent` — and citing those files in the docstring, rather than relying on documentation.
- **Q-W2** Two graph builders now exist — the flow compiler and this. Is the plan to converge them, or do they serve genuinely different bots?
- **Q-W3** What happens to a workflow graph with a cycle, given each node is a live agent?

#### S · Prompt assistant

**In one line.** The sparkle button — generates or refines whichever piece of text the manager is currently editing.

**What it does.** Writing a good agent prompt is genuinely hard, and it is the main thing standing between a product manager and a working bot. The same button appears next to every text area, but it knows which one it is next to and coaches differently for each.

**How it's built.** `backend/prompt_assist.py` — per-target instruction pairs, separate generate and refine framings for each. Targets are deliberately distinct kinds of writing: **system prompt, closing line, and analysis-prompt override**. Surfaced in the UI through `CreateWithAI` and the reused sparkles widget.

**Steps in execution.**

1. **Detect target** — Which field the button sits beside.
2. **Pick framing** — Generate from nothing, or refine what is already there.
3. **Return** — Text drops straight into the editor for the manager to accept or edit.

**Questions.**

- **Q-S1** Is generated prompt text marked anywhere as AI-authored, so a later reader knows what was hand-tuned?

### Running it

#### R · Number resolver

**In one line.** Answers one question when a phone rings: which of these bots is this number?

**What it does.** A single runtime serves many agents. When a call comes in on a particular number, something has to decide whose personality answers. It is built to fail softly — if it cannot answer, the caller still gets a working bot rather than a dropped call.

**How it's built.** `agent_resolver.py`: dialed number → `agent_number_mapping` → bot → published version → config. Reads the **platform database, which is a different database** from the one transcripts are written to, so it holds its own read-only client. Every lookup returns `None` rather than raising — an unmapped number or an unreachable platform DB leaves the caller on the runtime's built-in persona instead of failing the call.

**Steps in execution.**

1. **Normalize** — Clean the dialed number.
2. **Map** — Look up the number → bot mapping.
3. **Resolve** — Bot → its currently published version → its config.
4. **Fail soft** — Any miss anywhere returns <code>None</code>; the call proceeds on the default persona.

**Questions.**

- ~~**Q-R1** Why a separate Mongo client rather than reusing the runtime's?~~ ✓ Different database entirely — the platform DB versus the call-transcript DB — so it owns its own read-only connection (stated in the module docstring).
- **Q-R2** A silent `None` means a misconfigured number is invisible until someone listens to a call on the wrong persona. Should a resolution miss raise an alert?

#### T · Test call

**In one line.** Talk to the draft in your browser, before it ever reaches a real phone.

**What it does.** The shortest possible loop between writing a prompt and hearing it. No phone, no deploy, no scheduling — click, speak, listen. This is what makes the dashboard usable by someone who cannot read the runtime code.

**How it's built.** `voicebot_platform/livekit_sessions.py` plus `backend/routers/testcall.py`, creating and closing a WebRTC room on demand. Driven from `TestCallPanel`, with `TestLLMPanel` for a text-only turn. Test calls run under a dedicated **separate worker name** on a staging port so they can never be mistaken for production traffic. Recordings attach back to the session via `attach_test_recording`.

**Steps in execution.**

1. **Create** — A test room is created for this draft.
2. **Join** — The browser joins over WebRTC; the test worker joins as the agent.
3. **Converse** — The draft config runs — unpublished, affecting nothing live.
4. **Close** — The room is torn down and the recording attached for playback.

**Questions.**

- **Q-T1** Test rooms are created on demand — is there a reaper for sessions a browser abandoned without closing?

#### E · Evals

**In one line.** Scripted conversations replayed against a prompt, so a change can be checked without dialling anyone.

**What it does.** A test call tells you how one conversation went. Evals tell you whether an edit made things better or worse across a set of situations you care about — the awkward caller, the one who changes their mind, the one who answers a different question than the one asked.

**How it's built.** `backend/evals.py` — `run_scenario` and `run_evals` drive a set of `EvalScenario` objects against a candidate system prompt using a configurable model (`EVALS_GEMINI_MODEL`). Surfaced through `EvalsPanel` next to the prompt being edited.

**Steps in execution.**

1. **Define** — Scenarios are authored alongside the bot.
2. **Run** — Each is played against the candidate prompt.
3. **Compare** — Results surface in the builder, beside the text that produced them.

**Questions.**

- **Q-E1** Are eval results stored per version, so a manager can see that version 12 scored worse than version 11?
- **Q-E2** Two endpoints only. Is this the smallest useful version of evals, or was it descoped?

### Reaching people

#### C · Campaign engine

**In one line.** A lead list becomes a queue of call jobs, handed out one at a time under a lease.

**What it does.** Upload a spreadsheet of people to call, and the platform turns it into work. The careful part is what happens when something goes wrong halfway: a job that was handed out but never finished must come back, and a job that keeps failing must stop retrying and become visible rather than looping silently forever.

**How it's built.** `backend/campaign_execution.py`. `enqueue_pending_leads` → `claim_next_job` → `mark_job_dialing` → `complete_job`. `reclaim_stale_dialing` returns jobs stuck past a timeout (default 45 min). `revert_to_queued_or_fail` enforces `MAX_PUSH_ATTEMPTS = 5` so a permanently-failing push lands in a visible **`push_failed`** state instead of retrying invisibly. `mint_push_ref` gives each push an idempotency reference; `derive_campaign_status` computes campaign state from its jobs rather than storing it.

**Steps in execution.**

1. **Enqueue** — Uploaded leads become queued call jobs.
2. **Claim** — A worker leases the next job for one campaign.
3. **Push** — The lead goes to the external dialer with a minted reference.
4. **Await** — The job sits in <code>dialing</code> until a webhook reports back.
5. **Reclaim** — Anything stuck past the timeout returns to the queue.
6. **Give up visibly** — Five failed pushes and the job becomes <code>push_failed</code>, where a person can see it.

**Questions.**

- ~~**Q-C1** Why cap push attempts at all?~~ ✓ Without a cap a bad dialer config retries every tick forever with the failure invisible to a PM — the cap forces it into a visible failed state (recorded in the worker config).
- **Q-C2** Campaign status is derived from job counts on read rather than stored. At what campaign size does that become expensive?
- **Q-C3** Per-campaign claim loops mean N campaigns is N loops. What is the practical ceiling?

#### P · Dialer worker

**In one line.** The loop that actually feeds people to the phone system — and the one piece here that makes a real phone ring.

**What it does.** Everything else in the platform is safe to run. This one is not: pointing it at a live campaign causes real numbers to be dialled. That warning is written at the top of the file, in the source, where someone about to run it will see it.

**How it's built.** `campaign_dialer_worker/worker.py`. Polls every `POLL_INTERVAL_SEC = 30`, up to `BATCH_LIMIT_PER_CAMPAIGN = 10` per campaign, with one claim loop per active campaign. Pushes through `dialer_client.push_lead_to_dialer` to the external dialer API. Shares `callback_worker`'s shape — claim/lease loop, rotating log, graceful shutdown — but adapted from one global queue to per-campaign claiming. Its docstring carries an explicit **⚠️ warning that running it dials real phone numbers**.

**Steps in execution.**

1. **Poll** — Find active campaigns.
2. **Reclaim** — Return anything stuck in <code>dialing</code> past the timeout.
3. **Claim** — Lease up to ten jobs for each campaign.
4. **Push** — Send each lead to the external dialer.
5. **Mark** — Job moves to <code>dialing</code>; the webhook closes the loop.

**Questions.**

- **Q-P1** The only guard against dialling real people in testing is a comment. Should a dry-run mode be enforced in code?
- **Q-P2** Per-campaign loops within a single process — is there a lock preventing two worker instances double-dialling the same lead?

#### H · Dialer webhooks

**In one line.** How the phone system tells the platform a call is over.

**What it does.** The dialer is somebody else's system, and it works asynchronously — it takes a lead, dials it whenever it can, and reports back later. This is the door it knocks on, and the moment a queued job finally becomes a completed one.

**How it's built.** `backend/routers/dialer_webhooks.py`, keyed per service: `POST /api/dialer-webhooks/{service_id}/call-complete`. Resolves the job by phone via `find_in_progress_job_by_phone` and calls `complete_job`, closing the lease the dialer worker opened.

**Steps in execution.**

1. **Receive** — The dialer posts a completion for one call.
2. **Match** — Find the in-progress job for that number.
3. **Complete** — Close the job and record the outcome.

**Questions.**

- **Q-H1** Jobs are matched by phone number. What happens if the same number is live in two campaigns at once?
- **Q-H2** Is the webhook authenticated, or does it trust the service id in the path?

### Watching quality

#### A · Analytics

**In one line.** One surface answering the only question that matters: is this bot working?

**What it does.** Outcomes by category, cost per call, how many conversations reached their goal, which ones dropped and where. Built for a manager deciding whether to keep a prompt change, not for an engineer reading a log file.

**How it's built.** `backend/routers/analytics.py`, `backend/metrics.py`, and `config_store.get_outcome_analytics`, filtered by bot, campaign and date range. `metrics.py` pins one shared definition of which call states count as **not failed**, used by both the dashboard's task-completion rate and per-bot metrics, so the two surfaces cannot disagree. CSV export via `export_transcripts_csv`.

**Steps in execution.**

1. **Filter** — By bot, campaign, and window.
2. **Aggregate** — Outcomes, completion rate, cost, volume.
3. **Compare** — Across versions and campaigns.
4. **Export** — CSV for anyone who wants it in a spreadsheet.

**Questions.**

- **Q-A1** Some aggregation is done in Python over fetched documents rather than pushed into the database. At what volume does that stop being fine?
- **Q-A2** Can a manager see analytics split by *version*, to tell whether their prompt edit actually helped?

#### X · Transcripts

**In one line.** Every conversation, searchable, with the audio and the exact config that produced it.

**What it does.** When a call goes wrong, this is where someone goes. Not just what was said, but which version was running, what it cost, how long each reply took — and the recording, so you can hear the thing rather than read it.

**How it's built.** `config_store.search_transcripts` over `call_transcripts`, plus `call_events` for the operational timeline. Each record carries its `config_snapshot`. The realtime transcript captures what happened live, but **recording-derived post-call speech-to-text is the final source of truth** when available — the two are kept distinct rather than merged. Surfaced through `TranscriptsView`, `CallDetailDrawer` and `AudioPlayer`.

**Steps in execution.**

1. **Search** — By bot, campaign, outcome, date, or text.
2. **Open** — Turn-by-turn view with latency and cost.
3. **Listen** — Recording playback beside the text.
4. **Inspect** — The exact config snapshot that produced this call.

**Questions.**

- **Q-X1** Two transcript sources with different reliability. Does the UI make clear which one a reader is looking at?
- **Q-X2** No retention policy is visible. Recordings plus transcripts grow without bound — what is the plan?

#### L · Alert worker

**In one line.** Checks every minute whether anything has gone wrong, and opens an incident when it has.

**What it does.** Nobody watches a dashboard at 2am. A manager writes a rule — if the drop rate goes above this, tell me — and the platform watches instead, opening a tracked incident rather than firing a notification into the void.

**How it's built.** `alert_worker/worker.py`, polling every `POLL_INTERVAL_SEC = 60` — a cadence chosen to match what a comparable commercial product documents. Evaluates `alert_rules` against transcripts and metrics and writes `alert_incidents`. Imports `backend.db`, `backend.auth` and `backend.metrics` directly so there is **one definition of each metric** rather than a second copy that could drift. Surfaced in `AlertsPanel`. Related: `get_quality_alerts` flags outcome-rate drops on a rolling window.

**Steps in execution.**

1. **Tick** — Every 60 seconds.
2. **Evaluate** — Each rule against the current window.
3. **Open** — A breach creates a tracked incident, not just a message.
4. **Notify** — Route to the people the rule names.

**Questions.**

- **Q-L1** Incidents are opened — is anything closing them, or does a resolved problem stay open until someone clicks?
- **Q-L2** The 60-second cadence was copied from a competitor's documented behaviour. Has it been checked against how fast these calls actually degrade?

#### ₹ · Pricing engine

**In one line.** Prices every call in rupees, and can pick a cheaper provider stack to hold a budget.

**What it does.** Voice AI cost is not obvious — the same conversation can cost a few paise or a few rupees depending on which speech, language and voice services it runs on. The platform makes that visible while a manager is still editing, and can choose a cheaper combination to fit a stated budget.

**How it's built.** `backend/pricing.py`, deliberately **pure arithmetic with no I/O and no database** so the estimate a PM sees and the cost a campaign is charged come from the same code and cannot drift. Per-minute ₹ rates across speech-to-text, language models, text-to-speech and telephony — a `65×` spread between the cheapest and most expensive voice alone. Self-hosted voice is labelled in the source as a compute-amortization estimate rather than a metered rate. Several catalog entries are priced but explicitly not wired to a live client. Surfaced via `CostEstimateStrip`, `BudgetCostWidget`, `CostBreakdownPopover`.

**Steps in execution.**

1. **Rate** — Look up ₹/min for the chosen stack.
2. **Estimate** — Project cost per call and per campaign.
3. **Route** — Given a budget, select a stack that fits.
4. **Show** — Live in the builder, before anything is published.

**Questions.**

- ~~**Q-₹1** Why keep pricing free of any I/O?~~ ✓ So it is plain unit-testable arithmetic and cannot drift between the API endpoint, the campaign estimate, and any future caller (stated in the module docstring).
- **Q-₹2** Rates are hard-coded constants. Who updates them when a vendor changes price, and how would anyone notice they had gone stale?
- **Q-₹3** Catalog-only providers appear in estimates but cannot be dialled. Does the UI make that distinction visible to a PM comparing options?

### Who may do what

#### U · Auth and roles

**In one line.** Company single sign-on, one seeded admin, and everyone else a regular user until promoted.

**What it does.** People log in with their existing work account rather than a new password. The interesting part is a bug that got fixed properly: for a while, every new login quietly became an administrator.

**How it's built.** `backend/sso.py` — OAuth2 with PKCE against the company identity provider — plus `backend/auth.py` for tokens and roles. `issue_token_for_sso_profile` grants `admin` only to the single seeded address; every other login defaults to `user`. Written with **`$setOnInsert`** so a role an admin grants later is never clobbered on next login. The earlier workaround demoted admins on a schedule, which silently reverted deliberate grants; that was replaced by fixing the default at its source.

**Steps in execution.**

1. **Sign in** — OAuth2 + PKCE against company SSO.
2. **Provision** — First login creates the account — as <code>user</code>, unless it is the seeded admin.
3. **Preserve** — <code>$setOnInsert</code> keeps later role grants intact across logins.
4. **Authorize** — Role gates the destructive routes.

**Questions.**

- ~~**Q-U1** Why not keep the scheduled demotion as a safety net?~~ ✓ Because it was a repeating sweep, not a one-time cleanup, and it silently reverted any admin role a real admin had granted. Fixing the default at its source removed the need for it.
- **Q-U2** Two roles only — admin and user. Does a PM who should not launch campaigns need a third?

#### O · Audit log

**In one line.** Who changed what, and when — because published versions affect real phone calls to real people.

**What it does.** A prompt edit here is not a code change on a branch; it changes what a stranger hears on the phone tomorrow morning. The trail of who published what matters, and it is visible in the dashboard rather than buried in a server log.

**How it's built.** `backend/audit.py` with `backend/routers/audit.py`, surfaced as `AuditLogView`. Every mutating call in `config_store` carries a `user` argument — `save_draft`, `publish_version`, `rollback_bot`, `delete_bot`, `set_campaign_status` — so **authorship is a parameter, not an afterthought**.

**Steps in execution.**

1. **Attribute** — Every mutation carries the acting user.
2. **Record** — Action, target, timestamp.
3. **Review** — Filterable in the dashboard.

**Questions.**

- **Q-O1** Does the audit entry capture what changed, or only that something did?
- **Q-O2** Is the log append-only at the database level, or only by convention?

## Flows (representative packets)

Payload shapes are what the design implies, not measured traffic.

### Shipping a prompt change

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | UI → AI | refine this prompt | `{"target":"system_prompt","mode":"refine"}` |
| 2 | AI → UI | suggested text | `{"chars":1840}` |
| 3 | UI → CFG | save draft | `{"bot_id":"bot_7c1","version":"draft"}` |
| 4 | UI → EV | run scenarios | `{"scenarios":6}` |
| 5 | EV → UI | results | `{"passed":5,"failed":1}` |
| 6 | UI → TEST | browser test call | `{"room":"test_bot_7c1_a9","worker":"test-only"}` |
| 7 | UI → COST | estimate | `{"stt":"sarvam_saras_v3","llm":"gemini_2_5_flash","tts":"indic_f5"}` |
| 8 | COST → UI | ₹/min | `{"total":0.59}` |
| 9 | UI → CFG | publish | `{"version":12,"immutable":true}` |
| 10 | CFG → AUD | who published what | `{"user":"pm@…","action":"publish","version":12}` |

### A call arrives

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | RES → CFG | which bot is this number? | `{"dialed":"+91…4471"}` |
| 2 | CFG → RES | active version | `{"bot_id":"bot_7c1","version":12}` |
| 3 | RES → WF | workflow bot — run the graph | `{"bot_type":"workflow","nodes":9}` |
| 4 | WF → TR | transcript + config snapshot | `{"config_snapshot":"v12 frozen","turns":14}` |
| 5 | TR → AN | roll into analytics | `{"outcome":"qualified","cost_inr":1.42}` |

### Running a campaign

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | UI → CAMP | upload leads | `{"rows":4200,"campaign":"diwali-b2b"}` |
| 2 | CAMP → DIAL | queued jobs | `{"batch":10,"per_campaign":true}` |
| 3 | DIAL → HOOK | pushed to dialer | `{"push_ref":"pr_88a1","state":"dialing"}` |
| 4 | HOOK → CAMP | call complete | `{"matched_by":"phone","state":"completed"}` |
| 5 | CAMP → AN | campaign outcomes | `{"connected":2610,"qualified":431}` |

### Something goes wrong

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | ALERT → TR | evaluate rule window | `{"window":"60s","rule":"drop_rate > 30%"}` |
| 2 | TR → ALERT | sample | `{"calls":140,"dropped":51}` |
| 3 | ALERT → UI | incident opened | `{"severity":"high","rule":"drop_rate"}` |
| 4 | UI → TR | open the failing calls | `{"filter":"outcome=dropped"}` |
| 5 | UI → CFG | roll back | `{"to_version":11}` |

### Publishing mid-call is safe

| # | From → To | Packet | Representative payload |
|---|---|---|---|
| 1 | CFG → RES | call starts — resolve once | `{"version":11}` |
| 2 | RES → TR | freeze config into this call | `{"config_snapshot":"v11"}` |
| 3 | UI → CFG | publish v12 while calls are live | `{"version":12}` |
| 4 | CFG → RES | next call only | `{"version":12}` |

## Questions — index

Reference by ID. ✓ resolved (with date) · otherwise open.

- **Q-D1** (D) Views have colocated tests; roughly 90 components do not all. Which of the untested ones carry real logic rather than markup?
- ~~**Q-D2**~~ (D) ✓ The product boundary is explicit — this is a prompt/settings/test/monitor tool, not a drag-and-drop builder — so the screens are shaped to that workflow rather than to a table schema (recorded in the onboarding brief).
- ~~**Q-V1**~~ (V) ✓ The call resolves config exactly once at room start and carries its own frozen copy for the rest of the call. Stated as a standing invariant in the onboarding brief: never break immutable per-call snapshots.
- **Q-V2** (V) `fetch_active_bot_config` runs on every call start with no cache, despite identical read patterns being cached elsewhere in the codebase. Deliberate, or an oversight at current volume?
- **Q-V3** (V) Versions accumulate forever with no retention policy. At what point does a long-lived bot's version list become a problem?
- ~~**Q-G1**~~ (G) ✓ Same-day change, no pipeline architecture risk. The stated rule: only invest in Phase B once real usage shows the model does not follow this past a handful of nodes (recorded in the module docstring).
- **Q-G2** (G) Has anyone measured where the model actually stops following — at five nodes, or fifty? That measurement is the trigger for Phase B.
- ~~**Q-W1**~~ (W) ✓ By reading the framework source directly — `make_tool_output`, `agent_activity.py`, `AgentSession.update_agent` — and citing those files in the docstring, rather than relying on documentation.
- **Q-W2** (W) Two graph builders now exist — the flow compiler and this. Is the plan to converge them, or do they serve genuinely different bots?
- **Q-W3** (W) What happens to a workflow graph with a cycle, given each node is a live agent?
- **Q-S1** (S) Is generated prompt text marked anywhere as AI-authored, so a later reader knows what was hand-tuned?
- ~~**Q-R1**~~ (R) ✓ Different database entirely — the platform DB versus the call-transcript DB — so it owns its own read-only connection (stated in the module docstring).
- **Q-R2** (R) A silent `None` means a misconfigured number is invisible until someone listens to a call on the wrong persona. Should a resolution miss raise an alert?
- **Q-T1** (T) Test rooms are created on demand — is there a reaper for sessions a browser abandoned without closing?
- **Q-E1** (E) Are eval results stored per version, so a manager can see that version 12 scored worse than version 11?
- **Q-E2** (E) Two endpoints only. Is this the smallest useful version of evals, or was it descoped?
- ~~**Q-C1**~~ (C) ✓ Without a cap a bad dialer config retries every tick forever with the failure invisible to a PM — the cap forces it into a visible failed state (recorded in the worker config).
- **Q-C2** (C) Campaign status is derived from job counts on read rather than stored. At what campaign size does that become expensive?
- **Q-C3** (C) Per-campaign claim loops mean N campaigns is N loops. What is the practical ceiling?
- **Q-P1** (P) The only guard against dialling real people in testing is a comment. Should a dry-run mode be enforced in code?
- **Q-P2** (P) Per-campaign loops within a single process — is there a lock preventing two worker instances double-dialling the same lead?
- **Q-H1** (H) Jobs are matched by phone number. What happens if the same number is live in two campaigns at once?
- **Q-H2** (H) Is the webhook authenticated, or does it trust the service id in the path?
- **Q-A1** (A) Some aggregation is done in Python over fetched documents rather than pushed into the database. At what volume does that stop being fine?
- **Q-A2** (A) Can a manager see analytics split by *version*, to tell whether their prompt edit actually helped?
- **Q-X1** (X) Two transcript sources with different reliability. Does the UI make clear which one a reader is looking at?
- **Q-X2** (X) No retention policy is visible. Recordings plus transcripts grow without bound — what is the plan?
- **Q-L1** (L) Incidents are opened — is anything closing them, or does a resolved problem stay open until someone clicks?
- **Q-L2** (L) The 60-second cadence was copied from a competitor's documented behaviour. Has it been checked against how fast these calls actually degrade?
- ~~**Q-₹1**~~ (₹) ✓ So it is plain unit-testable arithmetic and cannot drift between the API endpoint, the campaign estimate, and any future caller (stated in the module docstring).
- **Q-₹2** (₹) Rates are hard-coded constants. Who updates them when a vendor changes price, and how would anyone notice they had gone stale?
- **Q-₹3** (₹) Catalog-only providers appear in estimates but cannot be dialled. Does the UI make that distinction visible to a PM comparing options?
- ~~**Q-U1**~~ (U) ✓ Because it was a repeating sweep, not a one-time cleanup, and it silently reverted any admin role a real admin had granted. Fixing the default at its source removed the need for it.
- **Q-U2** (U) Two roles only — admin and user. Does a PM who should not launch campaigns need a third?
- **Q-O1** (O) Does the audit entry capture what changed, or only that something did?
- **Q-O2** (O) Is the log append-only at the database level, or only by convention?

## What the platform gives vs what we own

**Platform gives:** FastAPI provides routing, validation and dependency-injected auth. LiveKit provides the WebRTC rooms behind browser test calls, and the agent-handoff machinery the workflow engine builds on. MongoDB provides the document store for bots, versions, campaigns, transcripts and events. React Flow provides the visual graph canvas.

**We own:** The draft/publish/rollback version lifecycle and its immutable per-call snapshot guarantee. The workflow compiler that turns a visual graph into live agent handoffs. The campaign claim/lease engine and its stale-job reclaim. The ₹ pricing model and budget-based stack routing. The evals harness, the alert-rule engine, the RBAC and audit layer, and the whole dashboard.

## Planned filesystem

```
backend/
  main.py                  # FastAPI app
  routers/                 # 21 routers — bots, campaigns, evals, alerts,
                           #   analytics, auth, pricing, testcall, webhooks…
  campaign_execution.py    # claim / lease / complete for call jobs
  pricing.py               # pure ₹ arithmetic + budget stack routing
  evals.py                 # scripted scenario runner
  post_call_analysis.py    # schema-driven extraction for workflow bots
  auth.py, sso.py, audit.py
voicebot_platform/
  config_store.py          # bots, draft/published versions, rollback
  livekit_sessions.py      # browser test-call rooms
  observability.py         # trace + call-event helpers
  option_catalogs.py, phrase_library.py, outcome_catalog.py
workflow_engine.py         # visual graph -> live agent handoffs
flow_compiler.py           # graph -> prompt text (Phase A)
agent_resolver.py          # inbound number -> bot -> published version
campaign_dialer_worker/    # feeds leads to the external dialer
alert_worker/              # evaluates alert rules, opens incidents
callback_worker/           # post-call analysis + callback delivery
frontend/src/
  views/                   # Bots, Builder, FlowBuilder, WorkflowBuilder,
                           #   Campaigns, Analytics, Transcripts, Admin…
  components/              # ~90 components
```

## How this file is maintained

Generated from `atlas/data.mjs` by `node atlas/build.mjs`, which also builds the interactive atlas (`atlas.html`, published at https://claude.ai/code/artifact/448d3167-87d7-4b6b-85d0-e8a67b8fa21d). Edit the data file, rebuild, republish — never edit this file by hand.

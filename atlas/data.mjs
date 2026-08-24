// Single source of truth for this atlas. Everything else is generated from it.
// Build: node atlas/build.mjs → writes ../SYSTEM.md and ../atlas.html
//
// Anonymized case study of a no-code platform for building, testing, dialing and
// monitoring production voice AI agents. Company name and internal endpoints are
// replaced with placeholders; the architecture, the decisions, and the reasoning
// are as they were.

export const META = {
  title: 'Voice AI Dashboard',
  artifactUrl: 'https://claude.ai/code/artifact/448d3167-87d7-4b6b-85d0-e8a67b8fa21d',
  sourcePath: 'atlas/data.mjs',
  buildCmd: 'node atlas/build.mjs',
  stats: [
    { k: 'Domain', v: 'No-code voice AI' },
    { k: 'Scale', v: '~38k lines' },
    { k: 'Built for', v: 'PMs' },
  ],
  intro: `_**An anonymized architecture case study.** This file is the single source of truth; the interactive atlas and this document are both generated from it. It describes the platform that let product managers build, test, dial and monitor production voice agents without touching a server. Company name and internal endpoints have been replaced with placeholders._`,
  onePara: `Before this existed, changing what a voice bot said meant editing a Python file on a production server. The platform replaced that with a dashboard. A product manager writes a prompt, saves a draft, runs it against scripted test scenarios, listens to a live browser test call, and publishes — at which point the change becomes an immutable numbered version. The next phone call picks it up; calls already in flight finish on the config they started with, because each call copies its config into its own transcript at the moment it begins. Bots come in two shapes: a prompt-driven agent, or a visual graph where each node is a conversation state and each edge becomes a function the model calls to move between them — the platform compiles that graph into real agent handoffs at runtime. Campaigns upload a lead list, a worker feeds them to the external dialer a batch at a time, and webhooks report each call back. Everything a call produces flows into one analytics surface: outcomes, cost in rupees per minute, latency traces, and alert rules that open incidents when quality drops. Roughly 38,000 lines across a FastAPI backend, a React dashboard, and three independent workers.`,
  costModel: [
    'Cost is a first-class product feature here, not an afterthought — the platform prices every call in ₹ and can route a bot to a cheaper provider stack to hold a budget.',
    '',
    '| Layer | Cheapest | Most expensive | Spread |',
    '|---|---|---|---|',
    '| Speech-to-text | `sarvam_saras_v3` ₹0.25/min | `google_chirp` ₹1.44/min | 5.8× |',
    '| Language model | `gemini_2_5_flash` ₹0.14/min | `gpt_4o` / `claude_3_5_sonnet` ₹3.85/min | 27× |',
    '| Text-to-speech | self-hosted `indic_f5` ₹0.20/min | `google_studio` ₹12.96/min | 65× |',
    '',
    'Two things make this honest rather than decorative. `pricing.py` is deliberately pure arithmetic — no I/O, no database — so the number the estimate shows and the number the campaign charges cannot drift apart. And the self-hosted TTS rate is labelled in the source as a compute-amortization guess rather than a metered vendor rate, so nobody mistakes it for an invoice.',
    '',
    'Several catalog entries are priced but not wired to a live client, and the code says so explicitly — they appear in estimates and the admin pricing page, but no real call can be placed on them.',
  ],
  deepDive: `The flow builder shipped in two deliberate phases, and the reasoning is written into \`flow_compiler.py\`: Phase A compiles the visual graph into structured text appended to the system prompt — the model is *told* to follow the steps but can still skip or reorder them. Phase B, a real interpreter tracking \`current_node_id\` as call state with code deciding transitions, was explicitly deferred until real usage proved the model doesn't follow the text reliably. Shipping the same-day version first, with no pipeline architecture risk, is the kind of sequencing decision that usually goes unrecorded.`,
  platformGives: 'FastAPI provides routing, validation and dependency-injected auth. LiveKit provides the WebRTC rooms behind browser test calls, and the agent-handoff machinery the workflow engine builds on. MongoDB provides the document store for bots, versions, campaigns, transcripts and events. React Flow provides the visual graph canvas.',
  weOwn: 'The draft/publish/rollback version lifecycle and its immutable per-call snapshot guarantee. The workflow compiler that turns a visual graph into live agent handoffs. The campaign claim/lease engine and its stale-job reclaim. The ₹ pricing model and budget-based stack routing. The evals harness, the alert-rule engine, the RBAC and audit layer, and the whole dashboard.',
  filesystem: `backend/
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
frontend/src/
  views/                   # Bots, Builder, FlowBuilder, WorkflowBuilder,
                           #   Campaigns, Analytics, Transcripts, Admin…
  components/              # ~90 components`,
};

export const DECISIONS = [
  { axis: 'Config lifecycle', decision: 'Draft → immutable numbered version → publish. A live call fetches the active version once at room start and copies it into its own transcript as `config_snapshot`, so publishing never changes a conversation already in progress', adr: '—' },
  { axis: 'Product scope', decision: 'Explicitly *not* a general drag-and-drop bot builder. It is a prompt, settings, catalog, test-call, transcript, observability and dialing platform — the boundary is written into the onboarding brief so it stops being re-litigated', adr: '—' },
  { axis: 'Flow builder', decision: 'Phase A compiles the visual graph into prompt text the model is asked to follow; Phase B (a real interpreter with code-decided transitions) deliberately deferred until usage proves the text approach fails', adr: '—' },
  { axis: 'Workflow bots', decision: 'Each conversation node becomes its own LiveKit `Agent`; each outgoing edge becomes a generated `@function_tool` whose return value triggers a real framework-level agent handoff — verified against the framework source, not assumed', adr: '—' },
  { axis: 'Dialing', decision: 'Campaigns are authored here but executed by the external dialer. The platform owns the queue, the lease and the retry cap; the dialer owns the phone line', adr: '—' },
  { axis: 'Cost', decision: '`pricing.py` is pure arithmetic with no I/O, so the estimate shown to a PM and the cost charged to a campaign are computed by the same code and cannot drift', adr: '—' },
  { axis: 'Database split', decision: 'The platform DB and the call-transcript DB are separate databases with separate clients. `agent_resolver` reads the platform DB read-only and returns `None` on any failure, so an unreachable platform never fails a live call', adr: '—' },
  { axis: 'Roles', decision: 'Exactly one seeded admin; every other SSO login is a regular user. Fixed at the source after a bug where any new login defaulted to admin — `$setOnInsert` so a role granted later is never clobbered', adr: '—' },
  { axis: 'Transcript truth', decision: 'The realtime transcript shows what happened during the call, but recording-derived post-call speech-to-text is the final source of truth when available', adr: '—' },
  { axis: 'Server safety', decision: 'Live bot processes and the staging dashboard share a server. Ports, checkout paths and a read-only-checks-first rule are written into the onboarding brief rather than held as tribal knowledge', adr: '—' },
];

export const GROUPS = [
  { id: 'build', title: 'Building a bot' },
  { id: 'run', title: 'Running it' },
  { id: 'reach', title: 'Reaching people' },
  { id: 'watch', title: 'Watching quality' },
  { id: 'gov', title: 'Who may do what' },
];

export const NODES = [
  // ── Building a bot ────────────────────────────────────────────────────────
  { id: 'UI', code: 'D', name: 'Dashboard', short: 'DASHBOARD', group: 'build', gx: 1, gy: 1, w: 2.6, d: 2.6, h: 46, kind: 'screen',
    one: 'The React app where a product manager does all of this without opening a terminal.',
    what: 'The whole point of the platform. Someone who has never edited a Python file can create an agent, write what it should say, try it out loud, launch a calling campaign, and watch how it performs — from one browser tab.',
    how: 'React + Vite, roughly 25,000 lines across <mark>~90 components and 29 views</mark>. Principal surfaces: <code>BotsView</code>, <code>BuilderView</code>, <code>FlowBuilderView</code>, <code>WorkflowBuilderView</code>, <code>CampaignsView</code>, <code>AnalyticsView</code>, <code>TranscriptsView</code>, <code>AdminView</code>. Supporting widgets carry real product weight: <code>CostEstimateStrip</code>, <code>BudgetCostWidget</code>, <code>CallDetailDrawer</code>, <code>CommandPalette</code>, <code>CreateWithAI</code>. Views ship with colocated <code>.test.tsx</code> files.',
    steps: [
      ['Create', 'Pick a template or start blank via <code>CreateAgentPicker</code>.'],
      ['Configure', 'Prompt, voice, language, catalogs, functions — tabbed in <code>BotConfigTabs</code>.'],
      ['Estimate', 'Live ₹/min cost strip updates as the provider stack changes.'],
      ['Try', 'Browser test call, or scripted evals, without leaving the page.'],
      ['Publish', 'One button turns the draft into the next immutable version.'],
    ],
    cond: [
      'Views have colocated tests; roughly 90 components do not all. Which of the untested ones carry real logic rather than markup?',
      { q: 'Why build bespoke views rather than a generic admin framework?', r: 'The product boundary is explicit — this is a prompt/settings/test/monitor tool, not a drag-and-drop builder — so the screens are shaped to that workflow rather than to a table schema (recorded in the onboarding brief).' },
    ] },

  { id: 'CFG', code: 'V', name: 'Version store', short: 'VERSIONS', group: 'build', gx: 5.6, gy: 1, w: 2.8, d: 2.8, h: 56, kind: 'gate',
    one: 'Turns an edit into an immutable numbered version — and guarantees a call in progress never changes underneath itself.',
    what: 'The single most important guarantee in the platform. A manager can publish a change mid-afternoon while eighty calls are live, and every one of those calls finishes on exactly the wording it started with. New versions affect only the next call. Rollback is picking an older number.',
    how: '<code>voicebot_platform/config_store.py</code>. <code>save_draft</code> → <code>publish_version</code> → <code>rollback_bot</code>, with <code>_next_version_number</code> assigning sequential numbers and <code>unpublish_version</code> as the reverse. <code>fetch_active_bot_config</code> is what the runtime calls once at room start; <code>build_runtime_snapshot</code> produces the frozen copy written into the transcript as <mark><code>config_snapshot</code></mark>. Collections: <code>bot</code>, <code>bot_versions</code>, <code>bot_templates</code>, <code>campaigns</code>.',
    steps: [
      ['Draft', 'Edits accumulate on a mutable draft version.'],
      ['Publish', 'The draft becomes the next sequential immutable version and is marked active.'],
      ['Snapshot', 'A starting call resolves the active version once and freezes a copy into its own record.'],
      ['Roll back', 'Re-activate any earlier version by number — the history is never rewritten.'],
    ],
    cond: [
      { q: 'What stops a publish from changing a live conversation?', r: 'The call resolves config exactly once at room start and carries its own frozen copy for the rest of the call. Stated as a standing invariant in the onboarding brief: never break immutable per-call snapshots.' },
      '`fetch_active_bot_config` runs on every call start with no cache, despite identical read patterns being cached elsewhere in the codebase. Deliberate, or an oversight at current volume?',
      'Versions accumulate forever with no retention policy. At what point does a long-lived bot\'s version list become a problem?',
    ] },

  { id: 'FLOW', code: 'G', name: 'Flow compiler', short: 'FLOW COMPILE', group: 'build', gx: 5.6, gy: -3.4, w: 2.4, d: 2.4, h: 30, kind: 'box',
    one: 'Turns a drawn flowchart into written instructions the model is asked to follow — the deliberately cheap first half of a two-phase plan.',
    what: 'A manager draws the call as boxes and arrows. Rather than build a machine that walks that graph, the first version simply describes the graph in words and appends it to the instructions. The model is told the steps; it can still wander. That was a known, accepted trade — and the reason is written down.',
    how: '<code>flow_compiler.py</code>. Walks <code>Flow/FlowNode/FlowEdge</code> and emits a structured text block appended to the system prompt, capped at <code>_MAX_NODES = 200</code> to stop a cyclic graph from blowing up the prompt. The source is explicit that this is <mark>not a deterministic interpreter</mark> — Phase B, tracking <code>current_node_id</code> as real call state with code deciding transitions, was deferred on purpose until real usage showed the text approach failing.',
    steps: [
      ['Read the graph', 'Nodes and edges from the saved bot config.'],
      ['Describe', 'Each node becomes a numbered instruction — greeting, message, question, branch.'],
      ['Cap', '200 nodes maximum, guarding against pathological or cyclic graphs.'],
      ['Append', 'The block joins the system prompt; the model is asked to follow it.'],
    ],
    cond: [
      { q: 'Why ship guidance the model can ignore instead of a real interpreter?', r: 'Same-day change, no pipeline architecture risk. The stated rule: only invest in Phase B once real usage shows the model does not follow this past a handful of nodes (recorded in the module docstring).' },
      'Has anyone measured where the model actually stops following — at five nodes, or fifty? That measurement is the trigger for Phase B.',
    ] },

  { id: 'WF', code: 'W', name: 'Workflow engine', short: 'WORKFLOW', group: 'build', gx: 10.2, gy: -3.4, w: 2.8, d: 2.8, h: 62, kind: 'tall',
    one: 'The other half of the answer: a graph where every node is its own agent and every arrow is a function the model calls to move.',
    what: 'Where the flow compiler describes a graph in words, this one actually runs it. Each state of the conversation is a separate agent with its own instructions, and moving between states is a real handoff inside the call framework — not a suggestion the model may ignore. A manager draws it; the platform executes it literally.',
    how: '<code>workflow_engine.py</code>. Exactly one <code>start</code> node seeds the opening line. Each <code>conversation</code> node becomes its own LiveKit <code>Agent</code>; each outgoing transition becomes a dynamically built <code>@function_tool</code>, and returning a new <code>Agent</code> from that tool makes the framework <mark>swap the live session onto it</mark>, firing <code>on_exit</code> and <code>on_enter</code> automatically. Function and condition nodes are transparent pass-throughs. The mechanism was confirmed by reading the framework\'s own <code>generation.py</code> and <code>agent_activity.py</code> — cited by file in the docstring rather than assumed.',
    steps: [
      ['Resolve', 'A bot whose <code>bot_type == "workflow"</code> hands off here instead of running a fixed assistant.'],
      ['Build agents', 'One <code>Agent</code> per conversation node, each with its own instructions.'],
      ['Build tools', 'Each transition becomes a generated function tool with the edge\'s condition as its description.'],
      ['Hand off', 'The model calls a transition; the framework swaps the session onto the next agent.'],
      ['Extract', 'Post-call, a schema-driven extractor pulls structured answers back out.'],
    ],
    cond: [
      { q: 'How was the handoff behaviour verified?', r: 'By reading the framework source directly — <code>make_tool_output</code>, <code>agent_activity.py</code>, <code>AgentSession.update_agent</code> — and citing those files in the docstring, rather than relying on documentation.' },
      'Two graph builders now exist — the flow compiler and this. Is the plan to converge them, or do they serve genuinely different bots?',
      'What happens to a workflow graph with a cycle, given each node is a live agent?',
    ] },

  { id: 'AI', code: 'S', name: 'Prompt assistant', short: 'AI ASSIST', group: 'build', gx: 1, gy: -3.4, w: 2.2, d: 2.2, h: 26, kind: 'box',
    one: 'The sparkle button — generates or refines whichever piece of text the manager is currently editing.',
    what: 'Writing a good agent prompt is genuinely hard, and it is the main thing standing between a product manager and a working bot. The same button appears next to every text area, but it knows which one it is next to and coaches differently for each.',
    how: '<code>backend/prompt_assist.py</code> — per-target instruction pairs, separate generate and refine framings for each. Targets are deliberately distinct kinds of writing: <mark>system prompt, closing line, and analysis-prompt override</mark>. Surfaced in the UI through <code>CreateWithAI</code> and the reused sparkles widget.',
    steps: [
      ['Detect target', 'Which field the button sits beside.'],
      ['Pick framing', 'Generate from nothing, or refine what is already there.'],
      ['Return', 'Text drops straight into the editor for the manager to accept or edit.'],
    ],
    cond: ['Is generated prompt text marked anywhere as AI-authored, so a later reader knows what was hand-tuned?'] },

  // ── Running it ────────────────────────────────────────────────────────────
  { id: 'RES', code: 'R', name: 'Number resolver', short: 'RESOLVER', group: 'run', gx: 10.2, gy: 1.4, w: 2.4, d: 2.4, h: 34, kind: 'box',
    one: 'Answers one question when a phone rings: which of these bots is this number?',
    what: 'A single runtime serves many agents. When a call comes in on a particular number, something has to decide whose personality answers. It is built to fail softly — if it cannot answer, the caller still gets a working bot rather than a dropped call.',
    how: '<code>agent_resolver.py</code>: dialed number → <code>agent_number_mapping</code> → bot → published version → config. Reads the <mark>platform database, which is a different database</mark> from the one transcripts are written to, so it holds its own read-only client. Every lookup returns <code>None</code> rather than raising — an unmapped number or an unreachable platform DB leaves the caller on the runtime\'s built-in persona instead of failing the call.',
    steps: [
      ['Normalize', 'Clean the dialed number.'],
      ['Map', 'Look up the number → bot mapping.'],
      ['Resolve', 'Bot → its currently published version → its config.'],
      ['Fail soft', 'Any miss anywhere returns <code>None</code>; the call proceeds on the default persona.'],
    ],
    cond: [
      { q: 'Why a separate Mongo client rather than reusing the runtime\'s?', r: 'Different database entirely — the platform DB versus the call-transcript DB — so it owns its own read-only connection (stated in the module docstring).' },
      'A silent `None` means a misconfigured number is invisible until someone listens to a call on the wrong persona. Should a resolution miss raise an alert?',
    ] },

  { id: 'TEST', code: 'T', name: 'Test call', short: 'TEST CALL', group: 'run', gx: 14.6, gy: 1.4, w: 2.4, d: 2.4, h: 32, kind: 'screen',
    one: 'Talk to the draft in your browser, before it ever reaches a real phone.',
    what: 'The shortest possible loop between writing a prompt and hearing it. No phone, no deploy, no scheduling — click, speak, listen. This is what makes the dashboard usable by someone who cannot read the runtime code.',
    how: '<code>voicebot_platform/livekit_sessions.py</code> plus <code>backend/routers/testcall.py</code>, creating and closing a WebRTC room on demand. Driven from <code>TestCallPanel</code>, with <code>TestLLMPanel</code> for a text-only turn. Test calls run under a dedicated <mark>separate worker name</mark> on a staging port so they can never be mistaken for production traffic. Recordings attach back to the session via <code>attach_test_recording</code>.',
    steps: [
      ['Create', 'A test room is created for this draft.'],
      ['Join', 'The browser joins over WebRTC; the test worker joins as the agent.'],
      ['Converse', 'The draft config runs — unpublished, affecting nothing live.'],
      ['Close', 'The room is torn down and the recording attached for playback.'],
    ],
    cond: ['Test rooms are created on demand — is there a reaper for sessions a browser abandoned without closing?'] },

  { id: 'EV', code: 'E', name: 'Evals', short: 'EVALS', group: 'run', gx: 14.6, gy: -3, w: 2.2, d: 2.2, h: 28, kind: 'cards',
    one: 'Scripted conversations replayed against a prompt, so a change can be checked without dialling anyone.',
    what: 'A test call tells you how one conversation went. Evals tell you whether an edit made things better or worse across a set of situations you care about — the awkward caller, the one who changes their mind, the one who answers a different question than the one asked.',
    how: '<code>backend/evals.py</code> — <code>run_scenario</code> and <code>run_evals</code> drive a set of <code>EvalScenario</code> objects against a candidate system prompt using a configurable model (<code>EVALS_GEMINI_MODEL</code>). Surfaced through <code>EvalsPanel</code> next to the prompt being edited.',
    steps: [
      ['Define', 'Scenarios are authored alongside the bot.'],
      ['Run', 'Each is played against the candidate prompt.'],
      ['Compare', 'Results surface in the builder, beside the text that produced them.'],
    ],
    cond: [
      'Are eval results stored per version, so a manager can see that version 12 scored worse than version 11?',
      'Two endpoints only. Is this the smallest useful version of evals, or was it descoped?',
    ] },

  // ── Reaching people ───────────────────────────────────────────────────────
  { id: 'CAMP', code: 'C', name: 'Campaign engine', short: 'CAMPAIGNS', group: 'reach', gx: 5.6, gy: 6.4, w: 2.8, d: 2.8, h: 48, kind: 'gate',
    one: 'A lead list becomes a queue of call jobs, handed out one at a time under a lease.',
    what: 'Upload a spreadsheet of people to call, and the platform turns it into work. The careful part is what happens when something goes wrong halfway: a job that was handed out but never finished must come back, and a job that keeps failing must stop retrying and become visible rather than looping silently forever.',
    how: '<code>backend/campaign_execution.py</code>. <code>enqueue_pending_leads</code> → <code>claim_next_job</code> → <code>mark_job_dialing</code> → <code>complete_job</code>. <code>reclaim_stale_dialing</code> returns jobs stuck past a timeout (default 45 min). <code>revert_to_queued_or_fail</code> enforces <code>MAX_PUSH_ATTEMPTS = 5</code> so a permanently-failing push lands in a visible <mark><code>push_failed</code></mark> state instead of retrying invisibly. <code>mint_push_ref</code> gives each push an idempotency reference; <code>derive_campaign_status</code> computes campaign state from its jobs rather than storing it.',
    steps: [
      ['Enqueue', 'Uploaded leads become queued call jobs.'],
      ['Claim', 'A worker leases the next job for one campaign.'],
      ['Push', 'The lead goes to the external dialer with a minted reference.'],
      ['Await', 'The job sits in <code>dialing</code> until a webhook reports back.'],
      ['Reclaim', 'Anything stuck past the timeout returns to the queue.'],
      ['Give up visibly', 'Five failed pushes and the job becomes <code>push_failed</code>, where a person can see it.'],
    ],
    cond: [
      { q: 'Why cap push attempts at all?', r: 'Without a cap a bad dialer config retries every tick forever with the failure invisible to a PM — the cap forces it into a visible failed state (recorded in the worker config).' },
      'Campaign status is derived from job counts on read rather than stored. At what campaign size does that become expensive?',
      'Per-campaign claim loops mean N campaigns is N loops. What is the practical ceiling?',
    ] },

  { id: 'DIAL', code: 'P', name: 'Dialer worker', short: 'DIALER', group: 'reach', gx: 1, gy: 6.4, w: 2.6, d: 2.6, h: 44, kind: 'job',
    one: 'The loop that actually feeds people to the phone system — and the one piece here that makes a real phone ring.',
    what: 'Everything else in the platform is safe to run. This one is not: pointing it at a live campaign causes real numbers to be dialled. That warning is written at the top of the file, in the source, where someone about to run it will see it.',
    how: '<code>campaign_dialer_worker/worker.py</code>. Polls every <code>POLL_INTERVAL_SEC = 30</code>, up to <code>BATCH_LIMIT_PER_CAMPAIGN = 10</code> per campaign, with one claim loop per active campaign. Pushes through <code>dialer_client.push_lead_to_dialer</code> to the external dialer API. Shares <code>callback_worker</code>\'s shape — claim/lease loop, rotating log, graceful shutdown — but adapted from one global queue to per-campaign claiming. Its docstring carries an explicit <mark>⚠️ warning that running it dials real phone numbers</mark>.',
    steps: [
      ['Poll', 'Find active campaigns.'],
      ['Reclaim', 'Return anything stuck in <code>dialing</code> past the timeout.'],
      ['Claim', 'Lease up to ten jobs for each campaign.'],
      ['Push', 'Send each lead to the external dialer.'],
      ['Mark', 'Job moves to <code>dialing</code>; the webhook closes the loop.'],
    ],
    cond: [
      'The only guard against dialling real people in testing is a comment. Should a dry-run mode be enforced in code?',
      'Per-campaign loops within a single process — is there a lock preventing two worker instances double-dialling the same lead?',
    ] },

  { id: 'HOOK', code: 'H', name: 'Dialer webhooks', short: 'WEBHOOKS', group: 'reach', gx: 10.2, gy: 6.4, w: 2.2, d: 2.2, h: 28, kind: 'box',
    one: 'How the phone system tells the platform a call is over.',
    what: 'The dialer is somebody else\'s system, and it works asynchronously — it takes a lead, dials it whenever it can, and reports back later. This is the door it knocks on, and the moment a queued job finally becomes a completed one.',
    how: '<code>backend/routers/dialer_webhooks.py</code>, keyed per service: <code>POST /api/dialer-webhooks/{service_id}/call-complete</code>. Resolves the job by phone via <code>find_in_progress_job_by_phone</code> and calls <code>complete_job</code>, closing the lease the dialer worker opened.',
    steps: [
      ['Receive', 'The dialer posts a completion for one call.'],
      ['Match', 'Find the in-progress job for that number.'],
      ['Complete', 'Close the job and record the outcome.'],
    ],
    cond: [
      'Jobs are matched by phone number. What happens if the same number is live in two campaigns at once?',
      'Is the webhook authenticated, or does it trust the service id in the path?',
    ] },

  // ── Watching quality ──────────────────────────────────────────────────────
  { id: 'AN', code: 'A', name: 'Analytics', short: 'ANALYTICS', group: 'watch', gx: 5.6, gy: 11.4, w: 2.8, d: 2.8, h: 40, kind: 'store',
    one: 'One surface answering the only question that matters: is this bot working?',
    what: 'Outcomes by category, cost per call, how many conversations reached their goal, which ones dropped and where. Built for a manager deciding whether to keep a prompt change, not for an engineer reading a log file.',
    how: '<code>backend/routers/analytics.py</code>, <code>backend/metrics.py</code>, and <code>config_store.get_outcome_analytics</code>, filtered by bot, campaign and date range. <code>metrics.py</code> pins one shared definition of which call states count as <mark>not failed</mark>, used by both the dashboard\'s task-completion rate and per-bot metrics, so the two surfaces cannot disagree. CSV export via <code>export_transcripts_csv</code>.',
    steps: [
      ['Filter', 'By bot, campaign, and window.'],
      ['Aggregate', 'Outcomes, completion rate, cost, volume.'],
      ['Compare', 'Across versions and campaigns.'],
      ['Export', 'CSV for anyone who wants it in a spreadsheet.'],
    ],
    cond: [
      'Some aggregation is done in Python over fetched documents rather than pushed into the database. At what volume does that stop being fine?',
      'Can a manager see analytics split by *version*, to tell whether their prompt edit actually helped?',
    ] },

  { id: 'TR', code: 'X', name: 'Transcripts', short: 'TRANSCRIPTS', group: 'watch', gx: 10.2, gy: 11.4, w: 2.6, d: 2.6, h: 26, kind: 'store',
    one: 'Every conversation, searchable, with the audio and the exact config that produced it.',
    what: 'When a call goes wrong, this is where someone goes. Not just what was said, but which version was running, what it cost, how long each reply took — and the recording, so you can hear the thing rather than read it.',
    how: '<code>config_store.search_transcripts</code> over <code>call_transcripts</code>, plus <code>call_events</code> for the operational timeline. Each record carries its <code>config_snapshot</code>. The realtime transcript captures what happened live, but <mark>recording-derived post-call speech-to-text is the final source of truth</mark> when available — the two are kept distinct rather than merged. Surfaced through <code>TranscriptsView</code>, <code>CallDetailDrawer</code> and <code>AudioPlayer</code>.',
    steps: [
      ['Search', 'By bot, campaign, outcome, date, or text.'],
      ['Open', 'Turn-by-turn view with latency and cost.'],
      ['Listen', 'Recording playback beside the text.'],
      ['Inspect', 'The exact config snapshot that produced this call.'],
    ],
    cond: [
      'Two transcript sources with different reliability. Does the UI make clear which one a reader is looking at?',
      'No retention policy is visible. Recordings plus transcripts grow without bound — what is the plan?',
    ] },

  { id: 'ALERT', code: 'L', name: 'Alert worker', short: 'ALERTS', group: 'watch', gx: 14.6, gy: 11.4, w: 2.4, d: 2.4, h: 38, kind: 'job',
    one: 'Checks every minute whether anything has gone wrong, and opens an incident when it has.',
    what: 'Nobody watches a dashboard at 2am. A manager writes a rule — if the drop rate goes above this, tell me — and the platform watches instead, opening a tracked incident rather than firing a notification into the void.',
    how: '<code>alert_worker/worker.py</code>, polling every <code>POLL_INTERVAL_SEC = 60</code> — a cadence chosen to match what a comparable commercial product documents. Evaluates <code>alert_rules</code> against transcripts and metrics and writes <code>alert_incidents</code>. Imports <code>backend.db</code>, <code>backend.auth</code> and <code>backend.metrics</code> directly so there is <mark>one definition of each metric</mark> rather than a second copy that could drift. Surfaced in <code>AlertsPanel</code>. Related: <code>get_quality_alerts</code> flags outcome-rate drops on a rolling window.',
    steps: [
      ['Tick', 'Every 60 seconds.'],
      ['Evaluate', 'Each rule against the current window.'],
      ['Open', 'A breach creates a tracked incident, not just a message.'],
      ['Notify', 'Route to the people the rule names.'],
    ],
    cond: [
      'Incidents are opened — is anything closing them, or does a resolved problem stay open until someone clicks?',
      'The 60-second cadence was copied from a competitor\'s documented behaviour. Has it been checked against how fast these calls actually degrade?',
    ] },

  { id: 'COST', code: '₹', name: 'Pricing engine', short: 'PRICING', group: 'watch', gx: 1, gy: 11.4, w: 2.4, d: 2.4, h: 30, kind: 'cards',
    one: 'Prices every call in rupees, and can pick a cheaper provider stack to hold a budget.',
    what: 'Voice AI cost is not obvious — the same conversation can cost a few paise or a few rupees depending on which speech, language and voice services it runs on. The platform makes that visible while a manager is still editing, and can choose a cheaper combination to fit a stated budget.',
    how: '<code>backend/pricing.py</code>, deliberately <mark>pure arithmetic with no I/O and no database</mark> so the estimate a PM sees and the cost a campaign is charged come from the same code and cannot drift. Per-minute ₹ rates across speech-to-text, language models, text-to-speech and telephony — a <code>65×</code> spread between the cheapest and most expensive voice alone. Self-hosted voice is labelled in the source as a compute-amortization estimate rather than a metered rate. Several catalog entries are priced but explicitly not wired to a live client. Surfaced via <code>CostEstimateStrip</code>, <code>BudgetCostWidget</code>, <code>CostBreakdownPopover</code>.',
    steps: [
      ['Rate', 'Look up ₹/min for the chosen stack.'],
      ['Estimate', 'Project cost per call and per campaign.'],
      ['Route', 'Given a budget, select a stack that fits.'],
      ['Show', 'Live in the builder, before anything is published.'],
    ],
    cond: [
      { q: 'Why keep pricing free of any I/O?', r: 'So it is plain unit-testable arithmetic and cannot drift between the API endpoint, the campaign estimate, and any future caller (stated in the module docstring).' },
      'Rates are hard-coded constants. Who updates them when a vendor changes price, and how would anyone notice they had gone stale?',
      'Catalog-only providers appear in estimates but cannot be dialled. Does the UI make that distinction visible to a PM comparing options?',
    ] },

  // ── Who may do what ───────────────────────────────────────────────────────
  { id: 'AUTH', code: 'U', name: 'Auth and roles', short: 'AUTH · RBAC', group: 'gov', gx: 14.6, gy: 6.4, w: 2.4, d: 2.4, h: 34, kind: 'gate',
    one: 'Company single sign-on, one seeded admin, and everyone else a regular user until promoted.',
    what: 'People log in with their existing work account rather than a new password. The interesting part is a bug that got fixed properly: for a while, every new login quietly became an administrator.',
    how: '<code>backend/sso.py</code> — OAuth2 with PKCE against the company identity provider — plus <code>backend/auth.py</code> for tokens and roles. <code>issue_token_for_sso_profile</code> grants <code>admin</code> only to the single seeded address; every other login defaults to <code>user</code>. Written with <mark><code>$setOnInsert</code></mark> so a role an admin grants later is never clobbered on next login. The earlier workaround demoted admins on a schedule, which silently reverted deliberate grants; that was replaced by fixing the default at its source.',
    steps: [
      ['Sign in', 'OAuth2 + PKCE against company SSO.'],
      ['Provision', 'First login creates the account — as <code>user</code>, unless it is the seeded admin.'],
      ['Preserve', '<code>$setOnInsert</code> keeps later role grants intact across logins.'],
      ['Authorize', 'Role gates the destructive routes.'],
    ],
    cond: [
      { q: 'Why not keep the scheduled demotion as a safety net?', r: 'Because it was a repeating sweep, not a one-time cleanup, and it silently reverted any admin role a real admin had granted. Fixing the default at its source removed the need for it.' },
      'Two roles only — admin and user. Does a PM who should not launch campaigns need a third?',
    ] },

  { id: 'AUD', code: 'O', name: 'Audit log', short: 'AUDIT', group: 'gov', gx: 10.2, gy: 16.2, w: 2.2, d: 2.2, h: 24, kind: 'store',
    one: 'Who changed what, and when — because published versions affect real phone calls to real people.',
    what: 'A prompt edit here is not a code change on a branch; it changes what a stranger hears on the phone tomorrow morning. The trail of who published what matters, and it is visible in the dashboard rather than buried in a server log.',
    how: '<code>backend/audit.py</code> with <code>backend/routers/audit.py</code>, surfaced as <code>AuditLogView</code>. Every mutating call in <code>config_store</code> carries a <code>user</code> argument — <code>save_draft</code>, <code>publish_version</code>, <code>rollback_bot</code>, <code>delete_bot</code>, <code>set_campaign_status</code> — so <mark>authorship is a parameter, not an afterthought</mark>.',
    steps: [
      ['Attribute', 'Every mutation carries the acting user.'],
      ['Record', 'Action, target, timestamp.'],
      ['Review', 'Filterable in the dashboard.'],
    ],
    cond: [
      'Does the audit entry capture what changed, or only that something did?',
      'Is the log append-only at the database level, or only by convention?',
    ] },
];

export const FLOWS = [
  { id: 'ship', name: 'Shipping a prompt change', hops: [
    ['UI', 'AI', 'refine this prompt', { target: 'system_prompt', mode: 'refine' }, 'yx'],
    ['AI', 'UI', 'suggested text', { chars: 1840 }, 'xy'],
    ['UI', 'CFG', 'save draft', { bot_id: 'bot_7c1', version: 'draft' }, 'yx'],
    ['UI', 'EV', 'run scenarios', { scenarios: 6 }, 'xy'],
    ['EV', 'UI', 'results', { passed: 5, failed: 1 }, 'yx'],
    ['UI', 'TEST', 'browser test call', { room: 'test_bot_7c1_a9', worker: 'test-only' }, 'xy'],
    ['UI', 'COST', 'estimate', { stt: 'sarvam_saras_v3', llm: 'gemini_2_5_flash', tts: 'indic_f5' }, 'yx'],
    ['COST', 'UI', '₹/min', { total: 0.59 }, 'xy'],
    ['UI', 'CFG', 'publish', { version: 12, immutable: true }, 'yx'],
    ['CFG', 'AUD', 'who published what', { user: 'pm@…', action: 'publish', version: 12 }, 'xy'],
  ] },

  { id: 'call', name: 'A call arrives', hops: [
    ['RES', 'CFG', 'which bot is this number?', { dialed: '+91…4471' }, 'xy'],
    ['CFG', 'RES', 'active version', { bot_id: 'bot_7c1', version: 12 }, 'yx'],
    ['RES', 'WF', 'workflow bot — run the graph', { bot_type: 'workflow', nodes: 9 }, 'xy'],
    ['WF', 'TR', 'transcript + config snapshot', { config_snapshot: 'v12 frozen', turns: 14 }, 'yx'],
    ['TR', 'AN', 'roll into analytics', { outcome: 'qualified', cost_inr: 1.42 }, 'xy'],
  ] },

  { id: 'campaign', name: 'Running a campaign', hops: [
    ['UI', 'CAMP', 'upload leads', { rows: 4200, campaign: 'diwali-b2b' }, 'yx'],
    ['CAMP', 'DIAL', 'queued jobs', { batch: 10, per_campaign: true }, 'xy'],
    ['DIAL', 'HOOK', 'pushed to dialer', { push_ref: 'pr_88a1', state: 'dialing' }, 'yx'],
    ['HOOK', 'CAMP', 'call complete', { matched_by: 'phone', state: 'completed' }, 'xy'],
    ['CAMP', 'AN', 'campaign outcomes', { connected: 2610, qualified: 431 }, 'yx'],
  ] },

  { id: 'watch', name: 'Something goes wrong', hops: [
    ['ALERT', 'TR', 'evaluate rule window', { window: '60s', rule: 'drop_rate > 30%' }, 'xy'],
    ['TR', 'ALERT', 'sample', { calls: 140, dropped: 51 }, 'yx'],
    ['ALERT', 'UI', 'incident opened', { severity: 'high', rule: 'drop_rate' }, 'xy'],
    ['UI', 'TR', 'open the failing calls', { filter: 'outcome=dropped' }, 'yx'],
    ['UI', 'CFG', 'roll back', { to_version: 11 }, 'xy'],
  ] },

  { id: 'safe', name: 'Publishing mid-call is safe', hops: [
    ['CFG', 'RES', 'call starts — resolve once', { version: 11 }, 'xy'],
    ['RES', 'TR', 'freeze config into this call', { config_snapshot: 'v11' }, 'yx'],
    ['UI', 'CFG', 'publish v12 while calls are live', { version: 12 }, 'yx'],
    ['CFG', 'RES', 'next call only', { version: 12 }, 'xy'],
  ] },
];

export const CH = [
  { id: 'why', title: 'The problem', reveal: ['UI', 'CFG'],
    lede: `Changing what a voice bot said used to mean editing a file on a production server.`,
    story: `<p>That is the whole reason this exists. A product manager who knew exactly what the bot should say had to ask an engineer, who had to edit Python, on a machine also running live calls.</p><p>The dashboard replaced the file edit. The version store made it <mark>safe to do while calls are in progress</mark> — which is the harder half of the problem.</p>`,
    flow: [['UI', 'CFG', 'save draft', { bot_id: 'bot_7c1', version: 'draft' }]] },

  { id: 'safe', title: 'Publishing without breaking a live call', reveal: [],
    lede: `Eighty calls are in progress. You publish. Nothing about those eighty calls changes.`,
    story: `<p>A call resolves its configuration exactly once, when the room opens, and carries a frozen copy for the rest of its life. Publishing writes a new numbered version that only the <em>next</em> call will see.</p><p>The onboarding brief states it as a standing invariant: <mark>never break immutable per-call snapshots</mark>. Rollback is then trivial — it is just picking an older number.</p>`,
    flow: [
      ['CFG', 'UI', 'publish v12 while calls are live', { version: 12 }],
      ['UI', 'CFG', 'next call only', { affects: 'future calls' }],
    ] },

  { id: 'draw', title: 'Drawing the conversation', reveal: ['FLOW', 'WF'],
    lede: `Two answers to "let a manager draw the call as boxes and arrows" — one cheap, one real.`,
    story: `<p>The flow compiler describes the drawn graph in words and appends it to the instructions. The model is asked to follow it and may wander. That limitation was <mark>accepted deliberately and written down</mark> — ship the same-day version, and only build the real interpreter once usage proves the model does not follow it.</p><p>The workflow engine is the real one. Each node becomes its own agent, each arrow becomes a function the model calls, and the framework genuinely swaps the live session between them. That behaviour was confirmed by reading the framework's own source and citing the files.</p>`,
    flow: [
      ['FLOW', 'WF', 'same graph, two treatments', { nodes: 9, phase: 'A vs live handoff' }],
    ] },

  { id: 'help', title: 'Helping the manager write', reveal: ['AI'],
    lede: `The hardest part of building an agent is writing what it should say.`,
    story: `<p>The same sparkle button sits beside every text area, but it knows which one it is next to — a system prompt, a closing line, and an analysis instruction are <mark>three different kinds of writing</mark>, and each gets its own coaching.</p>`,
    flow: [
      ['UI', 'AI', 'refine this prompt', { target: 'system_prompt' }],
      ['AI', 'UI', 'suggested text', { chars: 1840 }],
    ] },

  { id: 'try', title: 'Trying it before anyone hears it', reveal: ['TEST', 'EV'],
    lede: `Speak to the draft in your browser, or replay a set of scripted callers against it.`,
    story: `<p>The test call is the shortest loop the platform has — click, talk, listen, with no phone and no deploy. It runs under a separate worker name on a staging port so it can never be confused with production traffic.</p><p>Evals answer the other question: not "how did this one call go" but <mark>"did my edit make things better or worse"</mark> across the situations that actually matter.</p>`,
    flow: [
      ['UI', 'EV', 'run scenarios', { scenarios: 6 }],
      ['EV', 'UI', 'results', { passed: 5, failed: 1 }],
      ['UI', 'TEST', 'browser test call', { worker: 'test-only' }],
    ] },

  { id: 'answer', title: 'Which bot answers this number?', reveal: ['RES'],
    lede: `One runtime, many agents — and a lookup built to fail softly.`,
    story: `<p>A dialed number maps to a bot, which maps to its published version, which is the config the call runs on. It reads a <em>different database</em> from the one transcripts are written to, so it holds its own read-only connection.</p><p>Every lookup returns nothing rather than raising. An unmapped number or an unreachable platform leaves the caller on the runtime's built-in persona — <mark>a wrong personality beats a dropped call</mark>.</p>`,
    flow: [
      ['RES', 'CFG', 'which bot is this number?', { dialed: '+91…4471' }],
      ['CFG', 'RES', 'active version', { version: 12 }],
    ] },

  { id: 'reach', title: 'Calling four thousand people', reveal: ['CAMP', 'DIAL', 'HOOK'],
    lede: `A spreadsheet becomes a queue, handed out one lease at a time.`,
    story: `<p>The careful parts are the failure paths. A job handed out but never finished is reclaimed after 45 minutes. A push that keeps failing stops after five attempts and lands in a <mark>visible failed state</mark> — because the alternative is retrying forever with nobody able to see it.</p><p>The dialer itself is somebody else's system and works asynchronously, so a webhook is how a call finally reports back. And the worker that drives it carries a warning in its own source: run this and real phones ring.</p>`,
    flow: [
      ['UI', 'CAMP', 'upload leads', { rows: 4200 }],
      ['CAMP', 'DIAL', 'queued jobs', { batch: 10 }],
      ['DIAL', 'HOOK', 'pushed to dialer', { state: 'dialing' }],
      ['HOOK', 'CAMP', 'call complete', { state: 'completed' }],
    ] },

  { id: 'money', title: 'What a conversation costs', reveal: ['COST'],
    lede: `The same call can cost a few paise or a few rupees, depending entirely on the stack.`,
    story: `<p>There is a <mark>65× spread</mark> between the cheapest and most expensive voice alone. So cost is shown live in the builder, while the manager is still choosing — and given a budget, the platform can pick a stack that fits.</p><p>The pricing module is deliberately pure arithmetic with no database access, so the number quoted in the builder and the number charged to a campaign are computed by the same code and cannot drift apart.</p>`,
    flow: [
      ['UI', 'COST', 'estimate', { llm: 'gemini_2_5_flash', tts: 'indic_f5' }],
      ['COST', 'UI', '₹/min', { total: 0.59 }],
    ] },

  { id: 'watch', title: 'Is it working?', reveal: ['AN', 'TR'],
    lede: `Outcomes, cost and completion on one surface — and every conversation behind it.`,
    story: `<p>Analytics is built for the person deciding whether to keep a prompt change, not for an engineer reading logs. One shared definition of "this call did not fail" is pinned in a single module so the dashboard and the per-bot page <mark>cannot disagree with each other</mark>.</p><p>Behind it sits every transcript, with its audio and the exact frozen config that produced it. Two transcript sources are kept deliberately distinct: the live one shows real-time behaviour, but recording-derived post-call transcription is the final word.</p>`,
    flow: [
      ['TR', 'AN', 'roll into analytics', { outcome: 'qualified', cost_inr: 1.42 }],
      ['UI', 'TR', 'open the failing calls', { filter: 'outcome=dropped' }],
    ] },

  { id: 'alarm', title: 'Nobody watches at 2am', reveal: ['ALERT'],
    lede: `A rule watches instead, and opens a tracked incident rather than firing a message into the void.`,
    story: `<p>Every sixty seconds, each rule is evaluated against the current window. A breach becomes an <mark>incident someone owns</mark>, not a notification someone missed.</p><p>The worker imports the metric definitions rather than reimplementing them, so an alert threshold and the dashboard number it refers to always mean the same thing.</p>`,
    flow: [
      ['ALERT', 'TR', 'evaluate rule window', { rule: 'drop_rate > 30%' }],
      ['ALERT', 'UI', 'incident opened', { severity: 'high' }],
    ] },

  { id: 'who', title: 'Who may do what', reveal: ['AUTH', 'AUD'],
    lede: `Publishing here changes what a stranger hears on the phone tomorrow. The trail matters.`,
    story: `<p>People sign in with their existing work account. For a while, every new login quietly became an administrator — and the first fix was a scheduled sweep demoting them, which <mark>silently reverted deliberate grants</mark>. It was replaced by fixing the default at its source.</p><p>Every mutating call carries the acting user as an argument, so authorship is a parameter rather than an afterthought.</p>`,
    flow: [
      ['UI', 'AUTH', 'sso login', { provider: 'company IAM', flow: 'OAuth2 + PKCE' }],
      ['CFG', 'AUD', 'who published what', { action: 'publish', version: 12 }],
    ] },

  { id: 'all', title: 'The whole platform', reveal: [],
    lede: `Everything at once, for free exploration.`,
    story: `<p>Choose which flow runs from the picker at bottom left. Hover anything to read it; click to pin it; <code>→</code> goes inside a component to see its steps; click a moving dot to inspect what it carries.</p><p>The <mark>Open questions</mark> tab lists every question raised here by ID — the ones with answers carry the reasoning behind them.</p>`,
    flow: null },
];

export const HOW_HTML = `<div class="eyebrow">voice-ai-dashboard · anonymized case study</div>
<h1 class="t">How it's built</h1>
<div class="sub">a no-code platform for people who do not write code</div>

<h3 class="sec">The shape in one line</h3>
<p>A FastAPI backend with 21 routers, a React dashboard of ~90 components, and three independent workers — one dialing, one alerting, one analysing calls after they end — over MongoDB, with LiveKit behind the browser test calls and the workflow engine.</p>

<h3 class="sec">The product boundary</h3>
<p>Written into the onboarding brief so it stops being re-litigated: this is <mark>not a general drag-and-drop bot builder</mark>. It is a prompt, settings, catalog, test-call, transcript, observability and dialing-strategy platform. Campaigns are authored here and executed by an external dialer. The runtime is LiveKit Agents native.</p>

<h3 class="sec">What the platform gives us</h3>
<p>FastAPI provides routing, validation and dependency-injected auth. LiveKit provides WebRTC rooms for browser test calls and the agent-handoff machinery the workflow engine builds on. MongoDB is the document store. React Flow provides the graph canvas.</p>

<h3 class="sec">What we own</h3>
<p>The draft/publish/rollback lifecycle and its immutable per-call snapshot guarantee. The compiler that turns a drawn graph into live agent handoffs. The campaign claim/lease engine with stale reclaim and a retry cap. The ₹ pricing model and budget-based stack routing. The evals harness, the alert-rule engine, RBAC and audit, and the entire dashboard.</p>

<h3 class="sec">The invariant everything rests on</h3>
<p>A live call resolves its configuration exactly once, at room start, and copies it into its own transcript as <code>config_snapshot</code>. Publishing a new version affects only calls that begin afterwards. Stated in the onboarding brief as a rule not to break, and it is what makes publishing during business hours a non-event.</p>

<h3 class="sec">Scope of this atlas</h3>
<p>This covers the platform — the dashboard, API, and the campaign and alert workers. The voice runtime it manages (the telephony dispatcher, conversation pipelines, and post-call analysis) is mapped separately in the companion <code>voice-ai-atlas</code>. Company name and internal endpoints are placeholders; everything structural is as it ran.</p>

<h3 class="sec">Filesystem</h3>
<pre>backend/
  main.py                  # FastAPI app
  routers/                 # 21 routers — bots(26 endpoints), campaigns(19),
                           #   auth(9), pricing(5), alerts(5), analytics,
                           #   evals, testcall, transcripts, dialer_webhooks…
  campaign_execution.py    # claim / lease / complete for call jobs
  pricing.py               # pure ₹ arithmetic + budget stack routing
  evals.py                 # scripted scenario runner
  post_call_analysis.py    # schema-driven extraction for workflow bots
  metrics.py               # one shared definition of "did not fail"
  auth.py, sso.py, audit.py
voicebot_platform/
  config_store.py          # bots, draft/published versions, rollback
  livekit_sessions.py      # browser test-call rooms
  observability.py         # trace + call-event helpers
  option_catalogs.py, phrase_library.py, outcome_catalog.py
workflow_engine.py         # visual graph -> live agent handoffs
flow_compiler.py           # graph -> prompt text (Phase A)
agent_resolver.py          # inbound number -> bot -> published version
campaign_dialer_worker/    # feeds leads to the external dialer  (⚠ dials real numbers)
alert_worker/              # evaluates alert rules, opens incidents
frontend/src/
  views/                   # 29 views incl. Builder, FlowBuilder,
                           #   WorkflowBuilder, Campaigns, Analytics
  components/              # ~90 components</pre>

<h3 class="sec">Data stores</h3>
<pre>platform DB       bots · bot_versions · bot_templates · campaigns
                  campaign_leads · agent_number_mapping
                  alert_rules · alert_incidents · users · audit
transcript DB     call_transcripts (with config_snapshot) · call_events
                  — a SEPARATE database, reached by its own client</pre>`;

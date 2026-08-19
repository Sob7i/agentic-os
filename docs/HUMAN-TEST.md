# Agentic OS — what it does, in plain language

> **Who this is for:** you, sitting in front of the app, wanting to know what you are looking at and
> whether it is telling you the truth. No code. No spec numbers unless they help you find something.
>
> **The one rule that explains every design choice here:** *this app is not allowed to tell you
> something it did not check.* If it says a project has drifted, it will show you the sentence it
> read and the fact that contradicts it. If it doesn't know something, it says so instead of showing
> a zero. Most of the odd-looking decisions below exist to keep that true.
>
> **How to read the ✅ boxes:** each one is something you can do right now, by hand, and see for
> yourself. If a box doesn't behave as written, that is a bug worth reporting — the doc is the
> claim, the app is the fact.

---

## The two halves

The app is two products sharing one window, and it helps enormously to know which half you are in.

**The Board (the watcher).** Looks at your projects and tells you where their *notes* disagree with
*reality*. It never changes anything on its own. Think of it as a colleague who reads your handoff
docs, checks them against git and GitHub, and says "this says PRs 1–22 are merged, but 23 is merged
and 24 is open."

**The execution layer (the worker).** Per project, opt-in. Runs AI agents that actually do work in
your repo. Tasks, sessions, an inbox for when the agent needs to ask you something.

**Why both.** An AI agent can happily spend five hours and real money working from a document that
went stale twelve days ago, and nothing inside it would notice — every safety check an agent has
measures *how it is going*, never *whether the premise was true*. The Board is the half that
catches that. That is the entire reason these are one product.

---

## Part 1 — The Board

**Where:** `pnpm dev`, then open `localhost:3000`.

You get one row per watched project. Each row carries a symbol:

| Symbol | Means | In plain terms |
|---|---|---|
| `⚠ drift` | A document claims something git disagrees with | "Your notes are wrong" |
| `○ attention` | Something looks off but no direct contradiction | "Worth a look" |
| `✓ in sync` | Checked, nothing found | "Your notes match reality" |
| `◌ unverifiable` | No state document to check against | "Nothing to compare" |

**`◌ unverifiable` is not a failure.** A project with no handoff doc can't have a claim that
contradicts anything. Showing it as green would be a lie of omission; showing it as a problem would
be nagging. It gets its own symbol.

> ✅ **Try it:** open the Board. Every row shows *when* it was checked. Nothing on this page is
> asserted without a timestamp — that is the rule, applied to the app's own claims about itself.

### When it finds drift, it shows its work

A drift card quotes **the exact sentence** from your document, then the verified fact beside it,
then the file it came from. Not a summary. Not a paraphrase.

> ✅ **Try it:** find the nadim card. It quotes *"PRs #1 through #22 merged"* and reports
> `#23 is merged (1 past the claim); unclaimed open: #24`, citing `docs/HANDOFF.md`.

### Fixing it is one click, and only ever one click

When the Board can write a correction, it offers one. **It never writes anything on its own** —
there is no auto-fix, and there is no setting to turn one on.

Three things about the button that are deliberate:

- **The browser never says what to write.** When you click, the server re-reads the file and rebuilds
  the correction from scratch. What your browser sends is essentially "yes" — it can't smuggle in a
  file path or new text.
- **All of it or none of it.** If any part of the write fails, nothing is written.
- **"Leave as is" is a real answer.** The second button acknowledges the drift rather than rejecting
  it. If the underlying claim later changes, the acknowledgement expires by itself — because it was
  tied to the exact text you acknowledged, not to the card.

> ✅ **Try it:** click Approve on a proposal, then reload. The card should re-check itself and
> decide independently whether the drift is gone. Undo is `git checkout -- <the file>` in that repo.
>
> **Nobody has ever done this.** No proposal has been approved on a real project. Until one is, the
> writing half of the Board is tested but unproven — and that is stated here rather than glossed.

---

## Part 2 — Inside a project

Click a project. You are now in its own view, with a **ribbon** across the top showing all your
projects as symbols.

**The ribbon is always there, even while you're deep in one project.** That is on purpose. The whole
premise is that you shouldn't get absorbed in one project while another quietly rots.

**Below it, a drift band appears — but only when *this* project has drifted.** It quotes the Board's
sentence word for word and links back. It never re-words or re-scores anything; there is exactly one
place drift is decided.

> ✅ **Try it:** open a project that has drifted, then one that hasn't. The band appears in the first
> and is absent in the second. The ribbon is present in both.

### Five tabs, and that's the cap

`Tasks · Goals · Inbox · Sessions · Costs`. Everything else — agents, templates, repos — lives
behind **configuration**.

The split is *work* versus *setup*. Five is a deliberate ceiling: the moment setup screens start
appearing next to work screens, the page stops answering "what needs me?" and starts answering
"what exists?".

---

## Part 3 — The Tasks board

Four columns: **todo · doing · review · done**.

### Cards, and the line that matters most

Every card can carry an **evidence line** — the reason the card is allowed to claim what it claims.

| Card | Shows | Why it looks like that |
|---|---|---|
| **todo** | *nothing* | Nothing has happened yet |
| **running** | `▶ running · 12m · 41 tool calls · $2.10 so far` | Live facts, in monospace |
| **finished by an agent** | `▶ s_2f19ab · 3ac91e2 · 38m · $6.40 · 12 tool calls` | A session id and a commit you can click |
| **failed** | `▶ s_c40d17 · failed after 22m · $4.05` + the reason | The reason verbatim, not "an error occurred" |
| **moved by a person** | *"moved by hand · Sobhi · no session produced this"* | Quoted italics — a claim, not a machine fact |

**Three things here are load-bearing, and all three look like nitpicks until they aren't:**

1. **A `todo` card shows nothing at all** — not a dash, not "—", not "no runs yet". A placeholder
   would be a statement about a run that never happened.
2. **Machine-produced and human-produced evidence look different before you read them.** Monospace
   with an id you can click versus quoted italics naming a person. You should never have to squint
   to tell "a computer did this and here's the proof" from "someone said so."
3. **Every id resolves.** A commit hash opens the commit; a session id opens the session. An
   identifier you can't look up is decoration pretending to be evidence.

**"Unknown" never renders as zero.** If a run's cost was never reported, the card says
*cost unknown* — not `$0.00`. Zero is a fact; unknown is not.

> ✅ **Try it:** put one card in each state and look at the four evidence lines side by side. You
> should be able to tell machine from human at a glance, without reading.

### The approval gate

A task can be marked as needing human approval. When an agent finishes such a task, it moves the
card to **review** and stops. It cannot mark it done.

**It is stopped twice, independently.** One check refuses the request up front with a reason the
agent can read and adapt to; a second, inside the thing that actually writes the change, refuses
again regardless of how the request got there. The second exists precisely because the first could
be misconfigured.

**You** clicking approve works — and is recorded as *you*, by name, forever.

> ✅ **Try it:** watch an agent take a gated task to review and stop. The card should show
> `human gate` and offer *Approve & mark done*. There is no button an agent could press.

### What this page deliberately refuses to do

- **Nothing moves on a running card.** No spinners, no pulsing. A running task is the one thing you
  are *allowed to ignore* — animating it would spend your attention on the item that least needs it.
- **No activity feed.** What needs you is the Inbox; what happened is Sessions; what's true now is
  the Board. A feed would be a fourth answer to a question already answered three times.
- **Column counts are plain numbers.** Not coloured badges. A count of cards isn't an alert.
- **No agent picker when you hit Run.** The agent is a property of the task, chosen when the task is
  created — otherwise "who should do this?" becomes a decision you make while distracted.

---

## Part 4 — What happens when you hit Run

This is the part most worth understanding, because it explains several things that otherwise look
strange.

1. **Nothing scans for work.** There is no background process picking up tasks. Work is *pushed* —
   something or someone asks for a specific task to run. That is a deliberate choice: a program that
   finds work and starts it on its own is exactly the failure this product exists to catch.

2. **Five checks run first, in order, and stop at the first failure.** Does this project have an
   execution layer? Is the task actually runnable? Is the project under its concurrency limit? Does
   the assigned agent exist? Does the starting commit exist? **A refusal tells you which one
   stopped it**, and writes nothing at all — no half-started session.

3. **A refusal is over.** Nothing is queued, nothing retries. A queue would be a hidden list of
   things that are *about to happen*, which is a second source of truth about the future — the exact
   thing this product exists to prevent.

4. **The agent works in a disposable copy of your repo.** A fresh checkout per run, deleted
   afterwards. Two runs never share a workspace, so one run can't leave a mess the next one inherits.

5. **Every session records the premise it started on.** At the moment a run starts, the app snapshots
   what the Board thought of that project — including "everything was in sync". Later you can ask
   *"what did we believe when this five-hour run began?"* and get an answer.
   **Drift does not block the run.** It is recorded, not enforced. A warning on the most common real
   state of a real project would be dismissed by the third time you saw it.

> ✅ **Try it:** run a task in a project with drift, then look at the session. It should carry the
> drift claim, the contradicting fact, the source file, and a timestamp — as history, phrased in the
> past tense.

### One at a time, per project

By default one session runs per project. A second Run is **refused with a reason**, not queued. You
can run in a *different* project at the same time — the limit is per project, not global.

---

## Part 5 — When the agent needs you

An agent can ask you a question. When it does:

- The task **stays in `doing`** with a "blocked" label. It doesn't move — nothing about the *work*
  changed, only who it's waiting on.
- The session goes to **waiting for inbox**, and **its workspace is deleted**.
- The question appears in the **Inbox**.
- When you answer, a **fresh** workspace is made and the agent continues with your answer.

**The consequence, stated plainly: the conversation resumes, the files do not.** Anything the agent
hadn't committed before asking is gone. The agent is explicitly told to commit before asking.

**Why not just leave it waiting?** Because "waiting" would mean a live process held open, possibly
overnight. It wouldn't survive restarting the app, and a laptop going to sleep would be
indistinguishable from a hung agent. The pause is written to disk instead, so it survives anything.

> ✅ **Try it:** have an agent ask a question. The card stays in `doing` with a blocked label, the
> Inbox shows the question, and the workspace is gone. Answer it and watch the agent resume.

### Nothing lies about being alive

If you restart the app while a session is running, that session is dead — the process is gone. On
startup the app finds any session claiming to run from a previous process and marks it
**interrupted**, with the reason recorded, its task moved back, and its logs kept.

**It reports the loss rather than hiding it.** A row saying "running" with nothing behind it is
precisely the kind of stale claim this whole product is about — it would be embarrassing to allow it
here.

> ✅ **Try it:** start a run, restart `pnpm dev`, look at the session. It should say interrupted,
> with a reason, and the task should be back in its previous column.

---

## Part 6 — Reading a session

Click any session id. You get: how long it ran, what it cost, every tool call in order, the commits
it made, and any questions it asked.

**The commits are read from git, never from our own records.** If the app says a run produced a
commit, that commit exists — it was read out of the repository, not remembered by us.

---

## What is NOT true yet — read this before testing

Being straight about this is more useful than a demo.

1. **No real project is connected yet.** The pieces all work and are tested, but nothing yet turns
   "this project has an `agentos.yml`" into "this project has a record in the database". Until that
   exists, the Tasks page will honestly say *not initialized* rather than inventing anything.
   **This is the single thing standing between you and a full cycle**, and it is next.

2. **No agent has ever really run.** Every check runs against a stand-in that replays scripted
   responses — deliberately, so tests cost nothing. There is **one** check that runs a real agent,
   and it is opt-in because it costs money and needs the network. **It has never been run.** Until
   it is, everything else is only proof that the parts fit together, not that they work.

3. **No drift has ever actually been corrected.** See Part 1.

4. **Restarting the app kills running sessions.** Known, reported honestly rather than hidden.

5. **The agent's isolation is not a security boundary.** The disposable workspace stops it from
   *tripping over* other work. A determined process could still read outside it. It is a tidiness
   guarantee, not a sandbox.

6. **One long-standing test failure is expected.** One check hard-codes "this specific project should
   look healthy", and that project stopped being committed to. The check is right; the example rotted.
   Fixing it means changing a written acceptance criterion, so it stays visibly failing rather than
   being quietly edited.

---

## The five promises

If you only remember one section, this is it. These are the things a change is never allowed to
break:

1. **Nothing leaves your machine** except calls to GitHub, and — inside a project you have opted in
   — the AI model itself. No telemetry, no cloud, ever.
2. **Nothing is asserted without a check.** Every fact shows what was checked and when.
3. **Reality wins.** Git is the truth; documents are claims. A claim is never shown with the same
   weight as a verified fact.
4. **Nothing is written without you clicking.** No file in any of your repos changes without an
   explicit approval.
5. **The app invents no state of its own.** Everything traces back to a file, a commit, or a session
   that can be named. A status that can't name what produced it has to render as a claim, not a fact.

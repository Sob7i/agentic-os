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

### Work above the line, setup below it

`Tasks · Goals · Inbox · Sessions · Costs` — then a divider, then a group headed **SETUP**:
`Agents · Templates · Environments · Repos`. Three of those four say what will build them and are
honest that they are not built yet.

The split is *work* versus *setup*, and the question each half answers: above the line is "what
needs me?", below it is "what exists?". **Changed in Stage 3c (D32).** It used to be five tabs plus
a single `configuration` link, described here as a hard ceiling — but that ceiling came from a
design concept with *horizontal* tabs, which physically run out of room. This rail is vertical and
never had that limit, so what was holding the split was a section boundary all along. It is now one
on purpose, carried in the URL too: work is `/p/<slug>/<tab>`, setup is `/p/<slug>/config/<section>`.

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

### Moving a card by dragging it

Since Stage 3c you can drag a card between columns. Two things about that are deliberate.

**A dragged card is recorded as moved by hand, and says so.** It gets the quoted-italic line —
*"moved by hand · owner · no session produced this"* — naming **you** between the separators, not
the monospace machine line. That is the same
distinction Part 3 opens with, and drag does not get an exemption from it: dragging is a new
gesture, not a new kind of evidence.

**A card with a human gate refuses to be dragged to done.** It tells you to use *Approve & mark
done* instead. This looks like friction and is the point: the gate exists to make approving a
deliberate act, and dragging is the cheapest gesture in the interface. The refusal is enforced
**twice** — once in the browser so the drag simply will not land, and once in the server action,
which does not trust that the first one happened.

**The words are written for you, not for an agent.** The same refusal shown to a session says *"a
session may not move it to 'done'"* and points at a tool called `inbox_ask`. You are not a session
and cannot call that tool, so you get a different sentence from the same source.

> ✅ **Try it:** drag a task from todo to doing, and read its evidence line — it should be the
> quoted human one. Then create a task with *Require approval before done*, get it to review, and
> try to drag it to done. It should refuse, name the Approve button, and the card should not move.

> ✅ **Try it with the keyboard, too:** tab to a card, press space to lift it, arrow to another
> column, space to drop. If that does not work, the drag library has not earned its place — the
> buttons it replaced were fully keyboard-operable.

### Adding a task or an agent

Both forms now open in a **drawer** that slides in from the right, rather than sitting on the page.
Escape closes it, focus is trapped inside it while it is open, and the page behind it is inert.

**One deliberate exception:** while a submission is in flight, Escape is refused. A refusal that
arrives a moment later needs somewhere to land, and a drawer that has already closed does not have
it.

**A successful save does not always close the drawer.** If an agent is created with `WebFetch` or
`WebSearch` in its grants, the egress floor strips them and the drawer stays open carrying that
note — the save worked, and you are being told what was taken away from it. A drawer that closed on
success would delete the one place that sentence appears.

**You cannot trigger that from the form, and that is deliberate.** The two tools are not offered as
checkboxes at all (Part 7, step 3), so the note only appears for a request the UI does not make —
one built by hand against the action. The floor is enforced anyway, because a server action is
reachable by any POST; `pnpm verify:stage3c` → AC-9 is where that path is exercised. It is described
here because it is the reason the drawer's close rule is what it is, not because you can reproduce
it by clicking.

> ✅ **Try it:** open *+ Agent*, fill it in, save — the drawer should close and the agent should
> appear behind it. Then open it again and press save with **Name** empty: the browser refuses the
> submission itself and the drawer stays open, having sent nothing. (The forms mark their required
> fields, so an empty field never reaches the server — the drawer's own "stay open and show the
> reason" path is for refusals the *server* returns.)

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

2. **Five checks run first, in order, and stop at the first failure — then a sixth runs once the
   workspace exists.** Does this project have an execution layer? Is the task actually runnable? Is
   the project under its concurrency limit? Does the assigned agent exist? Does the starting commit
   exist? **A refusal tells you which one stopped it**, and writes nothing at all — no half-started
   session. **Stage 4b adds one more, after those five:** if the project declares a `prepare:`
   command (installing dependencies, say), it runs in the fresh workspace *before* the model is ever
   called, and a non-zero exit refuses the run the same way — no session, no cost, and even the
   branch the workspace was about to commit to is removed rather than left empty.

3. **A refusal is over.** Nothing is queued, nothing retries. A queue would be a hidden list of
   things that are *about to happen*, which is a second source of truth about the future — the exact
   thing this product exists to prevent.

4. **The agent works in a disposable copy of your repo — on a real branch, not a nameless copy.**
   A fresh checkout per run, on a branch named after the task (`agentos/<task>-<id>`), deleted
   afterwards. Two runs never share a workspace, so one run can't leave a mess the next one
   inherits. **What "deleted" no longer means, since Stage 4b:** the *workspace* — the directory the
   agent worked in — is gone; the *branch* survives as long as the run committed something, exactly
   the way any other local branch would. A run that commits nothing deletes its own empty branch
   too, so `git branch --list 'agentos/*'` only ever shows branches with real work on them.

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

**What changed with Stage 4b: what it HAD committed before asking now survives too.** The fresh
workspace resume gets is not a fresh branch — it's the same one the first part of the run was
already committing to, checked out again. So a question asked after two real commits resumes onto
a workspace that still has both of them, even though the directory itself was deleted and rebuilt
in between. Before Stage 4b those earlier commits lived nowhere but a detached checkout that was
about to be thrown away with the rest of the workspace; now they are on a ref, exactly like
anything else in the repo.

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

**Since Stage 4b, a finished session with real commits carries one more thing: a button.** It reads
*"Push `agentos/<branch>` & open PR → <base>"* — never "Ship", because a push and an opened PR is
exactly what the one click does and nothing more. It's one click: it pushes the branch, opens a PR
against the project's integration branch (`develop` unless the project says otherwise), and writes
the session's own evidence — cost, drift at spawn, every commit, whether verification passed — into
the PR body, so the reviewer never has to click back here to see it. If the project declared a
`verify:` command and it did not pass, the button is replaced by a checkbox you have to tick first —
naming the failing check — before the same click will push anyway. **It never appears on a session
that's still running**, only on one that has settled with a branch and at least one commit, and once
it has been clicked the button becomes the PR's own link.

> ✅ **Try it:** finish a run that made at least one commit, open its session page, and read the
> button's own label before clicking anything — it should name the exact branch and the exact base,
> not a euphemism for either.

---

## Part 7 — Running the whole cycle, on a real project

Everything above is proven against fixtures: real git repos in a temp directory, a real in-memory
database, a scripted stand-in for the model that asks a scripted question and gives a scripted
answer (`pnpm verify:stage3b`'s AC-9 runs exactly this sequence — dispatch, pause, resume, review,
approve — and checks every step, not just the ending). **Nobody has run this by hand, on a real
project, with a real agent, yet.** These are the exact steps to be the first.

**What step 5 costs.** Only step 5 below spawns a real session against the real Agent SDK. That is
the one step that uses the network and costs money. Every step before it is free and entirely local.

**Step 1 — opt a project in. Already done for this repo (2026-08-20, D31).** A project joins the
execution layer by having an `agentos.yml` at its root, and **agentic-os now has one** — so you can
start at step 2 against this project without writing anything anywhere.

For any *other* project, this step is yours and only yours: it writes into another repo, which is a
human-only act here (`CLAUDE.md`'s write gate). Add a file at that repo's root named `agentos.yml`:

```yaml
slug: <the name the Board shows for it>
maxConcurrentSessions: 1
```

Both keys are optional with stated defaults, so even an empty file is a valid opt-in — the file's
*presence* is the signal (D18). For the first real agent run on a real repo the target is
`fractal-code` ([`DECISIONS.md`](DECISIONS.md) D27), with `canCommit` left off.

> ✅ **Try it:** `pnpm dev`, then open the **agentic-os** project from the Board. Its rail carries
> five work tabs — `Tasks · Goals · Inbox · Sessions · Costs` — then a divider and a **SETUP** group
> of four. Open any other project and the rail is empty: that is D18's opt-in working, not a broken
> page.

**Step 2 — initialize.** Next to that sentence is an **Initialize** button. Click it once.

> ✅ **Try it:** the page stops saying *not initialized*, and the five work tabs become usable —
> `Tasks · Goals · Inbox · Sessions · Costs`. Click Initialize again later and it says
> *already initialized*, writing nothing a second time.

**Step 3 — create an agent.** In the rail's **SETUP** group, below the divider, open **Agents**
(`/p/<slug>/config/agents`) and press **+ Agent** — it opens in a drawer. Setup sits below the line
rather than beside the work tabs (D32) — add one: a name, a monogram, a model, a role prompt, and the tools it actually needs.
WebFetch and WebSearch are not offered as checkboxes at all — the egress floor denies both
unconditionally, so the form does not pretend to offer what it cannot grant. For a first real run on
a real repo, leave **canCommit off** — the same conservative default D27 chose for this project.

> ✅ **Try it:** the drawer closes and the agent appears on the Agents page with exactly the grants
> you gave it.

**Step 4 — create a task.** On the Tasks tab, add one: a title, a short description, the agent from
step 3 as its assignee, and turn the approval gate on so you get to see review-and-approve for real
rather than take it on faith.

> ✅ **Try it:** the card appears in `todo`, the agent's monogram on it, no evidence line — nothing
> has happened yet, and the card says so by saying nothing.

**Step 5 — run it. This is the step that costs money and touches the network.** Click **Run now**.

> ✅ **Try it:** the card moves to `doing` and, moments later, carries a live evidence line —
> `▶ running · …`. Reload and the numbers climb; nothing animates on its own (Part 3's own rule).

**Step 6 — if it asks you something.** A real agent may genuinely need to ask you something. If it
does, the card stays in `doing` with a `blocked` label and the question appears in the **Inbox**.
Answer it there.

> ✅ **Try it:** after you answer, the same session continues — not a new one — and the card keeps
> running.

**Step 7 — approve it.** Because the task was gated, the agent stops itself at `review` instead of
closing the task. The card shows `human gate` and an **Approve & mark done** button — click it.

> ✅ **Try it:** the card moves to `done`. Its evidence line switches from the session's own
> `▶ s_… · …` line to *"moved by hand · [you] · no session produced this"* — that is not the run
> disappearing, it is the card naming whoever is now vouching for the current state
> ([`specs/stage-3-execution-mvp.spec.md`](specs/stage-3-execution-mvp.spec.md) §8.3's own
> distinction). The session itself does not vanish: it is still listed,
> whole, on the **Sessions** tab, with every tool call and commit it made.

That is the loop, closed once, by hand. **Until someone runs these seven steps, Stage 3b's own
acceptance criterion is unmet** — its spec says so directly: "Stage 3b's value is only realised once
a human runs the cycle by hand" — the same honesty Part 1 already applies to the Board's own
never-yet-clicked Approve button.

---

## What is NOT true yet — read this before testing

Being straight about this is more useful than a demo.

1. **No real project has run the cycle yet.** The connector, the agent and task forms, and the full
   dispatch → pause → resume → review → approve cycle are all built and proven against fixtures.
   What has never happened is a human running it on a real project with a real agent — no watched
   repo has an `agentos.yml` yet. **Part 7 above is the exact walkthrough**, starting with the one
   step only the owner can do.

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

7. **No branch this product created has ever actually been pushed.** Push-and-open-PR (Part 6) is
   built and proven against a real bare git repo in a temp directory, standing in for GitHub — every
   check that matters (the remote gains the branch, the PR body carries the session's own evidence,
   a failed verification refuses the click) is proven that way. What has never happened: **one real
   branch, pushed, with a real PR opened on GitHub, reviewed by a human, and merged by the owner.**
   Same shape as items 1 and 3 above — this is Stage 4b's own version of "the parts fit together, not
   that they've been used for real."

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

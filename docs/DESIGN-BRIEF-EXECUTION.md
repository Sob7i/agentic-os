# Agentic OS — Design Brief: the execution layer and the app shell

> **For:** the design agent drafting the new interface
> **Status:** brief · written 2026-08-15 · **round 3 delivered and closed 2026-08-18** · nothing
> here is built yet
>
> **⚠ Round 3 is answered — read this before treating anything below as open.** The delivery is
> [`design/wireframes2.pen`](../design/wireframes2.pen): frames `C1`–`C5` (Concept C), `B′1`–`B′2`
> (Concept B′), `T1`, `G1`, `P1`, `S1`, `S2`, `I1`, `I2`, `$1`, `A1`, three dark frames, and six
> rationale notes. **The shell is closed as D23: Concept B′, the mode switch, with a persistent
> portfolio ribbon and a conditional drift band** — *not* the design's own recommendation of C, and
> D23 states why. The design's *"Positions on the ten open questions"* note answers §10 and is
> **adopted unchanged except position 1** (architecture), which D23 overrides. §4's four
> architectures and §10's ten questions are therefore history, not an open brief.
> **Reads with:** [`PRD.md`](PRD.md) **§12 first**, then §2 and §6.8 · [`DECISIONS.md`](DECISIONS.md)
> **D18–D22** — these are closed and are not open for redesign
> **Source reference:** [`specs/AgentOS-spec.md`](specs/AgentOS-spec.md) §9–§13, §18
> **Paired with:** [`DESIGN-BRIEF.md`](DESIGN-BRIEF.md) — the *portfolio* brief (rounds 1–2). Its
> §6 visual direction and §7 constraints still govern everything here unless this file overrides
> them explicitly, and where it does, it says so and says why.

---

## 1 · The one-sentence brief

The product just grew a second half. It used to only *watch* projects; now, inside a project, it
**runs the work** — agents, tasks, goals, an inbox, live sessions, costs.

**Design the shell that holds both without making either worse.** That is the actual commission.
The screens themselves are mostly solved shapes (a Kanban is a Kanban); the unsolved problem is
the *architecture* — two layers, two tempos, one window, and a strict instruction not to turn a
calm instrument into an attention machine.

---

## 2 · What changed, in one table

| | Portfolio layer *(exists)* | Execution layer *(new)* |
|---|---|---|
| Scope | all 6 projects | one project at a time, opt-in |
| Direction | watches | acts |
| State | stores nothing; everything derived | stores tasks, goals, sessions — each with evidence |
| Tempo | **3–10 seconds**, then closed | **minutes to hours**, kept open |
| Liveness | static until reloaded (D8) | **things happen while you look** |
| Surfaces | Board · Overview | Tasks · Goals · Inbox · Sessions · Costs |

**The last two rows are the whole design problem.** Everything in the existing brief was written
for a surface that is consulted and closed. Half the new product is a surface you *sit in* while
an agent works, and it changes on its own. Those two things want opposite designs, and they now
share a window.

---

## 3 · Who uses it — a fourth usage moment

The portfolio brief §2 names three moments. Add one, and note it is by far the longest:

| Moment | Duration | Need |
|---|---|---|
| Session start *(existing, primary)* | 3–10 s | "What's stale? What changed?" Scan, act, leave. |
| Ambient glance *(existing)* | 1–2 s | Peripheral vision. Is anything red? |
| Weekly review *(existing)* | 2–5 min | Spend, velocity, backlog. |
| **Working a project** *(new)* | **minutes–hours** | File a task, watch a session, answer a blocked agent, approve a gate. |

Still one user: Sobhi. Solo, technical, no team views, no onboarding.

**The consequence for you:** the new moment is the *longest* but it is not the *most important*.
Session start still is. A shell that optimises for the hours and degrades the ten seconds has
failed, even though it will feel better in a demo. The existing brief's success criterion 10 —
*"the Board keeps its primacy"* — is inherited verbatim and is the hardest one to pass.

---

## 4 · The navigation problem *(the main ask — spend the most effort here)*

The owner's instinct, and the starting point: **portfolio surfaces at the top level; the execution
layer nested inside a project.** That is correct and it follows from D18. The open question is the
one worth designing:

> **How do you nest a whole application inside a project row without making navigation deep,
> modal, or noisy — when the outer layer's entire value is that you never have to remember to
> look at it?**

### 4.1 · Two observations that shrink the problem before you start

**(a) Most of the reference app's navigation is configuration, not work.** The source UI
(AgentOS-spec §18, and the reference screenshot) carries roughly fifteen sidebar items: Inboxes,
Activity, Tasks, Goals, Sessions, Costs, Skills, Environments, Agents, Templates, Files,
Knowledge, Repos, Connections, Admin. **Ten of those are setup you touch once a month.** The
surfaces you are actually in are five:

> **Tasks · Goals · Inbox · Sessions · Costs**

Agents and Templates — both named as important — are **configuration**: you define an agent once
and then assign it a hundred times. Treat them accordingly and the visible navigation halves. This
split is a requirement, not a suggestion: **five work surfaces in the primary navigation; setup
reachable but not resident.**

**(b) Six projects, and it will never be sixty.** The portfolio brief §4 fixes the scale: 6 today,
≤ 12 ever, no pagination, no infinite scroll. A project switcher for six items is not a hard
problem — it can be a permanently visible list rather than a dropdown, which removes a whole class
of navigation cost that the reference app pays.

### 4.2 · Four architectures — show at least two, and argue for one

**A · Two-tier sidebar.** Portfolio items on top (Board, Overview), a divider, the project list,
and the current project's five surfaces indented beneath it. Everything always visible.
*Optimises:* no modes, no disorientation, one click to anything.
*Sacrifices:* the sidebar becomes the busiest element on screen and stays busy while you are
thinking about the portfolio; indentation is doing a lot of semantic work.

**B · Mode switch** *(faithful to the reference)*. The portfolio is home. Entering a project
replaces the sidebar entirely with that project's surfaces, with a prominent `← All projects` and
the project name at the top.
*Optimises:* zero distraction inside a project; the project nav can grow without ever costing the
portfolio.
*Sacrifices:* **you lose sight of the other five projects — and not having to remember to look is
the portfolio's entire value.** Switching projects costs two clicks. The swap disorients.

**C · Portfolio as a persistent spine; the project as the pane.** The six-row roster lives
permanently in a left rail — it already fits without scrolling and is already quiet by design.
Selecting a project opens its execution layer in the main pane, with the five surfaces as
**horizontal tabs at the top of that pane**, not in the rail. Configuration sits behind a control
on the project header.
*Optimises:* the portfolio never disappears, so the ambient glance is satisfied permanently rather
than on visit; one click to any project, always; horizontal tabs physically cap at five or six,
which **enforces** the work/setup split from §4.1a instead of merely encouraging it.
*Sacrifices:* horizontal room in the main pane; the rail does two jobs at once (navigation *and*
instrument), and if the roster ever gets loud it will be loud while you are trying to work.

**D · One page, no project navigation** *(provocation — include it if it survives your own
critique)*. Answer "don't make navigation hard" by deleting navigation: the project surface is a
single scrolling page with Tasks, Inbox, and Sessions stacked, because a solo operator working one
project usually wants the board and the blocked question visible together.
*Optimises:* nothing to learn, nothing to click.
*Sacrifices:* almost certainly cramped, and Costs and Goals have no good home. Show it only if you
find a version that works.

### 4.3 · The brief's own lean, and why

**C is the recommendation** — not because it is tidier, but because of a claim you should test
rather than accept: **the portfolio is not a navigation index, it is a live instrument.** In A it
is a menu item. In B it is a place you left. In C it is peripheral vision, which is exactly the
"ambient glance" moment the existing brief already identified and could never fully serve while
the Board was a destination.

**Disagree if you can argue it.** The thing that would beat C is a version of B that solves losing
sight of the portfolio — a persistent, minimal drift signal that survives the mode switch. If you
find that, B may well be better, because B's zero-distraction interior is genuinely valuable and
C pays for its rail forever.

### 4.4 · Three rules any architecture must satisfy

1. **The Board is reachable in one action from anywhere**, including from inside a running
   session. Session start is still the primary moment and it must not cost a back-navigation.
2. **A project's drift state is visible while you work inside that project.** Not as a
   notification — as the provenance and pre-flight treatments in §6.7. This is the data flow that
   justifies the whole architecture (PRD §12.1); if the design severs it, the layers are merely
   adjacent rather than integrated.
3. **A project without an execution layer must not look broken.** Four of six will be in that
   state for months. It is *"not instantiated"*, exactly like an unfilled role — an invitation at
   most, never an error, never an empty-state illustration.

---

## 5 · The attention problem *(read before designing any screen)*

The existing brief's anti-goals include, verbatim:

> Notifications, badges, streaks, or any engagement mechanic. **This tool should be opened *less*
> as things improve.**

**That rule is now in direct tension with the product**, and pretending otherwise would produce a
design that fails in use. An executor genuinely needs to tell you an agent is blocked — that is
the Inbox, and it is the source spec's entire human-interrupt model (§12). The reference UI
resolves the tension by covering itself in counters: `Inboxes 17`, `MMO Game 24`, `Review 1`,
`Done 9`, `Runner · Running`.

**The line this brief draws, for you to design against:**

> **Exactly one counter is legitimate: the Inbox's count of open questions — because it counts
> work blocked on you, not activity.** It should trend to zero, and zero is the goal state. Every
> other quantity is ambient and gets no badge: sessions running, tasks moved, activity, cost
> accrued.

Two clarifications that follow:

- **Runner / session status is not a badge, it is an instrument reading** — the same category as
  the freshness indicator the Board already has, and it should look like it rather than like a
  notification.
- **Cost belongs on a card, but in the fact register.** Monospace, beside the commit sha, the same
  weight as any other verified number. `$59.13` set as a highlighted metric turns the board into a
  spend dashboard; set as a fact it does the job the spend caps need it to do.

**If you think this line is wrong, say so with a reason.** It is a considered position, not a
settled decision, and it is the single easiest way for this product to lose its register.

---

## 6 · Screens

### 6.1 · The shell *(§4 — the main effort)*

Deliverable is the architecture, in both a portfolio-focused state and a working-in-a-project
state, plus the transition between them. Include: how the six-project switcher works, where
configuration (Agents, Templates, and the rest) lives, and what a project with no execution layer
looks like.

### 6.2 · Tasks — the Kanban *(second-most effort)*

Columns `todo · doing · review · done` (AgentOS-spec §9.1). Per card: name, assigned agent,
schedule (once / at / cron), status, cost, and — see below — its evidence.

**The design problem that is specific to this product, and it is not a small one:**

> **D19 permits stored status only because every transition carries the session and commit that
> produced it.** A card in `done` must show *what produced it*. A card moved by a human must be
> visibly weaker than one moved by an executed session.

This is the Board's claim-versus-fact distinction (portfolio brief §3), one layer down and applied
to statuses instead of documents. The existing solution — quoted sans for claims, monospace for
machine facts — is available to inherit, and inheriting it would make the two layers read as one
argument. **Show how an executed card and a hand-moved card differ at a glance.**

Also design: **the approval gate on a card.** A gated card can reach `review` under agent control
and can only reach `done` by human action; the API refuses the agent (§9.3). The card must make
that legible without a modal — this product already has a strong gate treatment in the shipped fix
proposal, and consistency with it is worth more than novelty.

### 6.3 · Goals

Per AgentOS-spec §11 and PRD §12.6. Contents: the spec it came from, the definition-of-done
checkboxes and whether the human has approved them, the append-only progress log, the three
rails (spend cap, max duration, stuck count) with current values against their caps, and the
session history.

Two things to solve:

1. **The DoD approval gate.** A goal must not start before a human approves its definition of
   done. That is the highest-stakes single click in the product — it authorises hours of unattended
   work and real money — and it should feel like more than a checkbox, without becoming ceremony.
2. **A rail approaching its cap is the one genuinely time-critical thing in the whole design.**
   `$47 of $50` matters in a way nothing on the Board ever does. Solve it without inventing a
   progress-bar aesthetic the rest of the product does not have.

### 6.4 · Inbox

The only interrupt channel (§12). Text messages and multiple-choice questions with radio buttons;
answering resumes a paused session with the answer in context.

Design for the fact that **answering is the highest-value action in the product** — a session is
stopped and costing nothing while it waits, and the reply is what restarts hours of work. It
should be answerable in seconds, and it is the one surface that must work on a phone-sized
viewport (§9.4).

Show a question with its **context**: which agent, which task or goal, what it was doing when it
stopped. A question without that is unanswerable, and the reference design does not solve it.

### 6.5 · Sessions and the live viewer

History of runs plus a live view of tool calls while a session is `running`.

**This is the biggest single risk to the product's register, and it should be designed
defensively.** A stream of tool calls scrolling in real time is inherently mesmerising and is the
exact opposite of "an instrument, consulted and closed". The reference app treats it as a feature;
this product should treat it as something you **opt into deliberately**, that does not follow you
around, and that is honest about the fact that watching it changes nothing.

Design the finished-session view with as much care as the live one — it is the one people will
actually use, and it is the evidence D19 requires: tool calls, duration, cost, commits, and the
task it served.

### 6.6 · Costs

Per session, per task, per goal, per project. The portfolio-wide retrospective panel is a later
stage (PRD §7, §6.3) — **do not design it here**; design the cost surface *inside* a project.

Inherited constraint, non-negotiable: **every derived metric shows its formula.** The existing
brief §5.3 explains why with a real example — the reference screenshot shipped "Merge time
reduction: −403%" and "Bugs caught: 0", both plainly broken and both shipped anyway.

### 6.7 · The drift pre-flight *(the differentiator — design it properly)*

**This is the one screen no other agent platform can have**, and it is the reason the two layers
are one product (PRD §12.1, §12.6):

> Before a goal spawns its first session, the system checks the Board's state for that project's
> primary repo. If the repo is in `⚠ drift`, the goal names the document and the claim, and waits
> for an explicit acknowledgement.

Design that moment. It is a **warning, not a block** — the drift may be irrelevant to this goal,
and a system that refuses to work because a document is stale will be routed around within a week.
It must be dismissible with a reason, and it must be more legible than an ordinary confirmation,
because the thing it prevents is expensive and silent.

Related, and part of the same deliverable: **the fourth provenance level, `▶ executed`** (D22).
The ladder is now `▶ executed` > `◆ derived` > `✓ verified` > `~ suspect`. Executed items carry a
session id and a commit sha. The existing brief §5.5.1's constraint still holds — *suspect* must be
visible without reading as an error, and must never borrow the Board's drift red.

### 6.8 · Agents and Templates *(configuration — sketch only, low effort)*

Agent detail per AgentOS-spec §4: name, title, model, role prompt, skills, granted MCPs, repo
access, filesystem grants, collaboration list, runner preference. Template detail: the nine-step
compound-engineer chain with its two human gates.

**One idea worth one sketch:** an agent's grant list is a **security surface** — §5's rule is
default-deny, and the interesting question a human asks is *"what can this thing actually reach?"*
A design that answers that at a glance is worth more than a well-organised settings form. One
concept is enough.

---

## 7 · Visual direction

**Inherit the portfolio brief §6 entirely** — the register (an instrument, not an app), the tone
words (verified · legible · calm · dense-but-not-cramped · trustworthy), the anti-tone (no
gradients, no glow, no purple-blue tech sheen, no rounded-pill everything), the verified surface
and text tokens, the monospace-means-machine-fact rule, and required dark mode.

**The verified status palette is fixed and may not be substituted by eye** — it failed the
`dataviz` validator twice before reaching these values:

| Role | Light ✅ | Dark ✅ |
|---|---|---|
| in sync | `#007d64` | `#0faaaa` |
| attention | `#a1620a` | `#c3871e` |
| drift | `#9f1239` | `#eb5f73` |

**Two extensions this layer needs, and they are yours to propose:**

1. **A "running" treatment.** Nothing in the current palette means *in progress*. It must not be a
   fourth status colour competing with the three above, and it must not pulse or glow. Consider
   whether motion is permissible here at all — the honest answer may be a single quiet indicator
   and nothing else.
2. **An agent identity treatment.** Ten-plus agents appear on cards, in sessions, and in activity.
   They need to be distinguishable at a glance without avatars (§9 forbids them — they imply other
   humans) and without a colour-per-agent scheme that would collide with the status palette.

---

## 8 · Content to design against

**Read this section carefully — it contains a trap this project has fallen into twice.**

Real content, usable directly:

- **The six projects, their real branches and states** — portfolio brief §4. Snapshot values;
  design against the *shape*.
- **Real task text.** Use actual "Next up" items rather than inventing plausible ones. From this
  repo's `HANDOFF.md`: *"Approve nadim's proposal once, by hand (owner gate)"* · *"Write the Stage
  3 spec — the Overview"*. From nadim's `BACKLOG.md`: *"Exercise the live reflection round-trip —
  Unblocked by: Sobhi pasting a real key into `.env.local`"*.
- **The agent roster and the nine-step template** — AgentOS-spec §4 and §10, verbatim.
- **Real drift** — nadim's `docs/HANDOFF.md` claims *"PRs #1 through #22 merged"*; `#23` is merged
  and `#24` has been open since 2026-07-14. This is the string the pre-flight in §6.7 fires on.

**And now the trap. No session has ever run.** There is no real cost figure, no real tool-call log,
no real commit produced by an agent, and no real inbox question — the execution layer does not
exist yet. **Every one of those values in your wireframes will be invented**, which is precisely
the situation that produced two entries in `docs/LEARNINGS.md`: round-1 invented a document to
show a drift, and a wireframe cited a line number that turned out to be wrong by nine lines.

So: **invent what you must, label it as invented in the frame's rationale note, and keep every
string that *can* be real, real.** A task title should be a real task. A repo should be a real
repo. A drift should be the actual drift. Only the things that cannot exist yet — costs,
durations, tool calls — are yours to make up, and they should be *plausible* rather than flattering:
sessions that take hours, costs in tens of dollars, and at least one session that failed.

---

## 9 · Constraints and anti-goals

**Inherited and still binding** (portfolio brief §7): the Board does not scroll at 1440×900; four
severity levels and never a fifth; every fact shows its verification age; no destructive action
without a gate; colour never carries meaning alone; no avatars, no share/export, no account UI, no
team presence.

**New, specific to this layer:**

1. **One counter only** — the Inbox's open questions (§5).
2. **No agent may appear to close its own gate.** If the UI shows a control an agent cannot use,
   it is lying about where authority sits.
3. **Every stored status shows its evidence** — session or human (D19, §6.2). A status with no
   attribution is a claim and must look like one.
4. **No per-project Overview and no per-project drift board** (D22). One question, one surface.
5. **The live viewer is opt-in and does not follow you** (§6.5).
6. **No "+ New" in the portfolio layer.** The existing brief's rule stands: creating work happens
   inside a project. A `+ Create Task` control on the Board has misread the architecture.
7. **The execution layer must not page you for progress.** The Inbox is for decisions and blockage.

**Do not design:** the portfolio cost panel (later stage), triggers, cron automations, the YAML/CLI
surface, a settings screen for projects (they are declared in config), onboarding, or empty-state
illustrations.

---

## 10 · Open questions — take a position, do not ask back

1. **Which architecture** (§4.2), and what does the transition between layers look like?
2. **Does the project switcher show drift state?** Six rows with severity glyphs is the Board in
   miniature — useful, or a second source of the same signal that will disagree with the first?
3. **How does an executed card differ from a hand-moved one** (§6.2) at a glance, not on hover?
4. **What does "running" look like** without motion, glow, or a fourth status colour (§7.1)?
5. **Where does the Inbox live?** It is the highest-value surface and the only one that must work
   on a phone. Is it a project surface, a portfolio surface, or both — and if both, is that a
   contradiction of anti-goal 4?
6. **Is `▶ executed` a fourth glyph in the same family** as ⚠ ○ ✓ ◌, or does it belong to a
   different visual system because it describes an origin rather than a health state?
7. **What does the drift pre-flight look like** (§6.7) — inline on the goal, an interstitial, or
   part of the DoD approval it already has to pass through?
8. **How does a rail near its cap** (`$47 of $50`) get appropriate weight without a progress-bar
   aesthetic (§6.3)?
9. **What does a project with no execution layer look like** when you open it? An invitation, an
   explanation, or simply the Board's view of that project and nothing more?
10. **Does the shell need a global activity feed at all**, or is it the thing that turns this into
    the attention machine §5 is trying to prevent?

---

## 11 · Deliverables

1. **The shell — 2 or 3 architectures** (§4.2), each in a portfolio state and a working state,
   with the transition shown. **The main effort.** A short rationale per concept: what it
   optimises, what it sacrifices — the round-1 and round-2 rationale notes were genuinely useful
   and that habit is the reason the right concept won twice.
2. **Tasks / the Kanban** (§6.2), including the evidence treatment and a gated card.
3. **Goals** (§6.3), including DoD approval and a rail near its cap.
4. **Inbox** (§6.4), desktop and phone-width, with a multiple-choice question.
5. **Sessions** (§6.5) — the finished-session view, and the live view designed defensively.
6. **The drift pre-flight and `▶ executed` provenance** (§6.7). Small surface, disproportionate
   importance: it is the reason this is one product.
7. **Dark mode for the chosen shell** — designed, not inverted.
8. *Low priority, one sketch each:* Costs inside a project (§6.6); the agent grant surface (§6.8).

**Fidelity: wireframe.** Structure, hierarchy, density, states. Use the real palette and type where
they carry meaning; do not polish. This round decides information architecture, and **a beautiful
wrong layout is harder to reject than an ugly one** — which is the reason the previous two rounds
were run at this fidelity and the reason it worked.

---

## 12 · Success criteria

A concept succeeds if:

1. **The Board keeps its primacy.** A stranger can still say which project needs attention in
   three seconds, from a cold open, with the execution layer present. *Inherited, and the hardest
   one to pass.*
2. **Navigation is one action deep in the common case** — Board → a project's tasks, and back.
3. **You can tell what produced a `done` card** without hovering, clicking, or knowing the system.
4. **The blocked agent is unmissable and the running agent is ignorable.** Those two facts have
   opposite urgencies and the design must not treat them alike.
5. **Nothing on screen implies an authority that does not exist** — no control an agent cannot
   use, no status without evidence, no "fixed!" that the system has not verified.
6. **The window is calmer with three sessions running than the reference app is at rest.** If a
   wireframe with live work in it feels busier than the shipped Board, the register has been lost —
   and the register is most of why this product is trusted.
7. **A project with no execution layer reads as a choice, not a gap.**

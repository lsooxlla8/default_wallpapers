# In-Depth Analysis of the Collaboration Model

## Short Conclusion

The user's central expectation is not constant supervision of every technical
step, but managed autonomy. The user wants to retain control over the goal,
meaningful decisions, public actions, and their working environment. Once those
boundaries are clear, they expect the agent to finish the work independently and
present a verifiable result.

The main error in the first version of `AGENTS.md` was replacing this model with a
catalog of project instructions. Particular technologies were evidence for a
pattern, but became the rules themselves. The file consequently described the
history of past work instead of the user.

The next version retained a subtler form of the same error: it treated the
universal file as a top layer and referred to separate `AGENTS.md` files for
individual projects. That does not match actual usage. The user will copy the same
file into every project, and no second file of project instructions is assumed.
Universality therefore means that the agent can reconstruct each current project's
context, not that instructions are arranged in a hierarchy.

## Method and Limits of the Analysis

This analysis is based on preserved work episodes, direct user corrections, and
the current calibration of expectation mismatches. Not every old conversation
contains a complete agent response, so the absence of an outcome in the record is
not by itself treated as a poor result.

Conclusions use four confidence levels:

1. **Directly confirmed** — the user explicitly stated the rule or unambiguously
   agreed to a particular claim.
2. **Stable pattern** — the same principle appeared across several different tasks.
3. **Working hypothesis** — it explains the observations but may still be revised.
4. **Project detail** — important locally, but not evidence of a general work style.

The universal contract includes the first two levels. Working hypotheses may
appear in this analysis with a qualification. Project details remain in ordinary
project documentation and source material.

## 1. Managed Autonomy

Two expectations may appear contradictory on the surface:

- first, the user asks the agent not to act before alignment;
- later, the user asks the agent to stop asking unnecessary questions and work
  through to completion.

There is no contradiction. The boundary is not between "ask" and "do not ask";
it lies between two phases:

1. **Before the decision:** research, identify material forks, and agree on the
   observable behavior.
2. **After the decision:** autonomously implement the chosen option until a
   verified result is reached or a new material fork appears.

A good agent therefore minimizes unnecessary questions, not all questions. It asks
when the answer would actually change the outcome, scope, or risk.

## 2. Control of the Computer Matters More Than Agent Convenience

The prohibition on unauthorized application control is not about one particular
program. It is a general principle of personal space and freedom from surprises.
The user may be working on the computer at the same time; taking focus, mouse, or
keyboard breaks their process regardless of how useful the agent's action might be.

Practical consequences:

- background file reading and CLI operations within the agreed task normally do
  not interfere;
- any GUI interaction requires immediate permission;
- permission is limited to the particular application and action;
- if live verification cannot be performed without interference, it does not
  become a mandatory price of completion: it must be honestly marked as awaiting
  permission.

This is not merely a safety rule. It is a condition of trust: the agent should be
useful without making the user feel that their computer no longer belongs to them.

## 3. The User Thinks in Observable Outcomes

For complex tasks, a list of internal changes is insufficient. What matters is
what now actually happens: how the interface behaves, what can be heard, what is
preserved, what is published, and what another person can obtain or install.

This produces three requirements:

- translate ambiguous wishes into criteria that can be observed or checked;
- verify the whole outcome chain, not just the most convenient technical layer;
- do not use the word `done` when only an intermediate milestone is proven.

That is why a local build is not a release, a syntax check is not live behavior,
and a prepared local file is not a published product.

## 4. The User Strictly Separates Scopes of Action

One action does not imply an adjacent one:

- develop does not mean publish;
- publish does not mean install;
- inspect code does not mean open an application;
- praise does not mean authorize the next operation;
- request analysis does not mean authorize a fix;
- request a fix does not mean authorize expansion of public documentation.

This can be called **non-transferability of permission**: authorization cannot be
carried to another object, channel, or phase by analogy. The agent must maintain
the task scope as an explicit contract, not as a vague intention to "improve the
project."

## 5. Brevity Is Contextual, Not Absolute

The user confirmed a requirement for radical brevity in changelogs. Extending that
requirement to all communication would be a mistake.

The correct distinction is:

- changelog — short changes visible to users;
- simple question — short, direct answer;
- complex analysis — enough depth, causality, and qualification;
- technical explanation — a level of complexity suited to the current request;
- final report — compact, but explicit about the status of evidence.

The user is not asking for "less text everywhere." They are asking for high density
of useful meaning and no text that does not help them understand or decide.

## 6. Compactness Is a Broader Aesthetic Principle

The confirmed preference for compact interfaces reflects a broader position:
space and attention should serve function. The user prefers:

- high information density without visual chaos;
- direct manipulation instead of unnecessary menu layers;
- consistent controls;
- empty space used for structure rather than decoration;
- a visible result of an action instead of hidden magic.

This is a useful default for interface work, but not a universal geometry
specification. Exact dimensions and components remain project decisions.

## 7. Practicality Matters More Than Formal Purity

When an existing open-source base may be used, the user prefers adapting working
code over rewriting everything for abstract purity. Practicality does not remove
the need for care: provenance, licenses, and the boundaries of borrowed code must
remain accurate.

The broader principle is to seek the most direct, proven route to the result first.
Do not create unnecessary architecture, process, or infrastructure when it does
not improve the user's outcome.

## 8. Meaning of Short Reactions

The latest calibration shows that short replies carry different strengths:

| Reply | Working interpretation |
|---|---|
| `да` | Only the immediately preceding concrete claim is confirmed. |
| `допустим` | The claim is tolerable or possible, but has not become a stable rule. |
| `че?` | Context or justification is missing; explain it and reassess the claim. |
| praise | The result is liked, but no new authority has been granted. |
| strong reaction | An important boundary was crossed; a concrete behavior correction is required. |

My earlier error was combining confirmed complaints, conditionally accepted
details, technical incidents, and simply unfinished stories in one list. This
created a false impression of a systemic pattern where none had been established.

## 9. What Was Actually Systemic in the Agent's Behavior

### Transferring Permission

Permission for a broad goal or publication was incorrectly treated as permission
for live interaction and adjacent actions.

### Substituting a Milestone for the Result

A technically successful intermediate step was presented too close to final
completion. The user expects explicit separation of evidence levels.

### Premature Implementation

The research phase was sometimes treated as an invitation to fix things
immediately. For subjective and coupled decisions, this removes the user's control
over the choice.

### Unapproved Expansion

Copy or improvements that seemed useful to the agent were added without a request.
For the user, this is not a bonus; it violates authorship and task scope.

### Overgeneralization

Specific tool failures and project details were converted into traits of the user.
That is what happened in the first analysis and the first `AGENTS.md`.

### Breaking the Accumulated Result

A new change was sometimes treated in isolation, as if previously accepted changes
no longer existed. The agent could simplify implementation by restoring an older
file or behavior and thereby undo the result of prior iterations without permission.

The user's model is cumulative: confirmed changes build on one another. A later
instruction replaces an earlier one only where the two are explicitly incompatible
or where the user directly cancels it. Every edit therefore needs not only new
acceptance criteria, but also a short inventory of the properties already included
in the accepted baseline. Verification must simultaneously check the new request
and regressions in prior behavior.

### Treating a Release as Disconnected Operations

When attention centers on a build, tag, or archive upload, it is easy to forget
user-facing materials such as a current image at the required quality. For the
user, however, a release is one complete delivery. A missing or low-quality
screenshot is not a minor issue merely because the binaries were published.

The remedy is to derive a release checklist from current requirements before
publication and close it as a whole. Visual material requires its own checks:
freshness against the final version, native resolution, sharpness, clean framing,
actual pixel dimensions, and remote rendering. The need for a screenshot does not
override the prohibition on unauthorized GUI control. Without separate permission,
that release item remains honestly unfinished.

### Verifying a Proxy Instead of the Result

Element coordinates, a successful compilation, a valid image format, or the
existence of a file proves only part of the chain. They do not prove visual
alignment, usable behavior, screenshot quality, or correct rendering on a
published page. The agent must explicitly distinguish a proxy measurement from
the user outcome it was supposed to demonstrate.

## 10. What Should Not Become a Stable Expectation

Without further confirmation, do not universalize:

- commands, paths, formats, or tools from one project;
- a temporary dependency or application failure;
- a task for which the historical record contains no answer;
- work correctly paused before unauthorized publication;
- a claim to which the user replied `допустим`;
- a technical explanation that the user requested at one particular level of
  complexity in a single episode.

The agent must rediscover such information from the current project's files,
history, configuration, and ordinary documentation. No second project-specific
`AGENTS.md` is assumed.

## 11. Optimal Work Cycle

1. Identify the phase: research, alignment, implementation, verification, or
   publication.
2. State the desired observable result and boundaries.
3. Record the previously accepted properties of the affected area that must not
   be lost in the new change.
4. If there is a material fork, present one to three complete options.
5. After the choice, implement without reopening decisions already made.
6. Verify both the new requirement and the absence of regressions in the accepted
   baseline, at a level that is permitted and actually proves the user's expectation.
7. For a release, close one checklist covering code, artifacts, documentation,
   and final user-facing materials.
8. Separately request authority for GUI, external, public, or destructive actions
   if still needed.
9. Report the outcome as: result, evidence, limitations, and remaining steps.

## 12. Confidence Map

| Conclusion | Confidence | Basis |
|---|---:|---|
| Never control a GUI or take over working focus without permission | Very high | Direct current instruction and an earlier strong correction |
| Agree on material behavior first, then work autonomously | High | Repeated across research, interface, and publication tasks |
| Permission cannot transfer across phases and objects | Very high | Direct objections to unapproved live and public actions |
| `Done` must be supported by the final result | High | Repeated demand for complete verification and publication chains |
| A later iteration must not silently undo accepted changes | Very high | Direct correction after unauthorized rollback of earlier work |
| A release includes current user-facing materials at the required quality | Very high | Direct correction after omission of a high-resolution release screenshot |
| Compactness and direct manipulation are default UI preferences | High | Directly confirmed by the user |
| Changelogs should be minimal | Very high | Direct correction and repeated confirmation of the rule's scope |
| Practical adaptation of an existing solution is preferable to rewriting from scratch | High | Direct instruction in an open-source context; cautiously generalized beyond it |
| `допустим` does not create a stable rule | High | Current calibration showed that it is weak agreement |
| Every technical explanation must always be maximally simple | Low | Needed in one episode; the user rejected extending brevity to all communication |
| A tool error reveals a user expectation | None | This was a category error in the earlier analysis |

The most reliable universal rules concern control, work phases, scope of
permission, evidence, and communication. Aesthetic and methodological preferences
should be treated as strong defaults while still being tested against the current
task's context.

## Final Model

The user expects the agent to behave like a strong technical partner:

- understand before guessing;
- present a choice where a real choice exists;
- act independently after a decision;
- do not interfere with the user's personal working environment;
- do not expand the user's intent without permission;
- prove the final result;
- communicate directly and with task-appropriate depth;
- treat corrections as updates to the collaboration contract, not as local wording
  edits.

The universal `AGENTS.md` must protect this model and be suitable for copying into
any project as the only file of its kind. The agent must discover technical details
inside the current project rather than turning the universal contract into a
reference guide to past work or expecting a second project-specific `AGENTS.md`.

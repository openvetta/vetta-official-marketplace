---
name: rea-investigation
description: Run a reverse-engineering investigation with REA and keep every finding on the Vetta case board. Use when the user wants to understand how an application, binary, website, package or protocol works — not when they just want their own code explained.
---

# Evidence-led reverse engineering with REA

REA inspects targets locally and is not a source of belief: a claim is only worth
what its evidence supports. This workflow keeps that distinction visible from the
first question to the exported report.

## 0. Resume before you start

Call `case_status`. If a case is open for this workspace, continue it — do not
open a second one for the same target. If the case already holds evidence, read
it before running any probe again: the same tool call with the same arguments
mostly reproduces what is already recorded.

## 1. Fix the target and the question

You need three things before probing:

- **the target** — a path on disk, or a URL;
- **the behaviour** — one concrete question ("what happens when I click Export"),
  not a whole product ("figure out this app");
- **the output** — an explanation, a spec, or a working implementation.

Call `case_open` with `target` and `goal` once you have them. If the user has not
said which behaviour matters, ask — but offer two or three settled examples
instead of an open "what do you want to know?". One question per message.

Do not start probing a target the user has not named.

## 2. Respect the route and its prerequisites

`case_open` returns the route, the engines it needs and which of them are
missing. Report a missing engine as a fact and move on:

- never pretend an engine is present, and never invent tool output;
- if the missing engine blocks the question, say what it blocks and what the
  user has to install — do not silently switch to a route that cannot answer;
- routes that read bytes (JavaScript, .NET metadata, artifact headers) need no
  engine, so they are almost always the cheapest way to start.

If the inferred route contradicts what the target turns out to be, reopen the
case with the corrected route rather than mixing evidence from two routes.

## 3. Probe with the narrowest tool that answers the question

One question per probe, smallest scope first:

| Target | Start with | Then |
| --- | --- | --- |
| Desktop app / Electron | locate the bundle, read `package.json` and `app.asar` | map main-process IPC handlers, follow the renderer call into the handler |
| JavaScript bundle | inventory modules and entry points | read the module that owns the feature, resolve source maps |
| Website | drive the page, capture the requests the feature makes | read the bundle that issues them |
| Native binary | open in the configured engine, find the function | follow callers, cross-references, strings |
| .NET assembly | metadata and type/method inventory | read the IL, declared native dependencies |
| Android package | manifest and dex inventory | read the method body behind the activity or service |
| Asset / archive / model | headers and inventory | identify the entries the feature depends on |

Stop probing when the question is answered. A long evidence list is not a better
answer.

## 4. Record what each probe proved

After a batch of REA tool calls, call `case_record` for the conclusions that
matter. Use the grades strictly:

- **confirmed** — a tool returned it, or it is directly observable (a string, a
  header field, a symbol, a captured request). Cite file:line, symbol or offset.
- **inferred** — you concluded it from confirmed evidence. Say what it rests on.
- **unknown** — the gap that still blocks the answer. Record it as an open
  question with `unknown`, and close it with `resolves` once evidence settles it.

Never mark an inference as confirmed because it "must be" true. Never leave a
conclusion only in the chat when it belongs to the case.

## 5. Report with the chain, not just the conclusion

When the user asks for the answer:

- explain the mechanism in plain language, smallest useful diagram of steps;
- give the chain from user action to final effect, each step with its location;
- separate **confirmed** from **inferred** explicitly;
- state what is still unknown and what the next probe would be.

The case board exports the same content as `report.md` with an evidence appendix.
Point the user at it instead of re-pasting payloads.

## 6. Specs and implementations

When the user wants their own version, write behaviour, inputs, outputs, edge
cases and the evidence each statement rests on. Then implement it in their
project — their code, their conventions. Do not copy decompiled source verbatim
into a deliverable; describe behaviour and write fresh code.

## Boundaries

- A path handed to you may be a container, disk image, installer or bundle: `.dmg`,
  `.pkg`, `.msi`, `.crx`, `.xpi`, `.app`. If it has to be mounted or unpacked
  before it can be read, say what is needed and how to do it, and only do it with
  the user's go-ahead. Never describe contents you have not actually read.
- An extension can be ambiguous: `.app` is a macOS bundle and a HarmonyOS package,
  `.bin` is as often firmware as a native binary, `.bundle` is usually a macOS
  bundle but sometimes a Unity AssetBundle. Let the bytes decide the route, and
  correct a wrong guess out loud instead of building on it.
- Static observation first. Runtime instrumentation, attaching to a running
  process, or driving an authenticated site needs the user's explicit go-ahead.
  process, or driving an authenticated site needs the user's explicit go-ahead.
- Only inspect targets the user owns or is authorised to analyse. Say so if that
  is unclear.
- Keep secrets, tokens and cookies out of the case, the report and the chat.
- If a tool fails, record the failure as unknown and report it — a refused probe
  is information, not something to hide.

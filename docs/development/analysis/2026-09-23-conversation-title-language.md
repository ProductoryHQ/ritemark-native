# Conversation titles in the wrong language (2026-09-23)

## Report

While testing Sprint 122 in a dev build (Claude Code, Sonnet 5, clean Ritemark
profile), an entirely English first prompt produced the auto-title
**"Carrier ontvoering en piloten"** — Dutch, and nonsense ("ontvoering" means
abduction). Seen once.

## What goes to the model

`ConversationTitleGenerator` opens a fresh one-shot session on the chat's runtime
and sends:

- as the system append: `TITLE_SYSTEM_PROMPT`, which said *"Return only one short
  title in the user's language."*, after Ritemark's lifecycle rules, on top of the
  Claude Code preset system prompt;
- as the turn: the same instruction, then `USER MESSAGE:` (the prompt as the person
  typed it, up to 4 000 characters), `FIRST RESPONSE:` (the first reply) and
  `TITLE:`.

No language hint is passed: not the Transcribe/insights language, not the editor's
dictation language (the "ET" control in that window), nothing. The session is
created without `settingSources`, so it gets the default `['user', 'project',
'local']`: the person's own Claude settings, **skills**, agents and `CLAUDE.md`
are loaded into it. On the machine where this was seen, several user-level skills
are described in Estonian (`eesti-keeletoimetus`, `pakkumise-tegija`,
`koosoleku-memo-tegija`, `andmepuhastus-audit`, `productory-docx`). No language
setting exists in `~/.claude/settings.json` or `~/.claude.json`, and
`~/.claude/CLAUDE.md` does not mention a language.

## Reproduction

**In the running dev app**, six new conversations with the exact reported prompt:

| Trial | Title |
|---|---|
| 1 | Instructions for links list |
| 2 | **Bulletpunktide loend ekspordi linkidega** |
| 3 | Bulleted list of project links |
| 4 | **Ritemarki lingiloendi vastus** |
| 5 | **Ritemarki teemade lingid** |
| 6 | Carrier API links contacts brief |

3 of 6 in Estonian. The Dutch title itself did not recur; the failure — a title
not in the prompt's language — did.

**Controlled, outside the app.** A script calls the Claude Agent SDK (0.3.270)
the way the title session does — `claude_code` preset with Ritemark's lifecycle
append and the title prompt, the same turn text, no tools allowed,
`claude-sonnet-5`, the same working folder — and varies one thing at a time:

| Variant | Setting sources | Instruction | Prompt | Non-English titles |
|---|---|---|---|---|
| A (as shipped) | user, project, local | "in the user's language" | English | **4 / 8** (all Estonian) |
| B | project, local | "in the user's language" | English | 0 / 8 |
| C (the fix) | user, project, local | "in the same language as the USER MESSAGE below — not the language of any other context" | English | 0 / 16 |
| D (the fix) | user, project, local | as C | Estonian | 8 / 8 Estonian — correct |

## Cause

The wrong language needs both factors: the person's user-level Claude context in
the session **and** an instruction that asks for "the user's language", which the
model can answer from that context instead of from the prompt. Removing either one
removes the failure (B, C). Which user-level item carries the Estonian signal was
not bisected further; the Estonian skill descriptions are the likely carrier.

## Fix

`TITLE_SYSTEM_PROMPT` now ties the language to the USER MESSAGE and rules out every
other source (variant C). It is the narrowest change that removes the failure
without touching what the session loads: dropping the `user` setting source would
also work (B) but would change a session that may depend on the person's settings
(for example a custom API endpoint), and Jarmo has kept `user` settings in Claude
sessions on purpose. D shows the fix does not force English: an Estonian prompt
still gets an Estonian title.

`ConversationTitleGenerator.test.ts` pins the wording (it fails with the old
sentence). The model's behaviour itself is evidenced here, not in the unit test.

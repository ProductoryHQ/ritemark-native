---
name: release-notes
description: Write Ritemark's release notes (docs/releases/vX.Y.Z/release-notes.md) in plain words that say what people can now do, and check everything copied from them — the GitHub release body, the in-app update notification, the blog post, social posts and the Store's What's new. Use whenever release notes are written, revised or reviewed, when a sprint adds a line to them, and before any public "what's new" text goes to Jarmo.
metadata:
  version: 1.0.0
---

# Release notes: say what people can now do

## Why this skill exists

The release notes are where every public text about a release starts. The GitHub release body is the notes. The in-app update notification shows them. The blog post, the social posts and the Store's What's new are copied from them. A line written in our own words in the notes travels everywhere.

2.1 showed it (28 October 2026). The notes opened with "Ritemark 2.1 makes what your AI writes ready to send" and spoke of "typeset equations" and "3 in 100 of the team's own documents came back unchanged". The launch post copied them, and Jarmo said: "ma ei saa midagi tekstist aru". The blog's headline said the same slogan over a picture of formulas, and he said: "jeesus - kui keeruline on öelda - nüüd saad teksti lisada ka valemeid". The plain sentence was there all along.

## The one rule

**Every line answers "what can I do now?", in the words a person would use with a colleague.**

How it works, what changed in the code and how we measured it stay out. If the reader needs a detail to use the feature, it goes in the second sentence, after the value.

## The headline

- **One sentence: the simplest true thing a person can now do.** "Now you can add formulas to your text." It is not a slogan ("What your AI writes is ready to send"), not a theme, and not three facts in one line.
- **If no single thing leads, say so plainly.** "Ritemark 2.1 adds formulas and fixes how files are saved." Never invent a theme to cover a set of changes.
- **The headline and the first picture show the same thing.**

## Each item

- **A bold lead of 8 words or fewer:** what you can do, or what is different for you. "**Add formulas to your text.**" not "**Equations.**"
- **Then one or two sentences:** when you'd notice it, and its limit if it has one.
- **Sentences of 20 words or fewer, one idea each** (STE100): active voice, present tense, "you". "Ritemark asks you which version to keep", not "A conflict prompt is shown."
- **Everyday words.** Don't write: typeset, render, round-trip, byte, front matter, schema, runtime, provider, token, payload, parity, fidelity, artifact, webview, extension, patch, sync (unless it is the button's name). Write what the person sees: "looks right", "stays as you wrote it", "opens", "asks".
- **A screen label only for a control the reader must press,** in bold, exactly as on screen: **Send feedback**, **Download Installer**.
- **A number only if the reader can picture it in their own work.** "Up to 20 pages" yes; "89 in 100 of our documents" no. Internal measures belong in the sprint's QA evidence.
- **Keep the qualifier the facts need:** "almost always", "usually", "on the Mac", "in Word and PDF, not Google Docs". Plain words stretch easily, and a stretched claim is a false one.
- **No internal names:** sprint numbers, R- and S-ids, issue and PR numbers, patch numbers, code names, people's roles in the team.

## The shape

```markdown
# Ritemark X.Y.Z

<The headline sentence.>

<Two or three sentences: what is in this release, for whom.>

## <What you can do, in the user's words>     (what most people notice first)
- **<Bold lead.>** <One or two sentences.>

## Smaller changes
- **<Bold lead.>** <One sentence.>

## Fixes
- **<What works now.>** <What used to go wrong, in the user's terms.>

## Updating from X.Y
<How the update arrives on the Mac and on Windows (download or Store), and what happens to files, chats and settings.>

## Known issues
- **<What happens.>** <When, and what to do about it.>
```

The first two lines must make sense alone, because the in-app update notification and the social posts show only the start.

## The checks, in this order

Do every check before anyone else reads the notes: Jarmo, the Experience lead, the Social or Traffic manager.

1. **Headline:** is it the simplest true thing a person can now do? Read it aloud. Does the first picture show it?
2. **Stranger:** someone who has never opened Ritemark reads each bold lead. Can they say what they can now do? If a lead needs our vocabulary, rewrite it.
3. **Mechanism hunt:** search the text for the words above, every screen label and every number. For each one ask: does the reader need it, and can they picture it?
4. **Truth:** check each claim against the shipped build on every platform it names: Mac and Windows, a download and a Store install. Check the open bugs and the Known issues. For example, 2.1's #588 means "your words are never lost" would be false. A claim that is true only usually says "usually".
5. **Estonian:** for the Estonian versions of the blog or the Store copy, apply the `eesti-keeletoimetus` skill after these checks.

## Texts copied from the notes

- **GitHub release body:** the notes themselves (the `release` skill, Step 8.2).
- **In-app update notification:** the notes' text, through the update feed (`--notes-file`). The start must stand alone.
- **Blog, social posts, Store What's new:** take the headline and the bold leads as they are, or shorter. Never put mechanism back in. A social post carries three items at most.
- **A team that gets the notes as a source** (Social manager, Traffic manager) gets this skill's rule with them: the notes are the fact source, and their wording passes the checks above.

## Before and after, from 2.1

| What we wrote | What a person can read |
| --- | --- |
| Ritemark 2.1 makes what your AI writes ready to send. | Now you can add formulas to your text. |
| Formulas from ChatGPT and Claude show as typeset equations. | Formulas from ChatGPT and Claude now look right, in your document and in the PDF or Word file you send. |
| Saving changes only what you changed. Over the team's own documents, 3 in 100 came back unchanged after one save in 2.0. In 2.1, 89 in 100 do. | Change one word and save, and almost always only that word changes in your file. |
| When the AI changes a document while you're editing it, Ritemark asks once, with **Review changes**. | If the AI edits a document while you are typing in it, Ritemark usually asks you what to keep. |
| Send feedback, in the status bar and in Help, reaches the people who make Ritemark. | Something not working? Tell us with **Send feedback**, at the bottom of the window. |

## Related

- `.claude/skills/ritemark-design/references/release-assets.md`: the format of the release graphics and the changelog. For wording, this skill wins.
- The `product-marketer` agent writes the notes and the copies; it follows this skill.
- In `ritemark-web`, `.claude/skills/ritemark-video-ad/references/plainspoken.md` is the same voice for films and ads ("Say the value, not the mechanism").

# Ritemark 1.13.0 Release Notes

<!-- TBD: release date -->

Ritemark 1.13.0 is a small release. It brings Claude Sonnet 5.5, newer versions of the three AI agents built into Ritemark, and fixes for things you may have run into in everyday use of 1.12.0.

## Sonnet 5.5 and newer agents

- **Sonnet 5.5 in the Claude model menu.** Anthropic's newest Sonnet is now the recommended model for Claude Code conversations. Sonnet 5 is still in the menu as the previous Sonnet.
- **Newer GPT models in Codex.** Ritemark's built-in Codex can now run GPT-6.1 Sol, GPT-6 Sol and GPT-6 Luna. They appear in the Codex model menu once Codex has listed them for your account. New Codex conversations still start on GPT-5.6 Sol.
- **Updated built-in agents.** Ritemark now ships Claude Code 2.1.289, Codex 0.160.0 and OpenCode 1.18.34.

## Fixes

- **Send uses the Claude model you picked.** After switching from Claude to Codex and then to another Claude model, the model button showed the old Claude model and Send used it. Both now follow your pick.
- **The message box fits a narrow AI side bar.** Below the default width, AI information and attach move into a **…** menu so Send stays in view; at the narrowest widths the controls take a second row.
- **A new Codex conversation no longer fails on its first prompt.** Ritemark read its list of Codex models from a file that every Codex app on your computer shares. When another Codex app, such as the Codex desktop app, had written that list for a different Codex version, Ritemark could pick a model its own Codex can't run, and the first prompt failed. Ritemark now ignores a list written by another Codex version, and a new Codex conversation starts on Ritemark's default Codex model, GPT-5.6 Sol.
- **Word count, Contents and comment markers follow every change.** When an agent edited your document, or the file changed on disk, they kept showing the old text until you typed. They now update straight away.
- **The word count counts every word.** It dropped one word for each paragraph, heading or list item.
- **The word count belongs to the tab you are in.** With several documents open, the status bar now shows the count for the active tab, and hides it when that tab is not a Markdown document.
- **Conversation titles are readable.** In the **Conversations** list, titles were cut after about ten characters at the default side bar width. A title now uses the whole row and wraps to two lines, and the buttons that appear on hover sit on the line below, so they never cover it.
- **Message box menus are fully visible.** At the default side bar width, the permission mode and model menus opened partly under the strip of conversation buttons, and the `/` and `@` pop-ups were cut off. They now fit beside the strip.
- **Word tables have space inside their cells.** In a Word document whose tables have no table style, text sat right against the cell borders. The preview now leaves the same space as Word, including in headers, footers and notes.

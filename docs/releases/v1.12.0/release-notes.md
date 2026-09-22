# Ritemark 1.12.0 Release Notes

> Draft. Each v1.12.0 sprint adds its section here; the release manager edits the whole file before publishing.

## Publish to Google Docs

Sprint 119 lets you hand a document to people who live in Google Docs without giving up Markdown.

Connect a Google account once, in the new **Google Docs** card in Settings. Then choose **Export → Create Google Doc**, and the document appears in your Google Drive as a real Google Doc. Headings, lists, tables, links, code, quotes, images and diagrams all come through. Ritemark remembers which Doc belongs to which file. After you edit, **Export → Sync Google Doc** updates that same Doc: same link, same sharing, no copies piling up in Drive.

Sync is deliberately one-way. Your markdown file is the original, and nothing is read back from Google Docs. Because Sync replaces the Doc's text, Ritemark asks before the first overwrite. It warns you again whenever someone has edited the Doc in Google Docs since your last Sync, with **Open Google Doc** so you can look first. When nothing has changed, it says so and writes nothing.

**Templates.** Pick any Google Doc as a template, and new Docs start as a copy of it, with your fonts, colours, header and footer. Sync replaces only the text, so the template's look stays.

**Narrow access.** Ritemark asks Google for one permission, which covers only the Docs it creates and the template you pick. It can't see or change anything else in your Drive. Sign-in tokens are stored encrypted on your computer. Everything travels directly between your computer and Google, and Ritemark's analytics record nothing about publishing. Disconnect revokes the access; it never deletes a Google Doc.

**When a Doc can't be synced,** Ritemark says why and offers the way out. A Doc in the Drive trash can be restored or unlinked. A document published from another Google account asks you to reconnect that account instead of writing to the wrong one. A missing or unsupported image is named rather than silently dropped.

Two things Google's API can't do: a ticked checkbox arrives unticked, and bullets nested under a numbered item show as a., b. [How publishing works](../../user/features/google-docs.md)

## Ritemark's own privacy policy and terms

Ritemark now has its own privacy policy and terms of use on ritemark.app, in English and Estonian. Productory Services OÜ remains the provider. The links in the app (analytics consent and AI information) point there now. The privacy policy has a section on exactly what Google Docs publishing does with your Google data. The old productory.ai addresses still work for earlier versions.

## Fixes

- **Images with a plain relative path now show in the editor.** An image written as `![diagram](img/diagram.png)`, the form most Markdown tools produce, appeared as a broken image. Only `./` and `../` paths were displayed.
- **Images from a parent folder no longer break on save.** Editing and saving a document with a `../images/…` image wrote an internal `vscode-resource` address into the file in place of the path, breaking the image in every other app. The original path is now kept.
- **The Export menu works from the keyboard.** Opening it with Enter now moves focus into the menu. The arrow keys move between entries, and Escape or Tab closes the menu and returns focus to the Export button. Previously no entry could be reached without a mouse.

# Publish to Google Docs

> Turn a markdown document into a Google Doc, and update that same Doc whenever you change the file.

Ritemark can publish a markdown document as a Google Doc in your own Google Drive. After that, **Sync** replaces the Doc's text with your current version, so colleagues who work in Google Docs always read the latest copy. Your markdown file stays the original: nothing from the Google Doc is ever read back into it.

*Available from Ritemark 1.12.*

---

## Connect your Google account

1. Open **Ritemark Settings** and find the **Google Docs** card. Or choose **Export → Connect Google Docs…** in any markdown document, which opens Settings at that card.
2. Click **Connect Google account**. Google's sign-in page opens in your browser.
3. Choose your account and allow access. The browser shows "Ritemark is connected", and the card shows your email address.

Ritemark asks Google for one narrow permission. It can open only the Google Docs it creates and a template you pick yourself. It cannot see or change anything else in your Google Drive.

To stop, click **Disconnect** on the same card. Ritemark asks Google to revoke its access and deletes the sign-in from your computer. Your Google Docs are never deleted. You can also remove Ritemark's access in your Google Account under third-party connections.

---

## Create a Google Doc

1. Save the markdown file. An unsaved new document can't be published.
2. Click **Export** in the document header, then **Create Google Doc**.
3. A notification shows the progress, then **Google Doc created**, with a button to open it.

The Doc's title comes from the document's `title` property when it has one, and otherwise from the file name. Ritemark remembers which Google Doc belongs to which file, so the Export menu now offers **Sync Google Doc** and **Open Google Doc** for this file.

---

## Sync changes

Edit your markdown as usual, then choose **Export → Sync Google Doc**. The same Google Doc is updated; no copy is made.

- **The first Sync asks for confirmation.** Sync replaces the whole text of the Google Doc, so any edits made directly in Google Docs are overwritten. Ritemark asks once per document.
- **If someone edited the Doc in Google Docs** since your last Sync, Ritemark warns you and offers **Overwrite with Ritemark** or **Open Google Doc**, so you can check the changes first. Ritemark can't merge them.
- **If nothing changed**, Ritemark says the Doc is already up to date and writes nothing.

Sync replaces only the text. The Doc's header, footer, named styles, sharing settings, and any tabs you add later in Google Docs stay as they are.

---

## Use a template

A template gives new Google Docs your own look: fonts, colours, header and footer.

1. Make or pick a Google Doc with the styles you want.
2. In the Google Docs card in Settings, click **Choose template**. Google's file picker opens in your browser. Choose the Doc.
3. From now on, **Create Google Doc** makes a copy of the template and writes your text into it.

The template applies only when a Doc is created. If the template has several document tabs, the new Doc keeps only the first one. Use **Change template** or **Remove template** on the same card.

---

## What carries over

| In Ritemark | In Google Docs |
|---|---|
| Headings, bold, italic, strikethrough, inline code, links | Kept |
| Bullet and numbered lists, nested lists | Kept; a list uses one bullet style, so bullets nested under a numbered item show as a., b. |
| Task lists | Checkboxes, always unticked: Google's API cannot tick a checkbox |
| Tables | Kept, first row bold |
| Quotes, code blocks | Italic quote with a side bar; monospace block on a grey background |
| Images in your document | Uploaded and embedded (PNG, JPEG, GIF; SVG is converted to PNG first) |
| Images on the web | Embedded; Google fetches them from their address (PNG, JPEG, GIF) |
| Diagrams (Mermaid, draw.io) | Converted to PNG and embedded |
| Margin comments | Not published: comments stay in Ritemark |

To get local images into the Doc, Ritemark uploads each one to your Google Drive and shares it by link for a few seconds while Google Docs copies it. Then Ritemark removes the sharing and deletes the uploaded copy. An image Ritemark can't publish, such as a WebP or ICO file or a missing file, is named in the result notification instead of being silently dropped.

---

## When something goes wrong

| You see | What to do |
|---|---|
| **Reconnect Google account…** in the Export menu | This file was published with a different Google account. Connect that account in Settings to sync it. |
| "The linked Google Doc is in your Google Drive trash" | Restore it in Google Drive, or choose **Remove publishing link** to create a new Doc. |
| "The linked Google Doc is unavailable" | It was deleted or you lost access. Choose **Remove publishing link**, then **Create Google Doc**. |
| "Google no longer accepts this connection" | You revoked access or the sign-in expired. Click **Reconnect** in Settings. |
| "Google is temporarily limiting requests" / "temporarily unavailable" | Wait a moment and try again. Your markdown file is never affected. |
| "Google Docs publishing isn't available in this version of Ritemark" | This build has no Google client configured. Use an official Ritemark release. |

**Remove Google Docs link…** in the Export menu makes Ritemark forget which Doc a file is published to. The Google Doc itself is not deleted. Afterwards **Create Google Doc** makes a new one.

---

## Privacy

Everything travels directly between your computer and Google; nothing passes through Ritemark's or Productory's servers. Sign-in tokens are stored encrypted on your computer. Ritemark's usage analytics record nothing about Google Docs publishing. The details are in the [privacy policy](https://ritemark.app/en/privacy/#google-docs).

---

## Related

- [Export](export.md): PDF and Word files
- [Document Properties](document-properties.md): the `title` that names your Google Doc

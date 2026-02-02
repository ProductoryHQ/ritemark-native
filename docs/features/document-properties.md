# Document Properties

> Add metadata to your documents - titles, dates, tags, and custom fields.

Document properties are stored in YAML front-matter at the top of your markdown files. Ritemark gives you a visual editor so you never have to write YAML manually.

---

## What You Can Do

- **Add titles and authors** - Standard document metadata
- **Set dates** - Creation or due dates with a date picker
- **Add tags** - Categorize documents with multiple tags
- **Track status** - Draft, review, published, etc.
- **Create custom fields** - Any metadata you need

---

## How It Works

### Opening Properties

Click the **Properties** button in the document header (top-left of editor).

A panel opens showing all properties for the current document.

### What Gets Stored

Properties are saved as YAML front-matter:

```yaml
---
title: My Document
author: Jane Smith
date: 2026-01-14
tags: [project, draft]
status: draft
---
```

This stays at the top of your markdown file but doesn't appear in the editor view.

---

## Built-in Properties

| Property | Type | Description |
|----------|------|-------------|
| Title | Text | Document title (used in PDF export) |
| Author | Text | Author name (used in PDF export) |
| Date | Date | Any relevant date |
| Tags | Multi-value | List of tags |
| Status | Select | Document status |
| Description | Text | Longer description |

### Title

Single-line text for the document title.
- Shows in PDF export as the document title
- Different from the first heading in your content

### Author

Single-line text for the author name.
- Shows in PDF export metadata
- Good for tracking who wrote what

### Date

Date picker with calendar.
- Format: YYYY-MM-DD
- Click to open calendar picker
- Use for creation date, due date, or any date you need

### Tags

Multiple values in a list.
- Add tags separated by commas
- Useful for categorization and search
- Stored as YAML array: `tags: [tag1, tag2, tag3]`

### Status

Dropdown with preset options:
- Draft
- In Review
- Published
- (Custom options can be added)

### Description

Longer text field.
- Use for summaries or notes
- Doesn't appear in document content

---

## Custom Properties

Add any property you need:

1. Click **Add Property** in the properties panel
2. Enter a property name
3. Enter a value
4. Property is saved to front-matter

**Examples:**
- `client: Acme Corp`
- `project: Q1 Planning`
- `version: 1.2`
- `reviewed_by: John`

---

## Editing Properties

### Edit a Value

1. Open Properties panel
2. Click on any value
3. Type new value
4. Click outside or press Enter to save

### Delete a Property

1. Open Properties panel
2. Hover over the property
3. Click the delete icon
4. Property is removed

### Change Property Type

Properties remember their type:
- Text stays text
- Dates stay dates
- Tags stay as arrays

To change type, delete and re-add the property.

---

## How Properties Are Used

### In PDF Export

| Property | PDF Usage |
|----------|-----------|
| Title | Document title metadata |
| Author | Author metadata |
| Date | Not shown (metadata only) |

### In Your Workflow

Properties help you:
- Track document status
- Categorize with tags
- Store project information
- Keep author attribution

---

## Tips

- **Title vs. Heading** - The title property is metadata; your first heading is content. They can be different.
- **Consistent tags** - Use the same tag names across documents for easier organization
- **Required fields** - Ritemark doesn't enforce any fields. Add what you need.
- **Editing raw YAML** - You can edit the front-matter directly in a text editor if you prefer

---

## Compatibility

Ritemark uses standard YAML front-matter that works with:
- Static site generators (Jekyll, Hugo, Astro)
- Note-taking apps (Obsidian)
- Any tool that reads markdown front-matter

---

## Related

- [Export](export.md) - How properties appear in exports
- [Core Editor](editor.md) - Basic editing

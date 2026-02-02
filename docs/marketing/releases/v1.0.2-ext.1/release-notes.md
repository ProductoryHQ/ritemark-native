# Ritemark v1.0.2-ext.1

**Released:** 2026-01-17
**Type:** Extension-only
**Download:** [GitHub Release](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark.dmg)

## Highlights

This release improves the spreadsheet workflow for users who work with CSV and Excel files alongside other applications. You can now refresh files when they change externally, with smart conflict detection to prevent data loss.

## What's New

### Refresh Button

A new refresh button appears in the spreadsheet toolbar when viewing Excel or CSV files. Click the circular arrow icon to reload the file from disk.

This is especially useful when:
- Editing the same file in Excel or Numbers
- Another application updates the data
- You want to discard local changes and reload

### File Watching

Ritemark now watches open spreadsheet files for external changes. When the file is modified by another application:
- A blue badge appears on the refresh button
- You can see at a glance that the file has been updated
- No need to constantly check or manually track changes

### Conflict Detection

When you click refresh on a file that has external changes, Ritemark shows a confirmation dialog. This prevents accidentally overwriting your view if you weren't expecting changes.

## Bug Fixes

- **CSV Save Fix:** Resolved an issue where CSV file saves could fail silently. Save operations are now more reliable.

## Technical Notes

This is an extension-only release. The extension version is 1.0.2-ext.1 while the base app remains at v1.0.2.

## Upgrade Notes

Standard upgrade process - download the latest DMG and replace the existing application.

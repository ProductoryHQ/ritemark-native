# Welcome Screen Content Spec

## Purpose

| Field | Value |
| --- | --- |
| Goal | Define exactly what the user sees on the Welcome screen |
| Scope | Visible sections, labels, hierarchy, actions, and empty states |
| Excludes | Internal code structure, patch workflow, command plumbing, and release validation |

## Screen Structure

| Order | Area | What the user sees |
| --- | --- | --- |
| 1 | Hero | Branded Ritemark card with logo, product line, and primary actions |
| 2 | Recent files and folders | Return-to-work area on the left |
| 3 | Launch check | Setup and authentication status on the right |

## Hero

| Element | Visible content | Notes |
| --- | --- | --- |
| Brand | RITEMARK / BY PRODUCTORY logo lockup | Rendered as a single logo asset |
| Product line | Write Smarter. Think Faster. | `Think Faster.` is the accent phrase |
| Primary action | New document | Default action of the split button |
| Split menu item | New document | Creates a blank markdown document |
| Split menu item | New table | Creates a CSV table with 10 columns and 20 empty rows |
| Split menu item | New flow | Creates a starter flow in a project folder |
| Secondary action | Open folder | Opens the folder picker |

## Learn Links

| Link label | Destination |
| --- | --- |
| Getting started | Ritemark support getting started page |
| Support articles | Ritemark support hub |
| Blog | Ritemark blog |

## Recent Files And Folders

| Element | Visible content | Notes |
| --- | --- | --- |
| Section title | Recent files and folders | Left column heading |
| Empty state | You have no recent folders, open a folder to start. | `open a folder` is the interactive link |
| Populated state | Standard recent folders/workspaces list | Keep compact and scan-friendly |

## Launch Check

| Element | Visible content | Notes |
| --- | --- | --- |
| Section title | Launch check | Right column heading |
| Ready state example | ChatGPT authenticated. | Green check row |
| Ready state example | Claude.ai authenticated. | Green check row |
| Ready state example | Ritemark found Git. | Green check row |
| Ready state example | Ritemark found Node. | Green check row |
| Missing state example | ChatGPT not authenticated. Click here to log in | Warning row with fix action |
| Missing state example | Claude.ai not authenticated. Click here to log in | Warning row with fix action |
| Missing state example | Ritemark needs Git. Click here to install | Warning row with fix action |
| Missing state example | Ritemark needs Node. Click here to install | Warning row with fix action |

## Empty Window Priority

| Priority | What should be visible without confusion |
| --- | --- |
| 1 | Entire hero with logo, tagline, and both primary actions |
| 2 | Split-button menu affordance as part of `New document` |
| 3 | Recent files and folders title plus empty state or first rows |
| 4 | Launch check title plus key status rows |

## Tone

| Aspect | Requirement |
| --- | --- |
| Overall feel | Premium, welcoming, desktop-native |
| Copy style | Short, clear, non-technical |
| Product framing | Ritemark-first, not VS Code-first |
| Avoid | IDE onboarding language, walkthrough framing, setup-wizard copy |

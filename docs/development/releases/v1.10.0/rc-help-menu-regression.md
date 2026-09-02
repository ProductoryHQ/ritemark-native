# v1.10.0 RC Help-menu regression

**Status:** implementation and automated gates complete; native-menu screenshot gate pending (not a separate sprint)

**Reported:** 2026-09-02

**Scope:** desktop menubar only; commands remain available through the Command Menu

## Finding

Ritemark v1.5.1 intentionally reduced Help to **Support**, **View License**, and
**Advanced**. The VS Code 1.117 patch rebase retained the generic menu-cleanup
patch but dropped its Help-specific hunks. That allowed every upstream
`MenuId.MenubarHelpMenu` contribution to render again, including Welcome,
Show All Commands, Editor Playground, Open Walkthrough, Ask @vscode, developer
tools, and Process Explorer.

The old implementation was also structurally fragile: it removed menu
registrations in several unrelated modules. A new upstream contribution or a
missed rebase hunk could silently repopulate the product menu.

The Search field at the top of the macOS Help menu is a native macOS affordance,
not a VS Code command. It remains.

## Product policy

| Surface | Stable Ritemark contents |
| --- | --- |
| macOS Help | Support; View License; Advanced > Toggle Developer Tools |
| Windows/Linux Help | Support; View License; Advanced > Toggle Developer Tools; About Ritemark |
| Command Menu | Upstream commands remain callable for support and power-user workflows |

Support uses `branding/product.json#documentationUrl`; no Ritemark URL is
hardcoded in the workbench. Process Explorer remains a Command Menu command but
is not a user-facing Help item.

## Architecture decision

Apply one Ritemark-only allowlist at the menubar rendering boundary shared by
native and custom menubars. The policy is fail-closed: an unknown future Help
contribution is hidden until it is explicitly reviewed. Separators are
normalized after filtering so the menu cannot start/end with or contain
duplicate dividers.

The allowlist is applied only when `product.applicationName === "ritemark"` and
only to the Help top-level menu, leaving upstream behavior and every other menu
unchanged.

## Deterministic gates

1. Unit tests cover Ritemark vs non-Ritemark behavior, the exact command
   allowlist, the Advanced submenu, About, unknown-command rejection, and
   separator normalization.
2. Both native and custom menubar builders must call the same filter.
3. The canonical patch stack must apply to a clean pinned VS Code submodule.
4. RunDev must show the expected macOS menu in a captured, visually inspected
   screenshot before the fix is called ready.

## Evidence — 2026-09-02

- VS Code `compile-client`: zero errors.
- Native TypeScript validation: pass.
- Focused Electron menu policy suite: 4/4 pass, including non-Ritemark
  preservation and unknown upstream contribution rejection.
- Fresh CI asset-parity simulation: all 15 canonical patches apply and the
  generated assets match.
- Fresh RunDev accessibility tree: exactly **Support**, **View License**, and
  **Advanced → Toggle Developer Tools**.
- Visual gate: still open. Computer Use can expose and inspect the native menu's
  accessibility hierarchy, but this machine's automated `screencapture` path
  omits the accessibility-opened native menu overlay. Screenshots showing only
  the underlying RunDev window are explicitly rejected as evidence.

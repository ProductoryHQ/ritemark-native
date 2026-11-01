# A4: A restored terminal before the welcome on Windows' first start (R10, S45–S47, #501)

**Waiting** for the "Ritemark on Windows" session, 31 October 2026.

The reproduction is Windows-only: a 1.14.0 profile whose AI column had a terminal at quit, updated to the 2.1.0 installer, the times a restored terminal is in front before and after the welcome (S45). The Mac half (a dev instance with a held extension host and a restored terminal, S47) and the reading of VS Code 1.142's rule for an editor opened `inactive` into an empty group (in a copy-on-write, patched `vscode/`) are not done in this pass either; they come with PR 5's tree, before any patch 019 change (decision 3). Nothing here changes a requirement or a tier yet.

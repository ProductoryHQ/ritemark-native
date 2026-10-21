Launch VS Code dev mode for Ritemark Native.

Run `./vscode/scripts/code.sh --shared-data-dir "$HOME/.ritemark-dev-shared"` from the project root to start the development instance. This serves from the `out/` directory.

The `--shared-data-dir` matters from VS Code 1.142: the recent folders live in a shared folder (`~/.ritemark-shared`) that every Ritemark build on the Mac uses, the installed app included. Without the flag, a dev run's folders show in the installed app's Open Recent and projects list (#475).

Remember: CSS and static assets do NOT auto-copy from `src/` to `out/`. After editing CSS files in `src/`, manually copy them to the corresponding `out/` path before reloading.

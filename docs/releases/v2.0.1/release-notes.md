# Ritemark 2.0.1 Release Notes

A fix for the Mac.

## OpenCode works again on the Mac

In Ritemark 2.0.0, every message to OpenCode on a Mac failed straight away, with an error that began `listen EINVAL`. ChatGPT and Claude were not affected.

Before OpenCode starts, Ritemark opens a small channel on your Mac that gives OpenCode Ritemark's own tools, such as the browser. That channel's name had grown one character longer than macOS allows. Ritemark 1.14 got away with it, because its older engine quietly cut the name short. The engine in 2.0 refuses such a name, so OpenCode could not start. The name is now short enough, with room to spare.

Nothing else changes. Windows was not affected, so Windows stays on 2.0.0.

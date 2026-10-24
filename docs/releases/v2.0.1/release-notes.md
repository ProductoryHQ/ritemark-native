# Ritemark 2.0.1 Release Notes

Three fixes. On the Mac and on Windows, Home fits a narrower window, and the ElevenLabs key Test says what's wrong with a key. On the Mac, OpenCode works again.

## OpenCode works again on the Mac

In Ritemark 2.0.0, every message to OpenCode on a Mac failed straight away, with an error that began `listen EINVAL`. ChatGPT and Claude were not affected.

Before OpenCode starts, Ritemark opens a small channel on your Mac that gives OpenCode Ritemark's own tools, such as the browser. That channel's name had grown one character longer than macOS allows. Ritemark 1.14 got away with it, because its older engine quietly cut the name short. The engine in 2.0 refuses such a name, so OpenCode could not start. The name is now short enough, with room to spare.

Windows was not affected, because it opens that channel in another way.

## Home fits a narrower window

In 2.0.0, a project's Home was cut off on the right when it had less room: beside the AI's sheet, in a smaller window, or zoomed in. What moved's **Got it**, the only way to close that card, could be cut off as well.

Home now fits at any width. A long name or path ends in an ellipsis, a row keeps its time, and the **Start something** tiles go from three across to two, then one. **Got it** moves under the title when there is no room beside it. Point at the folder under the project's name to read its whole path.

## The ElevenLabs Test says what's wrong with a key

In Ritemark Settings, **Test** beside the ElevenLabs API key could say "ElevenLabs rejected this key" for a key that works. ElevenLabs keys can be limited to some of its features, and the Test asked for one that Ritemark doesn't use.

The Test now asks ElevenLabs whether the key may transcribe. It sends no audio, so it costs nothing. A key without Speech to Text now gets "This key can't transcribe: turn on Speech to Text for it in ElevenLabs." A transcription with such a key says the same.

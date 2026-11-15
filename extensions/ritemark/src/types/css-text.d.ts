/**
 * Sprint 159: esbuild's text loader (`esbuild.config.mjs`) makes a `.css` import its text. Only
 * `src/decks/page/pageAssets.ts` imports one: the slide's rules, inlined into the published handout page.
 */
declare module '*.css' {
  const text: string;
  export default text;
}

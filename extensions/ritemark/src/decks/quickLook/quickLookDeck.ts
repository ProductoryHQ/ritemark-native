import { agendaOf, blockSlideMarkup } from '../blocks/slideRenderer';
import { frontMatterField, isBlockSlide } from '../deckFormat';
import { isRelativeTarget } from '../deckLibraryFormat';
import { BUILT_IN_THEME, DECK_FONT_LIST, DECK_FONT_SUBSETS, parseTheme, themePathOf, themeWithLogoAddresses } from '../deckTheme';
import { publicDeck } from '../page/publicDeck';
import { fitFlow } from '../../../webview/src/components/decks/blocks/slideFit';
import { slideMarkup } from '../../../webview/src/components/decks/slide/slideMarkup';
import slideCss from '../../../webview/src/components/decks/slide/slide.css';

declare const QUICK_LOOK_FONTS: Record<string, string>;

export function themePath(text: string): string {
  return themePathOf(frontMatterField(text.replace(/^\uFEFF/, ''), 'theme'));
}

export function render(text: string, themeText: string, firstOnly: boolean, assets: Record<string, string> = {}) {
  const paths = new Set<string>();
  const asset = (scope: string, path?: string) => {
    if (!path || !isRelativeTarget(path)) return null;
    const key = scope + path;
    paths.add(key);
    return Object.prototype.hasOwnProperty.call(assets, key) ? assets[key] : null;
  };
  const parsed = themeText ? parseTheme(themeText) : BUILT_IN_THEME;
  const theme = themeWithLogoAddresses(parsed, asset('theme:', parsed.logo?.file), undefined,
    asset('theme:', parsed.logo?.second?.file));
  const deck = publicDeck(text, { folderName: '', theme });
  const agenda = {
    entries: agendaOf(deck.slides.map(({ kind, data }, index) => ({ kind, data, number: index + 1 }))),
    hint: false,
  };
  const slides = (firstOnly ? deck.slides.slice(0, 1) : deck.slides).map(({ kind, data }) => {
    const options = {
      theme, agenda, borderless: deck.look === 'borderless', width: 960, inlineTheme: true,
      pictureUrl: (path: string) => asset('deck:', path),
      missing: (path: string) => isRelativeTarget(path) && !asset('deck:', path),
      openIn: false,
    };
    return isBlockSlide(kind) ? blockSlideMarkup(data, options) : slideMarkup(kind, data, options);
  });
  return { paths: [...paths], slides };
}

export async function show(slides: string[], thumbnail: boolean, assets: Record<string, string>): Promise<string[]> {
  const fonts = DECK_FONT_LIST.flatMap(font => DECK_FONT_SUBSETS.map(({ subset, unicodeRange }) =>
    `@font-face{font-family:'${font.name}';font-weight:100 900;src:url(${QUICK_LOOK_FONTS[`${font.file}-${subset}.woff2`]});unicode-range:${unicodeRange}}`));
  const style = document.createElement('style');
  style.textContent = fonts.join('\n') + slideCss + `
    body{margin:0}
    section{position:relative;overflow:hidden;margin:0 auto}
    section > .deck-slide{transform-origin:top left}
  `;
  document.head.append(style);
  document.body.innerHTML = slides.map(slide => `<section>${slide}</section>`).join('');
  const sections = Array.from(document.body.children);
  function size() {
    const width = thumbnail ? 960 : document.documentElement.clientWidth;
    for (const section of sections) {
      section.setAttribute('style', `width:${width}px;height:${width * 540 / 960}px`);
      (section.firstElementChild as HTMLElement).style.transform = `scale(${width / 960})`;
    }
  }
  size();
  window.addEventListener('resize', size);
  // Side pictures are CSS backgrounds, so wait for those images as well as inline pictures.
  const images = Object.values(assets).map(address => {
    const image = new Image();
    image.src = address;
    return image;
  });
  await Promise.all(images.map(image => image.decode().catch(() => {})));
  await document.fonts.ready;
  document.querySelectorAll<HTMLElement>('.blk-flow').forEach(flow => fitFlow(flow));
  return sections.map(section => (section as HTMLElement).innerText.trim().split('\n')[0]);
}

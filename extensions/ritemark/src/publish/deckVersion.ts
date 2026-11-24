import { parse } from 'node-html-parser';
import { DECK_VERSION_META, DECK_VERSION_PATH } from '../decks/page/pageFollower';
import { PublishError, type UploadFile, type VerifiedUpload } from './host';

const unstamped = `<meta name="${DECK_VERSION_META}" content="0">`;

/** Stamp verified deck HTML and derive the only extra asset from its already-scanned titles. */
export function deckVersionAssets(upload: VerifiedUpload, v: number): readonly UploadFile[] | undefined {
  const page = upload.files.find(file => file.urlPath === upload.pageUrlPath);
  if (!page) return undefined;
  const html = Buffer.from(page.bytes).toString('utf8');
  if (!html.slice(0, 4096).includes(unstamped)) return undefined;
  const document = parse(html);
  if (document.querySelector(`head > meta[name="${DECK_VERSION_META}"]`)?.getAttribute('content') !== '0') return undefined;
  if (upload.files.some(file => file.urlPath === DECK_VERSION_PATH)) {
    throw new PublishError('failed', 'This deck already uses version.json. Rename that file before publishing.');
  }
  const slides = document.querySelectorAll('#frame > .layer[data-slide-title]').map(layer => ({
    key: layer.getAttribute('data-key'),
    title: layer.getAttribute('data-slide-title'),
  }));
  const stamped = html.replace(unstamped, `<meta name="${DECK_VERSION_META}" content="${v}">`);
  return [
    ...upload.files.map(file => file === page ? { ...file, bytes: Buffer.from(stamped) } : file),
    { urlPath: DECK_VERSION_PATH, bytes: Buffer.from(JSON.stringify({ v, slides })) },
  ];
}

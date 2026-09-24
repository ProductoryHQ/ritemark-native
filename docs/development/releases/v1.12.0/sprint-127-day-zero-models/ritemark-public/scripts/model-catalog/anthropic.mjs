// GET /v1/models — the list of models Anthropic currently serves to the
// publisher's own workspace key. Listing models is free.

const API = 'https://api.anthropic.com';
const MAX_PAGES = 20;

export async function listModels({ apiKey, fetchImpl = fetch, baseUrl = API }) {
  if (!apiKey) throw new Error('MODEL_CATALOG_ANTHROPIC_API_KEY is not set');
  const models = [];
  let afterId;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL('/v1/models', baseUrl);
    url.searchParams.set('limit', '1000');
    if (afterId) url.searchParams.set('after_id', afterId);
    const response = await fetchImpl(url, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    });
    if (!response.ok) throw new Error(`GET /v1/models answered HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body?.data)) throw new Error('GET /v1/models returned no data array');
    models.push(...body.data);
    if (!body.has_more || !body.last_id) return models;
    afterId = body.last_id;
  }
  throw new Error(`GET /v1/models did not finish within ${MAX_PAGES} pages`);
}

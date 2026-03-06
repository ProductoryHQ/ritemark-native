# Image Generation APIs - 2026 State of the Art

## Recommended: GPT Image 1.5 (OpenAI)

**Documentation:** https://platform.openai.com/docs/guides/image-generation

**Why it's the default:**
- User already has OpenAI API key configured
- Best text rendering in images (important for blog graphics, social media)
- 20% cheaper than DALL-E 3
- 4x faster generation
- Same API key for both LLM and image generation

**Pricing (January 2026):**
| Size | Quality | Price |
|------|---------|-------|
| 1024×1024 | standard | $0.032/image |
| 1024×1024 | hd | $0.064/image |
| 1792×1024 | standard | $0.048/image |
| 1792×1024 | hd | $0.096/image |

**API Example:**

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.images.generate({
  model: 'gpt-image-1.5',
  prompt: 'A futuristic city skyline at sunset with flying cars',
  n: 1,
  size: '1024x1024',
  quality: 'standard', // or 'hd'
  response_format: 'url', // or 'b64_json'
});

const imageUrl = response.data[0].url;
// or const imageData = response.data[0].b64_json;
```

**Supported sizes:**
- `1024x1024` (square)
- `1792x1024` (landscape)
- `1024x1792` (portrait)

**Important notes:**
- DALL-E 2 and DALL-E 3 are **deprecated** (support ends May 2026)
- Must migrate to GPT Image 1.5 or later
- Images are auto-deleted after 1 hour (must download/save)
- Content policy applies (same as text models)

## Alternative: Nano Banana Pro (Google Gemini)

**Documentation:** https://ai.google.dev/gemini-api/docs/image-generation

**Strengths:**
- **14 reference images** - Use uploaded images as style/subject guides
- **Subject consistency** - Same character/object across multiple generations
- **Gemini integration** - Works with Gemini API (separate from OpenAI)

**Pricing:**
| Model | Versions per prompt | Price |
|-------|---------------------|-------|
| Gemini 3 Pro Image | 4 | $0.039/image |
| Gemini 3 Pro Image+ | 4 | $0.24/image |

**API Example:**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image' });

const result = await model.generateContent({
  prompt: 'A futuristic city skyline at sunset',
  numVersions: 4, // Get 4 variations
  aspectRatio: '1:1', // or '16:9', '9:16'
});

const images = result.response.candidates.map(c => c.imageData);
```

**When to recommend:**
- User needs style consistency (e.g., brand identity)
- User wants to upload reference images
- User prefers Google ecosystem

**Limitation:**
- Requires separate API key (Google AI Studio)
- Not as good at text rendering as GPT Image 1.5

## Alternative: FLUX 1.1 Pro (Black Forest Labs)

**Access:** Via Replicate API
**Documentation:** https://replicate.com/black-forest-labs/flux-1.1-pro

**Strengths:**
- **4.5s generation** - Fastest high-quality generation
- **Photorealistic** - Best for product photography, portraits
- **Open weights** - Can self-host if needed

**Pricing (via Replicate):**
- $0.04/image (1024×1024)
- $0.08/image (1536×1536)

**API Example:**

```typescript
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const output = await replicate.run(
  'black-forest-labs/flux-1.1-pro',
  {
    input: {
      prompt: 'A futuristic city skyline at sunset',
      aspect_ratio: '1:1', // or '16:9', '9:16'
      output_format: 'png',
      safety_tolerance: 2,
    }
  }
);

const imageUrl = output[0];
```

**When to recommend:**
- User needs ultra-fast generation
- User wants photorealistic results
- User prefers open-source models

**Limitation:**
- Requires Replicate account + API key
- Not as good at text rendering

## Comparison Table

| Feature | GPT Image 1.5 | Nano Banana Pro | FLUX 1.1 Pro |
|---------|---------------|-----------------|--------------|
| Provider | OpenAI | Google | Replicate/BFL |
| Text rendering | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Speed | ⭐⭐⭐⭐ (10-15s) | ⭐⭐⭐ (15-20s) | ⭐⭐⭐⭐⭐ (4.5s) |
| Price (1024×1024) | $0.032 | $0.039 | $0.04 |
| Style consistency | ⭐⭐ | ⭐⭐⭐⭐⭐ (14 refs) | ⭐⭐⭐ |
| Photorealism | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| API key reuse | ✅ (same as LLM) | ❌ (separate) | ❌ (separate) |
| Self-hostable | ❌ | ❌ | ✅ (via FLUX weights) |

## Deprecated Options (Do Not Use)

| Model | Status | Reason |
|-------|--------|--------|
| DALL-E 3 | Deprecated May 2026 | Replaced by GPT Image 1.5 |
| DALL-E 2 | Deprecated May 2026 | Outdated quality |
| Stable Diffusion XL | Superseded | FLUX 1.1 is better |
| Midjourney | Not API-accessible | Discord-only workflow |

## Claude Image Generation

**Status:** ❌ Not supported

Claude API (Anthropic) does **not** support image generation. It's text-only output.

**Workaround:** Use MCP (Model Context Protocol) to connect Claude to Hugging Face image models:
- https://huggingface.co/blog/claude-and-mcp

**Not recommended for Ritemark Flows** - Adds complexity for minimal benefit.

## Implementation Recommendations

### Phase 1 (MVP)
**Single provider:** GPT Image 1.5
- Reuse existing OpenAI API key
- Simplest user experience
- Best text rendering (covers most use cases)

```typescript
// extensions/ritemark/src/flows/nodes/ImageNodeExecutor.ts
import OpenAI from 'openai';

export async function executeImageNode(
  prompt: string,
  apiKey: string,
  options: { size?: string; quality?: string }
): Promise<{ url: string; data: string }> {
  const openai = new OpenAI({ apiKey });

  const response = await openai.images.generate({
    model: 'gpt-image-1.5',
    prompt,
    n: 1,
    size: options.size || '1024x1024',
    quality: options.quality || 'standard',
    response_format: 'b64_json', // Get base64 to save locally
  });

  const base64Data = response.data[0].b64_json!;
  const buffer = Buffer.from(base64Data, 'base64');

  // Save to workspace
  const filename = `image-${Date.now()}.png`;
  const imagePath = path.join(workspacePath, '.flows', 'images', filename);
  await fs.writeFile(imagePath, buffer);

  return {
    url: `.flows/images/${filename}`,
    data: base64Data,
  };
}
```

### Phase 2 (Optional Multi-Provider)
**Add provider selection:**
- Default: GPT Image 1.5 (OpenAI key)
- Optional: Nano Banana Pro (Google key)
- Optional: FLUX 1.1 Pro (Replicate key)

**UI:**
```
Image Node Config:
┌─────────────────────────────────┐
│ Prompt: [........................] │
│ Provider: [GPT Image 1.5    ▼] │
│ Size: [1024×1024        ▼] │
│ Quality: [standard        ▼] │
└─────────────────────────────────┘
```

**API Key Management:**
```typescript
// Store in VS Code secrets
await context.secrets.store('ritemark.googleApiKey', apiKey);
await context.secrets.store('ritemark.replicateApiToken', token);
```

## Cost Estimation Feature

Show estimated cost before running flow:

```typescript
function estimateFlowCost(flow: Flow): number {
  let totalCost = 0;

  for (const node of flow.nodes) {
    if (node.type === 'llm-prompt') {
      // Rough estimate: gpt-4o-mini ~$0.0001/1K tokens
      const estimatedTokens = node.data.prompt.length * 1.5;
      totalCost += (estimatedTokens / 1000) * 0.0001;
    }

    if (node.type === 'image-prompt') {
      // GPT Image 1.5 standard 1024×1024
      totalCost += 0.032;
    }
  }

  return totalCost;
}
```

**UI:**
```
Run Flow: Blog Post Generator
Estimated cost: $0.05
[Cancel] [Run Flow]
```

## Error Handling

Common image generation errors:

```typescript
try {
  const response = await openai.images.generate({ ... });
} catch (error) {
  if (error.code === 'content_policy_violation') {
    throw new Error('Prompt violates content policy. Try rephrasing.');
  }
  if (error.code === 'rate_limit_exceeded') {
    throw new Error('Rate limit exceeded. Wait a moment and try again.');
  }
  if (error.code === 'invalid_api_key') {
    throw new Error('Invalid API key. Check your OpenAI settings.');
  }
  throw error;
}
```

## Storage & Cleanup

Images should be saved to workspace:

```
.flows/
├── images/
│   ├── image-1234567890.png
│   ├── image-1234567891.png
│   └── .gitignore  # Add *.png to prevent accidental commits
└── blog-post.flow.json
```

**Cleanup strategy:**
- Keep images referenced in flow outputs
- Delete orphaned images (not in any .md file) after 30 days
- Add "Clean up flow images" command

## Next Steps

1. ✅ Default to GPT Image 1.5
2. Add image generation to OpenAI service (`ai/openaiService.ts`)
3. Create ImageNodeExecutor
4. Implement local image storage (.flows/images/)
5. Add image preview in flow run modal
6. Defer multi-provider support to Phase 2

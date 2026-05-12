---
name: generate-image
description: Generate or edit images using OpenAI gpt-image-2. Use this skill any time the user asks to create, generate, illustrate, design, mock up, or edit an image — from product shots and diagrams to marketing visuals and slide imagery. Works in Claude Code and Claude Cowork.
allowed-tools: mcp__gpt-image-2__generate_image, mcp__gpt-image-2__edit_image, mcp__gpt-image-2__continue_editing, mcp__gpt-image-2__check_image_job, mcp__gpt-image-2__get_configuration_status, mcp__gpt-image-2__get_last_image_info
---

# Image Generation with OpenAI gpt-image-2

Use the `generate_image`, `edit_image`, and `continue_editing` MCP tools from the `gpt-image-2` server (powered by OpenAI's `gpt-image-2` model).

## First-Time Setup

If you aren't sure the API key is configured, call `get_configuration_status`. If `OPENAI_API_KEY` is missing:

- Tell the user the plugin needs an OpenAI API key from https://platform.openai.com/api-keys.
- If they installed the plugin via marketplace, they can re-run the setup or set the value in their plugin configuration (the manifest exposes `OPENAI_API_KEY` as a `userConfig` field).
- Note: OpenAI gates the gpt-image family behind organization verification — complete it at https://platform.openai.com/settings/organization/general if you get a 403.

## Prompting Best Practices

**Write narrative paragraphs, not comma-separated keyword lists.** gpt-image-2 is autoregressive and follows narrative instructions well.

1. **Start with image type**: "Create an educational diagram showing...", "Generate a photorealistic photograph of...", "Design a flat-style icon depicting..."
2. **Text in images works very well** — gpt-image-2 has ~99% text accuracy including CJK. Quote text exactly and describe font/placement.
3. **Specify layout explicitly**: side-by-side, top-to-bottom steps, centered with border, etc.
4. **Skip quality boosters** like "4k masterpiece", "highly detailed", "award-winning" — they add noise, not quality.
5. **Be specific about what you want**, not what you don't want. Positive descriptions work better than negations.

## Parameters

- **size** — `"1024x1024"` (default, square), `"1536x1024"` (landscape), `"1024x1536"` (portrait), `"2048x2048"` (square hi-res), `"auto"`, or a custom `"WxH"` (edges multiples of 16, max edge 3840, total pixels 655,360–8,294,400, ratio ≤ 3:1).
- **quality** — `"low"`, `"medium"`, `"high"`, `"auto"` (default). Higher quality increases latency and cost.
- **outputFormat** — `"png"` (default, lossless), `"jpeg"` (smaller, faster), `"webp"`.
- **background** — `"auto"` (default) or `"opaque"`. Transparent backgrounds are not supported by gpt-image-2.
- **numberOfImages** — `1` (default). Use 2–4 to explore variations.
- **returnInlineImage** — Consider setting to `false` in Claude Code to avoid context window overflow. The image is still saved to disk and can be viewed by the user.

## Async job model (important)

`generate_image`, `edit_image`, and `continue_editing` are **asynchronous**. They return a `jobId` in under a second and run the actual OpenAI call (10–180s) in the background. To get the result you MUST poll:

1. Call `generate_image` (or `edit_image` / `continue_editing`). Extract `jobId` from the response.
2. Call `check_image_job({ jobId })` every ~5 seconds.
3. When `status: completed`, the response contains the saved file path (and inline base64 if enabled). On `status: failed`, surface the error message to the user.

Do NOT spam-poll faster than every ~3 seconds. Typical wait times:
- `quality: "low"`, 1024x1024 → ~15–25s (3–5 polls)
- `quality: "medium"`, 1024x1024 → ~25–40s (5–8 polls)
- `quality: "high"`, 1536x1024 or larger → ~60–180s (12–36 polls)

This model removes MCP request-timeout errors entirely — every individual tool call is sub-second.

## Workflow

1. **Start** the generation with `generate_image` (or `edit_image` / `continue_editing`). Grab the `jobId`.
2. **Poll** `check_image_job` every ~5s until `completed`.
3. **Refine**: Call `continue_editing` to make adjustments to the last result, then poll again. Be specific about what to change.
4. **Iterate**: Each refinement is its own job; the jobIds are independent.

## Editing with References

`edit_image` and `continue_editing` accept a main image plus optional `referenceImages` (up to 16 total). gpt-image-2 will fuse them per the prompt — useful for product composites, character consistency, or applying a style from one image to another. An optional `mask` (PNG with transparent pixels marking the editable area) can confine changes to a region.

## Style Guidance

- **Diagrams**: Specify colors, label positions, arrow directions. Use `quality: "high"` for complex layouts.
- **Illustrations**: Describe art style (flat, watercolor, line art), mood, and lighting.
- **Infographics**: Long numbered lists (>8 items) can still be unreliable; consider splitting.
- **Photos**: Describe camera angle, lighting conditions, depth of field, and subject positioning.

## Context Window Management

Base64 image data inlined in tool responses can fill the context window quickly (a 1024x1024 PNG is ~800 KB). Set `returnInlineImage: false` (or set the plugin's `MCP_GPT_IMAGE_2_INLINE_IMAGE` user config to `"false"`) to skip embedding it. The image is still saved to disk — tell the user the file path.

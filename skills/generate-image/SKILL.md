---
name: generate-image
description: Generate images using mcp-gpt-image-2 (OpenAI gpt-image-2) MCP tools with best-practice prompting. Use this skill when the user asks to create, generate, or edit images.
allowed-tools: mcp__gpt-image-2__generate_image, mcp__gpt-image-2__edit_image, mcp__gpt-image-2__continue_editing, mcp__gpt-image-2__get_configuration_status, mcp__gpt-image-2__get_last_image_info
---

# Image Generation with OpenAI gpt-image-2

Use the `generate_image`, `edit_image`, and `continue_editing` MCP tools from the `gpt-image-2` server (powered by OpenAI's `gpt-image-2` model).

## First-Time Setup

Before generating images, verify the API key is configured:

1. Call `get_configuration_status` to check if `OPENAI_API_KEY` is set.
2. If the key is missing, instruct the user to add it to their MCP server environment configuration:
   - In Claude Code settings or `.claude/settings.json`, add `OPENAI_API_KEY` to the server's `env` block.
   - The key can be obtained from [OpenAI Platform](https://platform.openai.com/api-keys).
   - Note: OpenAI gates the gpt-image family behind organization verification — complete it in the developer console if you get a 403.

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

## Workflow

1. **Generate**: Use `generate_image` with a well-crafted narrative prompt.
2. **Review**: Check the saved file path in the response.
3. **Refine**: Use `continue_editing` to make adjustments. Be specific about what to change.
4. **Iterate**: Each `continue_editing` call builds on the previous result.

## Editing with References

`edit_image` and `continue_editing` accept a main image plus optional `referenceImages` (up to 16 total). gpt-image-2 will fuse them per the prompt — useful for product composites, character consistency, or applying a style from one image to another. An optional `mask` (PNG with transparent pixels marking the editable area) can confine changes to a region.

## Style Guidance

- **Diagrams**: Specify colors, label positions, arrow directions. Use `quality: "high"` for complex layouts.
- **Illustrations**: Describe art style (flat, watercolor, line art), mood, and lighting.
- **Infographics**: Long numbered lists (>8 items) can still be unreliable; consider splitting.
- **Photos**: Describe camera angle, lighting conditions, depth of field, and subject positioning.

## Context Window Management

When generating images in Claude Code, set `returnInlineImage: false` to prevent base64 image data from filling the context window. The image is still saved to disk — just tell the user where to find it.

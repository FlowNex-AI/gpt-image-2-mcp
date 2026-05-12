# mcp-gpt-image-2

MCP server for **OpenAI's `gpt-image-2`** image generation model.

A fork of [daveremy/nano-banana-2-mcp](https://github.com/daveremy/nano-banana-2-mcp) (originally based on [ConechoAI/Nano-Banana-MCP](https://github.com/ConechoAI/Nano-Banana-MCP)), rewritten to target OpenAI's gpt-image-2 instead of Google Gemini.

Features:

- **gpt-image-2 model** — high-fidelity photorealism, ~99% text accuracy (incl. CJK), strong instruction following
- **Size control** — official presets (1024x1024, 1536x1024, 1024x1536, 2048x2048, auto) and custom `WxH` (multiples of 16, max edge 3840, ratio ≤ 3:1)
- **Quality modes** — `low`, `medium`, `high`, `auto`
- **Output formats** — PNG, JPEG, WebP
- **Multi-image edits** — up to 16 reference images per call, plus optional mask
- **Multiple variations** — generate 1–4 images per call (`n`)
- **File-path-only mode** — no inline base64, fixes context window overflow in Claude Code
- **Security hardening** — path validation, file size caps, no plaintext API key storage

## Setup

### 1. Get an OpenAI API key

Get one from [OpenAI Platform](https://platform.openai.com/api-keys). OpenAI gates the gpt-image family behind organization verification — complete it in the developer console if you hit a 403.

### 2. Install

**Via Claude Code plugin (recommended):**

```bash
claude plugin add mcp-gpt-image-2
```

**Or manually via npx** — add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "gpt-image-2": {
      "command": "npx",
      "args": ["-y", "mcp-gpt-image-2"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Or from source** for development:

```bash
git clone https://github.com/FlowNex-AI/gpt-image-2-mcp.git
cd gpt-image-2-mcp
npm install
npm run build
```

Then point your MCP config at `dist/index.js`:

```json
{
  "mcpServers": {
    "gpt-image-2": {
      "command": "node",
      "args": ["/path/to/gpt-image-2-mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 3. Restart Claude Code

The tools will be available after restart.

## Tools

### `generate_image`

Generate a new image from a text prompt.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | (required) | Text prompt for the image |
| `size` | string | `"1024x1024"` | Preset (`1024x1024`, `1536x1024`, `1024x1536`, `2048x2048`, `auto`) or custom `WxH` |
| `quality` | string | `"auto"` | `low`, `medium`, `high`, or `auto` |
| `numberOfImages` | number | `1` | 1–4 |
| `outputFormat` | string | `"png"` | `png`, `jpeg`, or `webp` |
| `background` | string | `"auto"` | `auto` or `opaque` (transparent not supported) |
| `returnInlineImage` | boolean | `true` | If false, return only file path |

### `edit_image`

Edit an existing image file. Same parameters as `generate_image`, plus:

| Parameter | Type | Description |
|-----------|------|-------------|
| `imagePath` | string | (required) Path to the image to edit |
| `referenceImages` | string[] | Optional additional reference images (up to 15 more, 16 total) |
| `mask` | string | Optional PNG mask path; transparent pixels mark the editable area |

### `continue_editing`

Continue editing the last generated/edited image. Same parameters as `edit_image` minus `imagePath` (uses the last image automatically).

### `get_configuration_status`

Check API key, active model, and settings.

### `get_last_image_info`

Get path and size of the last generated image.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | OpenAI API key |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2` | Model ID override (e.g. `gpt-image-2-2026-04-21`, `gpt-image-1`) |
| `MCP_GPT_IMAGE_2_OUTPUT_DIR` | `./generated_imgs` | Image save directory |
| `MCP_GPT_IMAGE_2_INLINE_IMAGE` | `true` | Default for `returnInlineImage` |

## Size Constraints

When using a custom `WxH` size, gpt-image-2 requires:

- Both edges are multiples of **16**
- Max single edge: **3840px**
- Total pixels: **655,360 – 8,294,400**
- Long-edge to short-edge ratio: **≤ 3:1**

The server validates these before calling the API.

## Claude Code Plugin

This repo includes a Claude Code plugin with a `generate-image` skill that provides best-practice prompting guidance. Install via `claude plugin add mcp-gpt-image-2` or add the repo path to your Claude Code plugins config.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and release process.

## Attribution

Based on [daveremy/nano-banana-2-mcp](https://github.com/daveremy/nano-banana-2-mcp), which is based on [ConechoAI/Nano-Banana-MCP](https://github.com/ConechoAI/Nano-Banana-MCP) (MIT License).

## License

MIT

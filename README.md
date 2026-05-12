# mcp-gpt-image-2

MCP server for **OpenAI's `gpt-image-2`** image generation model. Distributed as a Claude plugin that works in **Claude Code** and **Claude Cowork**.

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

### A) In Claude Code (recommended)

```bash
# 1. Add the marketplace
claude plugin marketplace add FlowNex-AI/gpt-image-2-mcp

# 2. Install (pulls @flownex-ai/mcp-gpt-image-2 from npm)
claude plugin install gpt-image-2@mcp-gpt-image-2-plugins
```

The plugin prompts for your `OPENAI_API_KEY` on install (declared via `userConfig` in `plugin.json`, stored in the system keychain).

Alternative: inside Claude Code, run `/plugin` for an interactive picker.

### B) In Claude Cowork

Cowork installs plugins from npm. The package is published as **`@flownex-ai/mcp-gpt-image-2`**.

1. Open the Claude desktop app → **Cowork** tab.
2. Sidebar → **Customize** → **Browse plugins** → **Add custom plugin** (or **Install from npm**).
3. Paste the package name: `@flownex-ai/mcp-gpt-image-2`
4. When prompted, paste your `OPENAI_API_KEY` (driven by `userConfig` in `plugin.json`, stored in the system keychain).
5. The `generate-image` and `powerpoint-images` skills become available — try *"make me a hero image for slide 1 of my QBR deck"*.

For org-wide MDM deployments, place the unpacked plugin folder under `/Library/Application Support/Claude/org-plugins/` (macOS) or `C:\ProgramData\Claude\org-plugins\` (Windows) and allowlist the MCP server in your MDM policy.

### C) Manual MCP config (skip the plugin)

If you prefer to wire the MCP server directly into Claude Code, Cowork, or any MCP-compatible client (Cursor, Zed, etc.), add this to your MCP config:

```json
{
  "mcpServers": {
    "gpt-image-2": {
      "command": "npx",
      "args": ["-y", "@flownex-ai/mcp-gpt-image-2"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### D) From source (development)

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

## Plugin (Claude Code + Cowork)

This repo includes a unified Claude plugin that works in both **Claude Code** and **Claude Cowork** (same `.claude-plugin/plugin.json` schema). It ships:

- An MCP server (`.mcp.json` declares the `gpt-image-2` server, bundled `dist/index.js`)
- A `userConfig` block that prompts for `OPENAI_API_KEY` on install (stored in the system keychain, not plain text)
- Two skills:
  - `generate-image` — best-practice prompting for general image generation
  - `powerpoint-images` — guidance tailored to PowerPoint / Keynote / Google Slides decks (a natural fit for Cowork knowledge workers)

See the install instructions above for both Claude Code and Cowork.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and release process.

## Attribution

Based on [daveremy/nano-banana-2-mcp](https://github.com/daveremy/nano-banana-2-mcp), which is based on [ConechoAI/Nano-Banana-MCP](https://github.com/ConechoAI/Nano-Banana-MCP) (MIT License).

## License

MIT

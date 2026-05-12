# Changelog

## [Unreleased]

### Added
- **Async job model** for image generation. `generate_image`, `edit_image`, and `continue_editing` now return a `jobId` in <1s and run the OpenAI call in the background. A new `check_image_job` tool polls the status. End-to-end this eliminates the MCP `-32001 Request timed out` error that fired on long (>60s) `quality: "high"` generations.
- `.mcp.json` now declares `timeout: 300000` plus `MCP_TIMEOUT` / `MCP_SERVER_REQUEST_TIMEOUT` env hints as a safety net for clients that don't honor the per-server `timeout` field.

## [0.1.2] - 2026-05-12

### Added
- **Claude Cowork compatibility**: plugin now ships an `.mcp.json` at the repo root (Cowork convention) and a `userConfig` block in `plugin.json` that prompts for `OPENAI_API_KEY` at install time and stores it in the system keychain. Skills carry triggers for knowledge-work contexts (decks, QBR, board, all-hands).

### Changed
- `plugin.json` no longer inlines `mcpServers`; the MCP server is declared in `.mcp.json` so both Claude Code and Cowork pick it up via auto-discovery.
- `generate-image` skill description broadened to cover knowledge-work tasks; Claude-Code-specific wording removed.

## [0.1.0] - 2026-05-12

Initial release of `mcp-gpt-image-2`. This is a fork of [daveremy/nano-banana-2-mcp](https://github.com/daveremy/nano-banana-2-mcp) (Gemini Nano Banana 2) rewritten to target OpenAI's `gpt-image-2` model.

### Added
- MCP server backed by OpenAI's `gpt-image-2` (model overridable via `OPENAI_IMAGE_MODEL`)
- `generate_image`, `edit_image`, `continue_editing`, `get_configuration_status`, `get_last_image_info` tools
- Native OpenAI parameters: `size` (presets + custom `WxH`), `quality` (low/medium/high/auto), `outputFormat` (png/jpeg/webp), `background` (auto/opaque), `numberOfImages` (n=1–4)
- Custom-size validator enforcing OpenAI constraints (edges multiples of 16, max edge 3840px, total pixels 655,360–8,294,400, ratio ≤ 3:1)
- Multi-reference edits (up to 16 images total) and optional PNG `mask` for region-confined edits
- Context-window-safe inline-image opt-out (`returnInlineImage: false`)
- Claude Code plugin (`gpt-image-2`) with `generate-image` skill referencing `mcp__gpt-image-2__*` tools

### Changed (vs. upstream nano-banana-2-mcp)
- Replaced `@google/genai` dependency with `openai`
- Replaced `GEMINI_API_KEY` env var with `OPENAI_API_KEY`
- Renamed env vars `NANO_BANANA_*` → `MCP_GPT_IMAGE_2_*` (`OUTPUT_DIR`, `INLINE_IMAGE`) and `NANO_BANANA_MODEL` → `OPENAI_IMAGE_MODEL`
- Replaced Gemini-specific params (`resolution` 1K/2K/4K, `aspectRatio`, `thinking` minimal/high) with OpenAI-native `size` + `quality`
- Renamed server, plugin, and tool namespace from `nano-banana-2` → `gpt-image-2`
- Renamed npm package from `nano-banana-2-mcp` → `@flownex-ai/mcp-gpt-image-2` (scoped under the FlowNex AI npm org)

### Verified
- End-to-end smoke test against the real OpenAI API: `generate_image` (1024x1024 and custom 1280x720), `edit_image` chained on a generated image, and `get_configuration_status` all return valid PNGs / expected responses.

[Unreleased]: https://github.com/FlowNex-AI/gpt-image-2-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/FlowNex-AI/gpt-image-2-mcp/releases/tag/v0.1.0

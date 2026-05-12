# Contributing to mcp-gpt-image-2

## Development Setup

```bash
git clone https://github.com/FlowNex-AI/gpt-image-2-mcp.git
cd gpt-image-2-mcp
npm install
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Run from source with tsx (hot reload) |
| `npm test` | Run tests |
| `npm start` | Run compiled server |

## Running Locally

1. Build: `npm run build`
2. Set your API key: `export OPENAI_API_KEY=sk-...`
3. (Optional) Override the model: `export OPENAI_IMAGE_MODEL=gpt-image-2-2026-04-21`
4. Start: `npm start`

Or use `npm run dev` to run directly from source during development.

Note: OpenAI gates the gpt-image family behind organization verification. If you get a 403 on first call, complete verification at https://platform.openai.com/settings/organization/general.

## Testing

```bash
npm test
```

Tests use Node's built-in test runner. Add new tests in `test/` with the `.test.ts` extension.

### End-to-end smoke test

To verify the full stdio flow against the real OpenAI API, you can drive the compiled server manually:

```bash
npm run build
OPENAI_API_KEY=sk-... MCP_GPT_IMAGE_2_OUTPUT_DIR=/tmp/img-test \
  node -e '
    import("child_process").then(({spawn}) => {
      const c = spawn("node", ["dist/index.js"], { stdio: ["pipe","pipe","inherit"] });
      const send = (id, method, params) => c.stdin.write(JSON.stringify({jsonrpc:"2.0",id,method,params})+"\n");
      c.stdout.on("data", d => process.stdout.write(d));
      send(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "0" }});
      send(2, "tools/call", { name: "generate_image", arguments: { prompt: "test", quality: "low", returnInlineImage: false }});
    });
  '
```

This will incur a real OpenAI API charge.

## Submitting Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Ensure `npm test` and `npm run build` pass
4. Submit a pull request

## Release Process

Releases are handled by maintainers using `npm run release`. See `scripts/release.sh` for details.

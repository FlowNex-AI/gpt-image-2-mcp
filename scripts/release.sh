#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# release.sh — bump version, build, publish to npm, push tag
#
# Usage:
#   ./scripts/release.sh <major|minor|patch>   (default: patch)
#
# Publishes @flownex-ai/mcp-gpt-image-2 to npm under the @flownex-ai org.
# The marketplace.json source is { npm: "@flownex-ai/mcp-gpt-image-2" }, so
# Claude Code and Claude Cowork resolve the new version automatically once
# this script finishes.
# ---------------------------------------------------------------------------

BUMP="${1:-patch}"

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "ERROR: must be on main branch (currently on $BRANCH)" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is not clean" >&2
  exit 1
fi

if ! npm whoami >/dev/null 2>&1; then
  echo "ERROR: not logged in to npm. Run 'npm login' first." >&2
  exit 1
fi

git pull --rebase

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

echo "Running tests..."
npm test

# ---------------------------------------------------------------------------
# Bump version
# ---------------------------------------------------------------------------

# npm version updates package.json (and package-lock.json) and prints the new
# version with a leading 'v'. We strip the 'v' so the bare semver flows into
# the rest of the script.
NEW_VERSION=$(npm version "$BUMP" --no-git-tag-version | tr -d 'v')
echo "New version: $NEW_VERSION"

# Keep src/version.ts in sync (referenced by the MCP server's metadata).
node -e "
  const fs = require('fs');
  fs.writeFileSync('src/version.ts', 'export const VERSION = \"$NEW_VERSION\";\n');
"

# plugin.json version (used by the Claude plugin manifest).
node -e "
  const fs = require('fs');
  const p = '.claude-plugin/plugin.json';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.version = '$NEW_VERSION';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
"

# marketplace.json plugin version (so Claude resolves the right npm tag).
node -e "
  const fs = require('fs');
  const p = '.claude-plugin/marketplace.json';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.plugins[0].version = '$NEW_VERSION';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
"

# Promote [Unreleased] heading in CHANGELOG.md to the new version + today's date.
TODAY=$(date +%Y-%m-%d)
node -e "
  const fs = require('fs');
  const p = 'CHANGELOG.md';
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace('## [Unreleased]', '## [Unreleased]\n\n## [$NEW_VERSION] - $TODAY');
  fs.writeFileSync(p, c);
"

# ---------------------------------------------------------------------------
# Build + verify tarball
# ---------------------------------------------------------------------------

echo "Building..."
npm run build

echo "Package contents (dry-run):"
npm pack --dry-run

# Sanity check: the tarball must contain the files Claude needs to load the
# plugin (manifest, MCP config, compiled server, skills).
REQUIRED=( ".claude-plugin/plugin.json" ".claude-plugin/marketplace.json" ".mcp.json" "dist/index.js" "skills/generate-image/SKILL.md" "skills/powerpoint-images/SKILL.md" )
TARBALL_LIST=$(npm pack --dry-run --json 2>/dev/null | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    const j = JSON.parse(d);
    console.log(j[0].files.map(f => f.path).join('\n'));
  });
")
for f in "${REQUIRED[@]}"; do
  if ! grep -qx "$f" <<<"$TARBALL_LIST"; then
    echo "ERROR: tarball is missing required file: $f" >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Commit, tag, publish, push
# ---------------------------------------------------------------------------

git add -A
git commit -m "release: v$NEW_VERSION"
git tag "v$NEW_VERSION"

echo "Publishing @flownex-ai/mcp-gpt-image-2@$NEW_VERSION to npm..."
npm publish

git push origin main --tags

echo ""
echo "Released v$NEW_VERSION"
echo "  npm:    https://www.npmjs.com/package/@flownex-ai/mcp-gpt-image-2"
echo "  github: https://github.com/FlowNex-AI/gpt-image-2-mcp/releases/tag/v$NEW_VERSION"

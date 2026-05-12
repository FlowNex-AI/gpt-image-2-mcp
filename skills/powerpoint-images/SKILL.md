---
name: powerpoint-images
description: Use when creating images for PowerPoint, Keynote, or Google Slides presentations — hero slides, section dividers, accent illustrations, diagrams, or icon sets. Triggers on mentions of slides, decks, presentations, PowerPoint, Keynote, Google Slides, pitch deck, board deck, all-hands, QBR, town hall, sales deck, or "make me an image for slide X". A natural fit for Claude Cowork (knowledge workers building decks).
allowed-tools: mcp__gpt-image-2__generate_image, mcp__gpt-image-2__edit_image, mcp__gpt-image-2__continue_editing, mcp__gpt-image-2__get_configuration_status, mcp__gpt-image-2__get_last_image_info
---

# Slide Images with OpenAI gpt-image-2

Use this skill to generate imagery that sits well **inside a slide**, not as a standalone artwork. The constraint is always the same: the image must coexist with title text, body copy, and brand context — it cannot fight them.

## Prerequisite

Call `get_configuration_status` once per session if you aren't sure `OPENAI_API_KEY` is set. If missing, ask the user to add it to the MCP server's `env` block.

## Pick a size that matches the slide aspect

PowerPoint / Keynote / Google Slides defaults:

| Slide aspect | Use case | `size` |
|---|---|---|
| **16:9** (default modern decks) | Full-bleed hero, background, section divider | `1536x1024` (≈3:2, crops cleanly to 16:9) or custom `1920x1088` |
| **4:3** (legacy / corporate) | Full-bleed hero | `1024x1024` cropped, or custom `1440x1088` |
| Any | Centered accent illustration, mascot, spot art | `1024x1024` |
| Any | Vertical pull-quote panel, side rail | `1024x1536` |

Custom sizes must follow gpt-image-2 constraints (multiples of 16, max edge 3840, ratio ≤ 3:1). The server validates these.

Quick rule: **if it fills the slide → landscape; if it sits beside text → square; if it's a side rail → portrait.**

## Style guidance for slides

Slide imagery succeeds when it **supports the message at a glance from 3 meters away**. Apply these:

1. **High contrast, low complexity.** Backgrounds should have one focal point and breathing room for overlaid text. Avoid dense textures in the upper-left or center where titles usually land.
2. **One dominant color or palette.** Tell gpt-image-2 the exact palette ("muted navy, warm cream, single coral accent") so it doesn't clash with the deck's theme.
3. **Negative space on purpose.** For hero images, explicitly ask for negative space on a specific side: *"…with the left third left empty for a title overlay."*
4. **Flat / editorial styles over photorealism** for most business decks. Photorealism is great for product shots, hero customer stories, or industry imagery — not for conceptual slides.
5. **Consistency across the deck.** When generating multiple slides, reuse the **same style sentence** verbatim in every prompt ("flat illustration, single warm-coral accent color on cream background, soft geometric shapes"). Then vary only the subject. This is the single biggest lever for a coherent deck.
6. **No fake logos, no fake brand names.** They'll look amateur and trigger legal review. Describe generic objects instead ("a laptop showing a generic dashboard with bar charts").

## Text inside the image — use sparingly

gpt-image-2's text accuracy is high (~99%), but **text on the image competes with text on the slide**. Use it only when intentional:

- ✅ A single short label or callout (≤ 25 chars) integrated into the illustration
- ✅ A stylized number for a section header ("01", "02")
- ❌ Bullet points (put those in the slide, not the image)
- ❌ Paragraphs (the slide already has text)

When you do request text, quote it exactly and specify the font style: *"the word 'Pipeline' in bold sans-serif, integrated into the illustration as a banner across the top."*

## Workflow

1. **Confirm the slide context first.** Aspect, palette, what text will overlay it, and whether it's hero / accent / icon. If the user didn't say, ask in one line or pick a sensible default and call it out.
2. **Build a reusable style sentence** (color palette + art style + medium). Save it in your head for the whole deck.
3. **Generate** with `generate_image`. Default to `quality: "high"` for hero slides (worth the latency), `quality: "medium"` for accent illustrations.
4. **Refine** with `continue_editing` — typical asks: "move the subject right to leave the left third empty", "warmer color temperature", "remove the small text in the corner".
5. **Batch related slides.** When you need 4–8 spot illustrations for the same deck, call `generate_image` once per concept with `numberOfImages: 2` to pick the best of each pair, reusing the exact same style sentence each time.

## Recommended defaults for slides

```
size: "1536x1024"          // 16:9 hero
quality: "high"            // worth it for slide imagery
outputFormat: "png"        // lossless; designers will recompress
background: "opaque"       // gpt-image-2 doesn't do transparency anyway
returnInlineImage: false   // file path is enough; saves context
```

For spot illustrations / icons that will be placed inside a layout, switch `size` to `"1024x1024"` and `quality` to `"medium"`.

## Cost note

`quality: "high"` at large sizes is the expensive setting. For a 30-slide deck, generate **hero slides** at high quality and **accent illustrations** at medium. The visual difference between medium and high on a 1024x1024 spot illustration on a slide is rarely worth the price multiplier.

## Context Window Management

Always set `returnInlineImage: false` when generating multiple deck images in one session — base64 of a 1536x1024 PNG can be ~1.5 MB and will fill the context fast. The file path is enough for the user to drop the image into their slide tool. (In Cowork, you can also tell the user the saved path and let them drag the file into the PowerPoint/Keynote/Slides window.)

#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, } from "@modelcontextprotocol/sdk/types.js";
import OpenAI, { toFile } from "openai";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { VERSION } from "./version.js";
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_MODEL = "gpt-image-2";
const SIZE_PRESETS = new Set([
    "1024x1024",
    "1536x1024",
    "1024x1536",
    "2048x2048",
    "auto",
]);
const SIZE_PATTERN = /^(\d+)x(\d+)$/;
const MIN_TOTAL_PIXELS = 655_360;
const MAX_TOTAL_PIXELS = 8_294_400;
const MAX_EDGE_PX = 3840;
const VALID_QUALITY = new Set(["low", "medium", "high", "auto"]);
const VALID_OUTPUT_FORMATS = new Set(["png", "jpeg", "webp"]);
const VALID_BACKGROUNDS = new Set(["opaque", "auto"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MAX_IMAGE_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_NUMBER_OF_IMAGES = 4;
const MAX_REFERENCE_IMAGES = 16;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getModelId() {
    return process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
}
function getOutputDir() {
    return process.env.MCP_GPT_IMAGE_2_OUTPUT_DIR || path.join(process.cwd(), "generated_imgs");
}
function resolveInlineImage(perCall) {
    if (perCall !== undefined)
        return perCall;
    const env = process.env.MCP_GPT_IMAGE_2_INLINE_IMAGE;
    if (env !== undefined)
        return env === "true";
    return true; // default
}
function extensionToMime(ext) {
    if (ext === ".webp")
        return "image/webp";
    if (ext === ".png")
        return "image/png";
    return "image/jpeg";
}
function outputFormatToMime(format) {
    if (format === "jpeg")
        return "image/jpeg";
    if (format === "webp")
        return "image/webp";
    return "image/png";
}
function randomId() {
    return Math.random().toString(36).slice(2, 8);
}
function timestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function validateSize(size) {
    if (SIZE_PRESETS.has(size))
        return;
    const match = SIZE_PATTERN.exec(size);
    if (!match) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid size "${size}". Use a preset (${[...SIZE_PRESETS].join(", ")}) or custom WxH like "1280x720".`);
    }
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (w % 16 !== 0 || h % 16 !== 0) {
        throw new McpError(ErrorCode.InvalidParams, `Custom size "${size}" must have both edges as multiples of 16.`);
    }
    if (w > MAX_EDGE_PX || h > MAX_EDGE_PX) {
        throw new McpError(ErrorCode.InvalidParams, `Custom size "${size}" max edge is ${MAX_EDGE_PX}px.`);
    }
    const total = w * h;
    if (total < MIN_TOTAL_PIXELS || total > MAX_TOTAL_PIXELS) {
        throw new McpError(ErrorCode.InvalidParams, `Custom size "${size}" total pixels (${total}) must be between ${MIN_TOTAL_PIXELS} and ${MAX_TOTAL_PIXELS}.`);
    }
    const ratio = Math.max(w, h) / Math.min(w, h);
    if (ratio > 3) {
        throw new McpError(ErrorCode.InvalidParams, `Custom size "${size}" long-edge to short-edge ratio (${ratio.toFixed(2)}) must not exceed 3:1.`);
    }
}
async function validateImagePath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid image extension "${ext}". Allowed: ${[...ALLOWED_IMAGE_EXTENSIONS].join(", ")}`);
    }
    let stat;
    try {
        stat = await fs.stat(filePath);
    }
    catch {
        throw new McpError(ErrorCode.InvalidParams, `File not found: ${filePath}`);
    }
    if (!stat.isFile()) {
        throw new McpError(ErrorCode.InvalidParams, `Not a file: ${filePath}`);
    }
    if (stat.size > MAX_IMAGE_FILE_SIZE) {
        throw new McpError(ErrorCode.InvalidParams, `File too large (${formatBytes(stat.size)}). Max: ${formatBytes(MAX_IMAGE_FILE_SIZE)}`);
    }
}
// ---------------------------------------------------------------------------
// Common image generation parameters (shared schema)
// ---------------------------------------------------------------------------
const imageParamProperties = {
    size: {
        type: "string",
        description: "Image dimensions. Presets: \"1024x1024\" (square), \"1536x1024\" (landscape), \"1024x1536\" (portrait), \"2048x2048\" (square hi-res), \"auto\". Custom \"WxH\" also accepted: edges multiples of 16, max edge 3840px, total pixels 655,360–8,294,400, ratio ≤ 3:1.",
        default: "1024x1024",
    },
    quality: {
        type: "string",
        description: "Rendering quality: \"low\", \"medium\", \"high\", or \"auto\". Higher quality increases latency and cost.",
        default: "auto",
    },
    numberOfImages: {
        type: "number",
        description: "Number of images to generate (1–4).",
        default: 1,
    },
    outputFormat: {
        type: "string",
        description: "Output file format: \"png\" (default), \"jpeg\", or \"webp\".",
        default: "png",
    },
    background: {
        type: "string",
        description: "Background handling: \"opaque\" or \"auto\". Transparent backgrounds are not supported by gpt-image-2.",
        default: "auto",
    },
    returnInlineImage: {
        type: "boolean",
        description: "If false, return only file path (no base64). Saves context window space.",
    },
};
// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
class GptImage2MCP {
    server;
    openai = null;
    lastImagePath = null;
    constructor() {
        this.server = new Server({ name: "gpt-image-2", version: VERSION }, { capabilities: { tools: {} } });
        this.setupHandlers();
    }
    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------
    initOpenAI() {
        if (this.openai)
            return this.openai;
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new McpError(ErrorCode.InvalidRequest, "OPENAI_API_KEY environment variable is required. Set it in your MCP server config.");
        }
        this.openai = new OpenAI({ apiKey });
        return this.openai;
    }
    // -------------------------------------------------------------------------
    // Tool definitions
    // -------------------------------------------------------------------------
    setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "generate_image",
                    description: "Generate a NEW image from text prompt using OpenAI gpt-image-2. Use this ONLY when creating a completely new image, not when modifying an existing one.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prompt: {
                                type: "string",
                                description: "Text prompt describing the NEW image to create from scratch",
                            },
                            ...imageParamProperties,
                        },
                        required: ["prompt"],
                    },
                },
                {
                    name: "edit_image",
                    description: "Edit a SPECIFIC existing image file with OpenAI gpt-image-2, optionally using additional reference images. Use this when you have the exact file path of an image to modify.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            imagePath: {
                                type: "string",
                                description: "Full file path to the main image file to edit",
                            },
                            prompt: {
                                type: "string",
                                description: "Text describing the modifications to make to the existing image",
                            },
                            referenceImages: {
                                type: "array",
                                items: { type: "string" },
                                description: "Optional array of file paths to additional reference images (up to 15 in addition to the main image, 16 total)",
                            },
                            mask: {
                                type: "string",
                                description: "Optional file path to a PNG mask. Transparent pixels indicate the area to edit; must match the main image dimensions.",
                            },
                            ...imageParamProperties,
                        },
                        required: ["imagePath", "prompt"],
                    },
                },
                {
                    name: "continue_editing",
                    description: "Continue editing the LAST image that was generated or edited in this session, optionally using additional reference images.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prompt: {
                                type: "string",
                                description: "Text describing the modifications to the last image",
                            },
                            referenceImages: {
                                type: "array",
                                items: { type: "string" },
                                description: "Optional array of file paths to additional reference images",
                            },
                            mask: {
                                type: "string",
                                description: "Optional file path to a PNG mask matching the last image dimensions",
                            },
                            ...imageParamProperties,
                        },
                        required: ["prompt"],
                    },
                },
                {
                    name: "get_configuration_status",
                    description: "Check if OpenAI API key is configured and which model is active",
                    inputSchema: { type: "object", properties: {}, additionalProperties: false },
                },
                {
                    name: "get_last_image_info",
                    description: "Get information about the last generated/edited image in this session",
                    inputSchema: { type: "object", properties: {}, additionalProperties: false },
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                switch (request.params.name) {
                    case "generate_image":
                        return await this.generateImage(request);
                    case "edit_image":
                        return await this.editImage(request);
                    case "continue_editing":
                        return await this.continueEditing(request);
                    case "get_configuration_status":
                        return this.getConfigurationStatus();
                    case "get_last_image_info":
                        return await this.getLastImageInfo();
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
                }
            }
            catch (error) {
                if (error instanceof McpError)
                    throw error;
                throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    // -------------------------------------------------------------------------
    // Parameter extraction
    // -------------------------------------------------------------------------
    extractImageParams(args) {
        const size = args.size || "1024x1024";
        const quality = args.quality || "auto";
        const outputFormat = (args.outputFormat || "png").toLowerCase();
        const background = args.background || "auto";
        const raw = Math.round(Number(args.numberOfImages) || 1);
        const numberOfImages = Math.min(Math.max(raw, 1), MAX_NUMBER_OF_IMAGES);
        const returnInlineImage = resolveInlineImage(args.returnInlineImage === undefined ? undefined : Boolean(args.returnInlineImage));
        validateSize(size);
        if (!VALID_QUALITY.has(quality)) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid quality "${quality}". Use: ${[...VALID_QUALITY].join(", ")}`);
        }
        if (!VALID_OUTPUT_FORMATS.has(outputFormat)) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid outputFormat "${outputFormat}". Use: ${[...VALID_OUTPUT_FORMATS].join(", ")}`);
        }
        if (!VALID_BACKGROUNDS.has(background)) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid background "${background}". Use: ${[...VALID_BACKGROUNDS].join(", ")}`);
        }
        return { size, quality, numberOfImages, outputFormat, background, returnInlineImage };
    }
    // -------------------------------------------------------------------------
    // Image saving
    // -------------------------------------------------------------------------
    async ensureOutputDir() {
        const dir = getOutputDir();
        await fs.mkdir(dir, { recursive: true });
        return dir;
    }
    async saveImage(base64Data, mimeType, prefix, suffix) {
        const dir = await this.ensureOutputDir();
        const ext = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/webp" ? ".webp" : ".png";
        const name = `${prefix}-${timestamp()}-${randomId()}${suffix || ""}${ext}`;
        const filePath = path.join(dir, name);
        const buffer = Buffer.from(base64Data, "base64");
        await fs.writeFile(filePath, buffer);
        return { filePath, fileSize: buffer.length };
    }
    // -------------------------------------------------------------------------
    // Response building
    // -------------------------------------------------------------------------
    buildResponse(savedImages, returnInlineImage) {
        const content = [];
        const lines = savedImages.map((img) => `${img.filePath} (${formatBytes(img.fileSize)})`);
        const target = savedImages.length === 1 ? "this image" : "the first image";
        lines.push(`Use continue_editing to refine ${target}.`);
        content.push({ type: "text", text: lines.join("\n") });
        if (returnInlineImage) {
            for (const img of savedImages) {
                content.push({
                    type: "image",
                    data: img.base64,
                    mimeType: img.mimeType,
                });
            }
        }
        return { content };
    }
    // -------------------------------------------------------------------------
    // Tools: generate_image
    // -------------------------------------------------------------------------
    async generateImage(request) {
        const args = request.params.arguments;
        const prompt = args.prompt;
        if (!prompt)
            throw new McpError(ErrorCode.InvalidParams, "prompt is required");
        const params = this.extractImageParams(args);
        const openai = this.initOpenAI();
        const modelId = getModelId();
        const generateRequest = {
            model: modelId,
            prompt,
            size: params.size,
            quality: params.quality,
            n: params.numberOfImages,
            output_format: params.outputFormat,
            background: params.background,
        };
        const response = await openai.images.generate(generateRequest);
        const allSaved = await this.processResponse(response, "generated", params);
        if (allSaved.length === 0) {
            return { content: [{ type: "text", text: "No image was generated. Try rephrasing your prompt." }] };
        }
        this.lastImagePath = allSaved[0].filePath;
        return this.buildResponse(allSaved, params.returnInlineImage);
    }
    // -------------------------------------------------------------------------
    // Tools: edit_image
    // -------------------------------------------------------------------------
    async editImage(request) {
        const args = request.params.arguments;
        const imagePath = args.imagePath;
        const prompt = args.prompt;
        const referenceImages = args.referenceImages || [];
        const maskPath = args.mask;
        if (!imagePath)
            throw new McpError(ErrorCode.InvalidParams, "imagePath is required");
        if (!prompt)
            throw new McpError(ErrorCode.InvalidParams, "prompt is required");
        const allPaths = [imagePath, ...referenceImages];
        if (allPaths.length > MAX_REFERENCE_IMAGES) {
            throw new McpError(ErrorCode.InvalidParams, `Too many images (${allPaths.length}). Max: ${MAX_REFERENCE_IMAGES} total (main + references).`);
        }
        for (const p of allPaths) {
            await validateImagePath(p);
        }
        if (maskPath)
            await validateImagePath(maskPath);
        const params = this.extractImageParams(args);
        const openai = this.initOpenAI();
        const modelId = getModelId();
        const imageFiles = await Promise.all(allPaths.map(async (p) => {
            const ext = path.extname(p).toLowerCase();
            const mime = extensionToMime(ext);
            return await toFile(createReadStream(p), path.basename(p), { type: mime });
        }));
        const editRequest = {
            model: modelId,
            image: imageFiles,
            prompt,
            size: params.size,
            quality: params.quality,
            n: params.numberOfImages,
            output_format: params.outputFormat,
            background: params.background,
        };
        if (maskPath) {
            const maskMime = extensionToMime(path.extname(maskPath).toLowerCase());
            editRequest.mask = await toFile(createReadStream(maskPath), path.basename(maskPath), {
                type: maskMime,
            });
        }
        const response = await openai.images.edit(editRequest);
        const saved = await this.processResponse(response, "edited", params);
        if (saved.length === 0) {
            return { content: [{ type: "text", text: "No edited image was produced. Try a different prompt." }] };
        }
        this.lastImagePath = saved[0].filePath;
        return this.buildResponse(saved, params.returnInlineImage);
    }
    // -------------------------------------------------------------------------
    // Tools: continue_editing
    // -------------------------------------------------------------------------
    async continueEditing(request) {
        if (!this.lastImagePath) {
            throw new McpError(ErrorCode.InvalidRequest, "No previous image in this session. Use generate_image or edit_image first.");
        }
        const args = request.params.arguments;
        const editArgs = { ...args, imagePath: this.lastImagePath };
        const editRequest = {
            ...request,
            params: { ...request.params, arguments: editArgs },
        };
        return this.editImage(editRequest);
    }
    // -------------------------------------------------------------------------
    // Tools: get_configuration_status
    // -------------------------------------------------------------------------
    getConfigurationStatus() {
        const hasKey = !!process.env.OPENAI_API_KEY;
        const modelId = getModelId();
        const lines = [
            `API key: ${hasKey ? "configured" : "NOT configured — set OPENAI_API_KEY in MCP server env"}`,
            `Model: ${modelId}`,
            `Output dir: ${getOutputDir()}`,
            `Inline images: ${resolveInlineImage(undefined)}`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
    }
    // -------------------------------------------------------------------------
    // Tools: get_last_image_info
    // -------------------------------------------------------------------------
    async getLastImageInfo() {
        if (!this.lastImagePath) {
            return { content: [{ type: "text", text: "No image generated in this session yet." }] };
        }
        try {
            const stat = await fs.stat(this.lastImagePath);
            return {
                content: [
                    {
                        type: "text",
                        text: `Last image: ${this.lastImagePath}\nSize: ${formatBytes(stat.size)}`,
                    },
                ],
            };
        }
        catch {
            return {
                content: [
                    {
                        type: "text",
                        text: `Last image path recorded: ${this.lastImagePath}\n(File may have been moved or deleted)`,
                    },
                ],
            };
        }
    }
    // -------------------------------------------------------------------------
    // Process OpenAI response → saved images
    // -------------------------------------------------------------------------
    async processResponse(response, prefix, params) {
        const items = response.data || [];
        const mimeType = outputFormatToMime(params.outputFormat);
        const saved = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            let base64 = item.b64_json;
            if (!base64 && item.url) {
                const res = await fetch(item.url);
                if (!res.ok) {
                    throw new McpError(ErrorCode.InternalError, `Failed to download image from ${item.url}`);
                }
                const buf = Buffer.from(await res.arrayBuffer());
                base64 = buf.toString("base64");
            }
            if (!base64)
                continue;
            const suffix = items.length > 1 ? `-${i + 1}` : "";
            const { filePath, fileSize } = await this.saveImage(base64, mimeType, prefix, suffix);
            saved.push({ filePath, fileSize, base64, mimeType });
        }
        return saved;
    }
    // -------------------------------------------------------------------------
    // Run
    // -------------------------------------------------------------------------
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
    }
}
const server = new GptImage2MCP();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map
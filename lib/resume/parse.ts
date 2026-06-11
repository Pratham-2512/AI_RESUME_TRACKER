import "server-only";

/**
 * Resume file parsing + validation. Server-only (uses Node Buffer + parsers).
 * Supported: PDF (pdf-parse), DOCX (mammoth), DOC (word-extractor), TXT.
 * Everything else is rejected with a friendly message.
 */

export const MAX_RESUME_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_EXT = ["pdf", "docx", "doc", "txt"] as const;
export type AllowedExt = (typeof ALLOWED_EXT)[number];

export class ResumeParseError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "ResumeParseError";
    this.code = code;
  }
}

function extensionOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec((name ?? "").trim());
  return m ? m[1].toLowerCase() : "";
}

/** Map an allowed extension to a sensible content-type for storage. */
export function contentTypeForExt(ext: string): string {
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "doc") return "application/msword";
  return "text/plain";
}

/**
 * Validate a file by name/size/mime BEFORE reading it. Returns the allowed
 * extension, or throws ResumeParseError with a specific code/message.
 */
export function validateFile(name: string, size: number, mime: string): AllowedExt {
  const ext = extensionOf(name);
  const type = (mime ?? "").toLowerCase();

  if (!size) throw new ResumeParseError("That file is empty.", "EMPTY");
  if (size > MAX_RESUME_BYTES) {
    throw new ResumeParseError(
      `File too large (${(size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`,
      "TOO_LARGE",
    );
  }
  if (type.startsWith("image/") || /^(jpe?g|png|gif|webp|bmp|tiff?|svg|heic|avif)$/.test(ext)) {
    throw new ResumeParseError("Images aren't supported. Upload a PDF, DOCX, or TXT.", "IMAGE");
  }
  if (ext === "zip" || type === "application/zip" || type === "application/x-zip-compressed") {
    throw new ResumeParseError("ZIP archives aren't supported. Upload a single PDF, DOC, DOCX, or TXT.", "ZIP");
  }
  if (!(ALLOWED_EXT as readonly string[]).includes(ext)) {
    throw new ResumeParseError(
      `Unsupported format${ext ? ` ".${ext}"` : ""}. Supported formats: PDF, DOC, DOCX, TXT.`,
      "UNSUPPORTED",
    );
  }
  return ext as AllowedExt;
}

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ParseResult = { text: string; charCount: number; ext: AllowedExt };

/** Extract plain text from a resume buffer. Throws ResumeParseError on failure. */
export async function parseResume(buf: Buffer, ext: AllowedExt): Promise<ParseResult> {
  let text = "";
  try {
    if (ext === "txt") {
      text = buf.toString("utf-8");
    } else if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result.value ?? "";
    } else if (ext === "doc") {
      const { default: WordExtractor } = await import("word-extractor");
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buf);
      text = doc.getBody() ?? "";
    } else {
      // pdf-parse v2: class API
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      try {
        const result = await parser.getText();
        text = result.text ?? "";
      } finally {
        await parser.destroy();
      }
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown error";
    throw new ResumeParseError(`${ext.toUpperCase()} parsing failed: ${reason}`, "PARSE_FAILED");
  }

  text = normalize(text);
  if (text.length < 30) {
    throw new ResumeParseError(
      "Couldn't extract readable text — the file may be scanned or image-only. Try a text-based file, or paste the text manually.",
      "NO_TEXT",
    );
  }
  return { text, charCount: text.length, ext };
}

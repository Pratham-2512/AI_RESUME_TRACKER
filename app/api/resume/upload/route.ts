import { NextResponse } from "next/server";
import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";
import {
  validateFile,
  parseResume,
  contentTypeForExt,
  ResumeParseError,
} from "@/lib/resume/parse";

export const runtime = "nodejs";
export const maxDuration = 30;

function fail(message: string, code: string, status = 400) {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}

/**
 * POST multipart/form-data { file }.
 * Validates → extracts text → stores the ORIGINAL in the private `resumes`
 * bucket → returns extracted text + storage path. Does NOT create the résumé
 * row (that happens on Save, so the user can edit the text first).
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Invalid upload — expected multipart form-data.", "BAD_FORM");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return fail("No file provided.", "NO_FILE");

  const name = file.name || "resume";
  const size = file.size;
  const mime = file.type || "";

  // 1. Validate (rejects images, zips, oversize, unsupported)
  let ext;
  try {
    ext = validateFile(name, size, mime);
  } catch (e) {
    if (e instanceof ResumeParseError) {
      return fail(e.message, e.code, e.code === "TOO_LARGE" ? 413 : 415);
    }
    return fail("File rejected.", "REJECTED");
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // 2. Extract text
  let parsed;
  try {
    parsed = await parseResume(buf, ext);
  } catch (e) {
    if (e instanceof ResumeParseError) return fail(e.message, e.code, 422);
    return fail("Could not parse the file.", "PARSE_FAILED", 422);
  }

  // 3. Store the original file (service-role bypasses RLS). Non-fatal on failure —
  //    parsing already succeeded, so the user can still save the extracted text.
  let storagePath: string | null = null;
  let storageWarning: string | null = null;
  try {
    const db = createDb();
    const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${OWNER_ID}/${Date.now()}-${safe}`;
    const { error } = await db.storage.from("resumes").upload(path, buf, {
      contentType: mime || contentTypeForExt(ext),
      upsert: false,
    });
    if (error) throw new Error(error.message);
    storagePath = path;
  } catch (e) {
    storageWarning = e instanceof Error ? e.message : "Original file could not be stored.";
    console.error("[resume upload] storage:", storageWarning);
  }

  return NextResponse.json({
    data: {
      text: parsed.text,
      charCount: parsed.charCount,
      fileName: name,
      fileSize: size,
      ext: parsed.ext,
      storagePath,
      stored: storagePath !== null,
      storageWarning,
    },
    error: null,
  });
}

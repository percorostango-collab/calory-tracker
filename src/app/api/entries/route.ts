import { NextRequest, NextResponse } from "next/server";
import {
  createEntriesFromText,
  createEntriesFromImage,
  previewFromText,
  previewFromImage,
} from "@/lib/profiles";
import { GeminiError } from "@/lib/gemini";

export const dynamic = "force-dynamic";

/**
 * POST /api/entries — single coordinator for diary insertions.
 *
 * Two modes:
 *  - Preview (body `preview: true`, or multipart field `preview=1`): runs the
 *    cache/AI step and returns the AiItem[] for the UI; saves NO entries.
 *  - Commit: JSON `{ queryText, date }` or multipart `image` (+ `note`,
 *    `date`) -> one POST replaces the old 3 round-trips (nutrition -> foods/ai
 *    -> log).
 *
 * AI failures surface as GeminiError; they map to the SAME status codes the
 * old nutrition routes used (429/503/502 -> 503 Italian message, others keep
 * their status) so the UI error handling stays identical.
 */

interface FormImage {
  buffer: Buffer;
  mimeType: string;
  note: string | undefined;
}

async function formImage(form: FormData): Promise<FormImage | null> {
  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return null;
  }
  return {
    buffer: Buffer.from(await image.arrayBuffer()),
    mimeType: image.type || "image/jpeg",
    note: typeof form.get("note") === "string" ? (form.get("note") as string) : undefined,
  };
}

async function handleError(err: unknown): Promise<NextResponse> {
  if (err instanceof GeminiError) {
    const status = err.statusCode === 429 || err.statusCode === 503 || err.statusCode === 502 ? 503 : err.statusCode;
    return NextResponse.json({ error: err.message }, { status });
  }
  const message = err instanceof Error ? err.message : "Errore interno.";
  const status = err instanceof Error && message === "Descrizione non valida." ? 400 : 500;
  console.error("[entries] error:", err);
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  try {
    if (isMultipart) {
      const form = await request.formData();
      const img = await formImage(form);
      if (!img) {
        return NextResponse.json({ error: "Nessuna immagine fornita." }, { status: 400 });
      }
      const preview = form.get("preview") === "1"
        || request.nextUrl.searchParams.get("preview") === "1";

      if (preview) {
        const items = await previewFromImage(img.buffer, img.mimeType, img.note);
        return NextResponse.json(items);
      }

      const date = form.get("date");
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "Data mancante o non valida (YYYY-MM-DD)." }, { status: 400 });
      }
      const created = await createEntriesFromImage(img.buffer, img.mimeType, img.note, date);
      return NextResponse.json({ entries: created });
    }

    const body = await request.json();
    const { queryText, date, preview } = body as {
      queryText?: string;
      date?: string;
      preview?: boolean;
    };

    if (!queryText || typeof queryText !== "string" || !queryText.trim()) {
      return NextResponse.json({ error: "Descrizione mancante." }, { status: 400 });
    }

    if (preview) {
      const items = await previewFromText(queryText);
      return NextResponse.json(items);
    }

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Data mancante o non valida (YYYY-MM-DD)." }, { status: 400 });
    }
    const created = await createEntriesFromText(queryText, date);
    return NextResponse.json({ entries: created });
  } catch (err) {
    return handleError(err);
  }
}

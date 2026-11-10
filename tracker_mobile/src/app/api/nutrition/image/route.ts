import { NextResponse } from "next/server";
import { lookupNutritionFromImage, GeminiError } from "@shared/lib/gemini";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  console.log("[DIAGNOSTIC] API Nutrition Image Route called");
  console.log("[DIAGNOSTIC] GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);

  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const note = formData.get("note") as string | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: "No image file provided." },
        { status: 400 }
      );
    }

    console.log(`[DIAGNOSTIC] File received: ${imageFile.name}, Type: ${imageFile.type}, Size: ${imageFile.size} bytes`);

    if (!ALLOWED_MIME_TYPES.includes(imageFile.type)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${imageFile.type}. Supported: ${ALLOWED_MIME_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image size exceeds 10 MB limit." },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    console.log("[DIAGNOSTIC] Image buffer created. Length:", imageBuffer.length);

    const nutrition = await lookupNutritionFromImage(
      imageBuffer,
      imageFile.type,
      note || undefined
    );

    return NextResponse.json(nutrition);
  } catch (error: unknown) {
    console.error("!!! [DIAGNOSTIC] API Nutrition Image Error CRITICAL !!!");
    if (error instanceof Error) {
      console.error("Error Name:", error.name);
      console.error("Error Message:", error.message);
      console.error("Error Stack:", error.stack);
    } else {
      console.error("Unknown error type:", error);
    }

    if (error instanceof GeminiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

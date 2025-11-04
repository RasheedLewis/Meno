import { NextResponse } from "next/server";

import { normalizeOcrOutput } from "@/lib/ocr/normalizer";
import { extractMathFromImage } from "@/lib/ocr/providers";

type OcrSuccess = {
  ok: true;
  data: ReturnType<typeof normalizeOcrOutput>;
};

type OcrFailure = {
  ok: false;
  error: string;
};

export async function POST(request: Request): Promise<Response> {
  let payload: {
    imageBase64?: string;
    fileName?: string;
    prompt?: string;
  };

  try {
    payload = await request.json();
  } catch (error) {
    console.error("OCR: failed to parse request body", error);
    return NextResponse.json<OcrFailure>(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { imageBase64, fileName, prompt } = payload;

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json<OcrFailure>(
      { ok: false, error: "imageBase64 is required" },
      { status: 400 },
    );
  }

  if (!/^data:image\//.test(imageBase64) && !/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
    return NextResponse.json<OcrFailure>(
      { ok: false, error: "imageBase64 must be a base64 encoded image" },
      { status: 400 },
    );
  }

  try {
    const base64Payload = imageBase64.includes(",")
      ? imageBase64.split(",", 2)[1]
      : imageBase64;

    const extraction = await extractMathFromImage(base64Payload, { prompt });
    const normalized = normalizeOcrOutput(extraction);

    return NextResponse.json<OcrSuccess>({ ok: true, data: normalized });
  } catch (error) {
    console.error("OCR error", { error, fileName });
    const message =
      error instanceof Error ? error.message : "Unexpected OCR failure";
    return NextResponse.json<OcrFailure>({ ok: false, error: message }, { status: 500 });
  }
}


import { Client } from "@gradio/client";

export interface FrameAnalysis {
  frameIndex: number;
  timestampSec: number;
  fakeScore: number;
  realScore: number;
}

export interface VideoAnalysisResult {
  verdict: "DEEPFAKE" | "REAL";
  averageFakeScore: number;
  averageRealScore: number;
  frameResults: FrameAnalysis[];
  modelUsed: string;
}

const PRIMARY_SPACE =
  process.env.NEXT_PUBLIC_HF_PRIMARY_SPACE ||
  "bzshzl/dima806-deepfake_vs_real_image_detection";

const FALLBACK_SPACE =
  process.env.NEXT_PUBLIC_HF_FALLBACK_SPACE ||
  "kautilya286/DeepfakeDetection";

function base64ToBlob(base64DataUrl: string): Blob {
  const parts = base64DataUrl.split(";base64,");
  const mime = parts[0]?.split(":")[1] || "image/jpeg";
  const raw = atob(parts[1] || "");
  const uInt8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: mime });
}

function normalizeGradioOutput(data: unknown): { fakeScore: number; realScore: number } {
  // Menangani struktur output Label Gradio: { label: "Fake", confidences: [{ label: "Fake", confidence: 0.88 }, ...] }
  const payload = Array.isArray(data) ? data[0] : data;
  if (payload && typeof payload === "object" && "confidences" in payload) {
    const confs = (payload as { confidences: Array<{ label: string; confidence: number }> }).confidences;
    let fake = 0;
    let real = 0;
    for (const item of confs) {
      const lbl = item.label.toLowerCase();
      if (lbl.includes("fake") || lbl.includes("deepfake") || lbl.includes("artificial")) {
        fake = item.confidence;
      } else if (lbl.includes("real") || lbl.includes("realism")) {
        real = item.confidence;
      }
    }
    if (fake === 0 && real === 0 && confs.length >= 2) {
      fake = confs[0].confidence;
      real = confs[1].confidence;
    }
    return { fakeScore: Number(fake.toFixed(4)), realScore: Number((1 - fake).toFixed(4)) };
  }
  throw new Error("Format respons Space tidak dikenali");
}

async function classifySingleFrameWithSpace(
  spaceId: string,
  frameBlob: Blob
): Promise<{ fakeScore: number; realScore: number }> {
  const app = await Client.connect(spaceId);
  const result = await app.predict("/predict", [frameBlob]);
  return normalizeGradioOutput(result.data);
}

export async function analyzeVideoFrames(
  frames: Array<{ base64: string; timestampSec: number }>,
  fileName?: string,
  presetHint?: "authentic" | "synthetic"
): Promise<VideoAnalysisResult> {
  // 1. Prioritaskan API Route internal yang terhubung ke Hugging Face Inference & Spectral Analyzer
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames, fileName, presetHint }),
    });
    if (res.ok) {
      const data: VideoAnalysisResult = await res.json();
      return data;
    }
  } catch (apiErr) {
    console.warn("API route /api/analyze error, falling back to Gradio Space:", apiErr);
  }

  let activeSpace = PRIMARY_SPACE;
  const frameResults: FrameAnalysis[] = [];

  for (let i = 0; i < frames.length; i++) {
    const blob = base64ToBlob(frames[i].base64);
    let scores: { fakeScore: number; realScore: number };

    try {
      scores = await classifySingleFrameWithSpace(activeSpace, blob);
    } catch {
      activeSpace = FALLBACK_SPACE;
      scores = await classifySingleFrameWithSpace(activeSpace, blob);
    }

    frameResults.push({
      frameIndex: i + 1,
      timestampSec: Number(frames[i].timestampSec.toFixed(2)),
      fakeScore: scores.fakeScore,
      realScore: scores.realScore,
    });
  }

  const totalFake = frameResults.reduce((acc, cur) => acc + cur.fakeScore, 0);
  const avgFake = Number((totalFake / frameResults.length).toFixed(4));
  const avgReal = Number((1 - avgFake).toFixed(4));

  return {
    verdict: avgFake >= 0.5 ? "DEEPFAKE" : "REAL",
    averageFakeScore: avgFake,
    averageRealScore: avgReal,
    frameResults,
    modelUsed: `${activeSpace} (dima806 ViT)`,
  };
}

type FaceApiModule = typeof import("@vladmandic/face-api/dist/face-api.esm.js");

// Bobot model disalin dari node_modules/@vladmandic/face-api/model ke public/
const MODEL_URL = "/models/face-api";
const MIN_CONFIDENCE = 0.5;
// Margin di sekitar kotak wajah agar batas rahang, rambut, dan telinga ikut terpotong:
// area tepi inilah yang paling sering memperlihatkan artefak blending deepfake.
const CROP_MARGIN = 0.3;
const CROP_SIZE = 224;

export const FACE_DETECTOR_NAME = "SSD MobileNet v1 (face-api)";

export interface FaceBox {
  // Koordinat ternormalisasi 0..1 terhadap ukuran frame penuh
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceDetectionResult {
  faceCount: number;
  confidence: number;
  box: FaceBox;
  cropBase64: string;
}

let faceApiPromise: Promise<FaceApiModule> | null = null;

export function loadFaceDetector(): Promise<FaceApiModule> {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api/dist/face-api.esm.js");
      // tf.ready() ada di bundel tfjs face-api, tetapi tidak dideklarasikan di tipe .d.ts-nya
      await (faceapi.tf as unknown as { ready: () => Promise<void> }).ready();
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      return faceapi;
    })().catch((err) => {
      faceApiPromise = null;
      throw err;
    });
  }
  return faceApiPromise;
}

/**
 * Mencari wajah pada frame. Jika ada lebih dari satu, wajah terbesar dipilih
 * sebagai subjek, lalu dipotong persegi 224x224 untuk input detektor ViT.
 */
export async function detectPrimaryFace(
  frame: HTMLCanvasElement
): Promise<FaceDetectionResult | null> {
  const faceapi = await loadFaceDetector();
  const detections = await faceapi.detectAllFaces(
    frame,
    new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE })
  );

  if (detections.length === 0) return null;

  const primary = detections.reduce((largest, current) =>
    current.box.area > largest.box.area ? current : largest
  );

  const { x, y, width, height } = primary.box;
  const side = Math.max(width, height) * (1 + CROP_MARGIN * 2);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const cropSide = Math.min(side, frame.width, frame.height);
  const sx = clamp(centerX - cropSide / 2, 0, frame.width - cropSide);
  const sy = clamp(centerY - cropSide / 2, 0, frame.height - cropSide);

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = CROP_SIZE;
  cropCanvas.height = CROP_SIZE;
  const ctx = cropCanvas.getContext("2d");
  if (!ctx) throw new Error("Gagal menginisialisasi konteks Canvas 2D");
  ctx.drawImage(frame, sx, sy, cropSide, cropSide, 0, 0, CROP_SIZE, CROP_SIZE);

  return {
    faceCount: detections.length,
    confidence: Number(primary.score.toFixed(4)),
    box: {
      x: x / frame.width,
      y: y / frame.height,
      width: width / frame.width,
      height: height / frame.height,
    },
    cropBase64: cropCanvas.toDataURL("image/jpeg", 0.9),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}


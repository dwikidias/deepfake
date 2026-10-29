import { detectPrimaryFace, loadFaceDetector, type FaceBox } from "./face-detection";

export interface ExtractedFrame {
    // Potongan wajah 224x224, inilah yang dikirim ke detektor deepfake
    base64: string;
    timestampSec: number;
    fullFrameBase64: string;
    frameWidth: number;
    frameHeight: number;
    faceBox: FaceBox;
    faceConfidence: number;
    faceCount: number;
}

export interface ExtractedVideoPayload {
    fileName: string;
    durationSec: number;
    frames: ExtractedFrame[];
    scannedFrameCount: number;
}

export type ExtractionProgress = (message: string) => void;

export class NoFaceDetectedError extends Error {
    constructor(scanned: number) {
        super(
            `Tidak ada wajah yang terdeteksi pada ${scanned} titik waktu yang dipindai. Gunakan video dengan wajah yang terlihat jelas.`
        );
        this.name = "NoFaceDetectedError";
    }
}

// Lebar maksimum frame untuk deteksi wajah: cukup tajam untuk wajah kecil,
// tetap ringan untuk pratinjau dan inferensi di browser.
const MAX_FRAME_EDGE = 720;

/**
 * Memindai `scanCount` titik waktu yang tersebar merata, mendeteksi wajah di setiap
 * titik, lalu mengambil hingga `targetCount` frame berwajah yang tersebar merata.
 * Frame tanpa wajah dilewati.
 */
export async function extractFramesFromVideoFile(
    file: File,
    targetCount = 8,
    scanCount = 16,
    onProgress?: ExtractionProgress
): Promise<ExtractedVideoPayload> {
    onProgress?.("Memuat model deteksi wajah...");
    await loadFaceDetector();

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    try {
        await waitForMetadata(video);

        const duration = Math.max(video.duration || 4, 1);
        const sourceWidth = video.videoWidth || 224;
        const sourceHeight = video.videoHeight || 224;
        const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(sourceWidth, sourceHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(sourceWidth * scale);
        canvas.height = Math.round(sourceHeight * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Gagal menginisialisasi konteks Canvas 2D");

        const faceFrames: ExtractedFrame[] = [];

        for (let i = 0; i < scanCount; i++) {
            onProgress?.(`Mencari wajah: frame ${i + 1} dari ${scanCount}...`);
            const timestampSec = Number((((i + 0.5) / scanCount) * duration).toFixed(2));
            await seekVideoToTime(video, timestampSec);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const face = await detectPrimaryFace(canvas);
            if (!face) continue;

            faceFrames.push({
                base64: face.cropBase64,
                timestampSec,
                fullFrameBase64: canvas.toDataURL("image/jpeg", 0.8),
                frameWidth: canvas.width,
                frameHeight: canvas.height,
                faceBox: face.box,
                faceConfidence: face.confidence,
                faceCount: face.faceCount,
            });
        }

        if (faceFrames.length === 0) {
            throw new NoFaceDetectedError(scanCount);
        }

        return {
            fileName: file.name,
            durationSec: Number(duration.toFixed(2)),
            frames: pickEvenly(faceFrames, targetCount),
            scannedFrameCount: scanCount,
        };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

function pickEvenly<T>(items: T[], count: number): T[] {
    if (items.length <= count) return items;
    return Array.from({ length: count }, (_, i) =>
        items[Math.floor(((i + 0.5) / count) * items.length)]
    );
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Format file video tidak didukung oleh browser"));
    });
}

function seekVideoToTime(video: HTMLVideoElement, timeSec: number): Promise<void> {
    return new Promise((resolve) => {
        const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = timeSec;
    });
}

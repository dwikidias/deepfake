export interface ExtractedFrame {
    base64: string;
    timestampSec: number;
}

export interface ExtractedVideoPayload {
    fileName: string;
    durationSec: number;
    frames: ExtractedFrame[];
}

export async function extractFramesFromVideoFile(
    file: File,
    frameCount = 8
): Promise<ExtractedVideoPayload> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const objectUrl = URL.createObjectURL(file);

        video.src = objectUrl;
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";

        video.onloadedmetadata = async () => {
            const duration = Math.max(video.duration || 4, 1);
            const canvas = document.createElement("canvas");
            canvas.width = 224;
            canvas.height = 224;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Gagal menginisialisasi konteks Canvas 2D"));
                return;
            }

            const frames: ExtractedFrame[] = [];

            try {
                for (let i = 0; i < frameCount; i++) {
                    const timestampSec = Number(
                        (((i + 0.5) / frameCount) * duration).toFixed(2)
                    );
                    await seekVideoToTime(video, timestampSec);

                    const minDim = Math.min(video.videoWidth || 224, video.videoHeight || 224);
                    const sx = ((video.videoWidth || 224) - minDim) / 2;
                    const sy = ((video.videoHeight || 224) - minDim) / 2;

                    ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, 224, 224);
                    const base64 = canvas.toDataURL("image/jpeg", 0.85);
                    frames.push({ base64, timestampSec });
                }

                URL.revokeObjectURL(objectUrl);
                resolve({
                    fileName: file.name,
                    durationSec: Number(duration.toFixed(2)),
                    frames,
                });
            } catch (err) {
                URL.revokeObjectURL(objectUrl);
                reject(err);
            }
        };

        video.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Format file video tidak didukung oleh browser"));
        };
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

/**
 * Menghasilkan 8 frame sampel uji coba beresolusi 224x224 JPEG untuk 2 skenario siap klik
 */
export function buildPresetScenarioFrames(
    scenario: "authentic" | "synthetic"
): ExtractedVideoPayload {
    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext("2d");
    const frames: ExtractedFrame[] = [];
    const totalFrames = 8;
    const durationSec = scenario === "authentic" ? 12.4 : 9.6;

    for (let i = 0; i < totalFrames; i++) {
        const timestampSec = Number((((i + 0.5) / totalFrames) * durationSec).toFixed(2));
        if (ctx) {
            // Latar belakang studio
            ctx.fillStyle = scenario === "authentic" ? "#26282A" : "#1F1924";
            ctx.fillRect(0, 0, 224, 224);

            // Siluet struktur wajah untuk pengujian pipeline
            ctx.fillStyle = scenario === "authentic" ? "#D8C2B0" : "#C9A99A";
            ctx.beginPath();
            ctx.ellipse(112, 106, 46 + (i % 2), 58, 0, 0, Math.PI * 2);
            ctx.fill();

            // Garis penanda artefak frekuensi pada sampel sintetis
            if (scenario === "synthetic") {
                ctx.strokeStyle = "rgba(255, 73, 44, 0.45)";
                ctx.lineWidth = 2;
                ctx.strokeRect(72, 62, 80, 92);

                // Simulasi ketidakwajaran tepi rahang (blending boundary)
                ctx.fillStyle = "rgba(152, 165, 239, 0.28)";
                ctx.fillRect(76, 122 + (i % 3) * 2, 72, 14);
            }

            // Watermark frame index teknis di sudut
            ctx.fillStyle = "#FDFFF8";
            ctx.font = "11px monospace";
            ctx.fillText(`FRM-0${i + 1} | ${timestampSec}s`, 12, 208);
        }

        frames.push({
            base64: canvas.toDataURL("image/jpeg", 0.85),
            timestampSec,
        });
    }

    return {
        fileName:
            scenario === "authentic"
                ? "sample_press_briefing_raw.mp4"
                : "sample_faceswap_interview_v2.mp4",
        durationSec,
        frames,
    };
}
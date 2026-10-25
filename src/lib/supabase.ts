import { createClient } from "@supabase/supabase-js";
import type { FrameAnalysis, VideoAnalysisResult } from "./deepfake-client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export interface ScanLogRow {
  id: string;
  created_at: string;
  file_name: string;
  duration_sec: number;
  frame_count: number;
  verdict: "REAL" | "DEEPFAKE";
  avg_fake_score: number;
  avg_real_score: number;
  model_used: string;
  frame_breakdown: FrameAnalysis[];
}

export async function saveScanLog(
  fileName: string,
  durationSec: number,
  result: VideoAnalysisResult
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("scan_logs").insert({
    file_name: fileName,
    duration_sec: durationSec,
    frame_count: result.frameResults.length,
    verdict: result.verdict,
    avg_fake_score: result.averageFakeScore,
    avg_real_score: result.averageRealScore,
    model_used: result.modelUsed,
    frame_breakdown: result.frameResults,
  });
  if (error) {
    console.error("Supabase insert error:", error.message);
  }
}

export async function fetchRecentScanLogs(limit = 8): Promise<ScanLogRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("scan_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as ScanLogRow[];
}

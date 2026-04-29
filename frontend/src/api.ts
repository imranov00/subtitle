export type JobStatus = "pending" | "processing" | "needs_review" | "completed" | "failed";

export type JobPoll = {
  job_id: string;
  status: JobStatus;
  source_language: string | null;
  transcription_data?: string | null;
  ai_analysis?: string | null;
  target_languages: string[];
  error_message: string | null;
  created_at: string;
  downloads: Record<string, { srt?: string; vtt?: string; video?: string }>;
};

export type AIAnalysis = {
  topic: string;
  summary: string;
  tone: string;
  audience: string;
  content_type: string;
  recommended_style: string;
  recommended_font: string;
  recommended_font_size: number;
  highlight_moments: Array<{
    start: number;
    end: number;
    reason: string;
    importance: string;
  }>;
  crop_suggestion: string;
  color_palette: {
    primary: string;
    outline: string;
    shadow: string;
  };
  emoji_suggestions: Record<string, string>;
  editing_notes: string[];
  confidence: number;
};

const apiBase = "";

export async function uploadVideo(
  file: File,
  targetLanguages: string[],
  wordLevel: boolean = false,
  editorMode: boolean = false,
  font: string = "",
  onProgress?: (event: ProgressEvent) => void,
  smartMode: boolean = false
): Promise<{ job_id: string }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("target_languages", JSON.stringify(targetLanguages));
    fd.append("word_level", String(wordLevel));
    fd.append("editor_mode", String(editorMode));
    fd.append("smart_mode", String(smartMode));
    fd.append("font", font);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBase}/api/upload`);

    if (onProgress) {
      xhr.upload.onprogress = onProgress;
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error("Sunucudan geçersiz yanıt alındı"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.detail || xhr.statusText));
        } catch (e) {
          reject(new Error(xhr.statusText));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Yükleme sırasında ağ hatası oluştu"));
    xhr.send(fd);
  });
}

export async function startRender(
  jobId: string, 
  transcriptionData: string, 
  targetLanguages: string[], 
  font: string, 
  quality: string,
  styleTemplate: string = "standard"
) {
  const r = await fetch(`${apiBase}/api/jobs/${jobId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcription_data: transcriptionData,
      target_languages: targetLanguages,
      font,
      video_quality: quality,
      style_template: styleTemplate
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || r.statusText);
  }
  return r.json();
}

export async function getJob(jobId: string): Promise<JobPoll> {
  const r = await fetch(`${apiBase}/api/jobs/${jobId}`);
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

export async function triggerAIAnalysis(jobId: string): Promise<{ ok: boolean; analysis: AIAnalysis }> {
  const r = await fetch(`${apiBase}/api/jobs/${jobId}/ai-analyze`, {
    method: "POST",
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || r.statusText);
  }
  return r.json();
}

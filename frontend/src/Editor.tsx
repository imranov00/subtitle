import { useState, useRef } from "react";
import { startRender } from "./api";

export type Segment = { start: number; end: number; text: string };

type Props = {
  jobId: string;
  transcriptionData: string;
  targets: string[];
  font: string;
  onRenderStared: () => void;
};

export default function Editor({ jobId, transcriptionData, targets, font, onRenderStared }: Props) {
  const [segments, setSegments] = useState<Segment[]>(() => {
    try {
      return JSON.parse(transcriptionData);
    } catch {
      return [];
    }
  });
  const [quality, setQuality] = useState<string>("original");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const updateSegment = (idx: number, field: keyof Segment, val: string | number) => {
    const newSegs = [...segments];
    newSegs[idx] = { ...newSegs[idx], [field]: val };
    setSegments(newSegs);
  };

  const jumpTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleRender = async () => {
    setBusy(true);
    setErr(null);
    try {
      await startRender(jobId, JSON.stringify(segments), targets, font, quality);
      onRenderStared();
    } catch (e: any) {
      setErr(e.message || "Render başlatılamadı");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 mt-8">
      {/* Sol Panel - Video */}
      <div className="lg:w-1/2 flex flex-col gap-4">
        <div className="rounded-2xl overflow-hidden bg-black aspect-video border border-white/10 shadow-xl relative">
          <video 
            ref={videoRef}
            controls
            className="w-full h-full object-contain"
            src={`/api/jobs/${jobId}/raw_video`}
          />
        </div>
        
        <div className="rounded-2xl border border-white/10 bg-surface-850/50 p-6 backdrop-blur-sm">
          <h3 className="font-display font-semibold text-white mb-4">Çıktı Kalitesi Seçimi</h3>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="w-full appearance-none rounded-lg border border-white/10 bg-surface-900/60 px-4 py-2.5 text-sm text-white outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 mb-6"
          >
            <option value="original">Orijinal (Değiştirme)</option>
            <option value="1080p">1080p (Full HD)</option>
            <option value="720p">720p (HD)</option>
            <option value="480p">480p (SD)</option>
          </select>
          
          <button
            onClick={handleRender}
            disabled={busy}
            className="w-full rounded-lg bg-accent/20 border border-accent/40 py-3 text-accent-glow font-medium transition hover:bg-accent/30 disabled:opacity-50"
          >
            {busy ? "Başlatılıyor..." : "Değişiklikleri Kaydet & Videoyu Oluştur"}
          </button>
          {err && <p className="text-red-400 text-sm mt-3">{err}</p>}
        </div>
      </div>

      {/* Sağ Panel - Metin Editörü */}
      <div className="lg:w-1/2 rounded-2xl border border-white/10 bg-surface-850/50 p-6 shadow-xl backdrop-blur-sm flex flex-col h-[600px]">
        <h2 className="font-display text-lg font-semibold text-white mb-2">Altyazı Metinleri</h2>
        <p className="text-sm text-slate-400 mb-4">Metni değiştirebilir veya zaman kodlarına tıklayarak videoda o saniyeye zıplayabilirsiniz.</p>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {segments.map((seg, i) => (
            <div key={i} className="flex gap-3 items-start bg-surface-900/40 p-3 rounded-lg border border-white/5 transition hover:border-white/20">
              <div 
                className="flex flex-col gap-1 w-24 shrink-0 cursor-pointer text-accent/80 hover:text-accent-glow"
                onClick={() => jumpTo(seg.start)}
                title="Bu saniyeye git"
              >
                <input 
                  type="number" step="0.1" 
                  value={seg.start}
                  onChange={e => updateSegment(i, "start", parseFloat(e.target.value))}
                  className="w-full bg-transparent border-b border-transparent focus:border-accent/50 text-xs font-mono py-1 px-1 outline-none text-slate-300" 
                />
                <input 
                  type="number" step="0.1" 
                  value={seg.end}
                  onChange={e => updateSegment(i, "end", parseFloat(e.target.value))}
                  className="w-full bg-transparent border-b border-transparent focus:border-accent/50 text-xs font-mono py-1 px-1 outline-none text-slate-500" 
                />
              </div>
              <textarea
                value={seg.text}
                onChange={e => updateSegment(i, "text", e.target.value)}
                onFocus={() => jumpTo(seg.start)}
                className="flex-1 min-h-[40px] resize-y rounded bg-surface-800/50 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-accent/50 border border-white/5"
              />
            </div>
          ))}
          {segments.length === 0 && (
            <p className="text-slate-500 text-center py-10">Konuşma bulunamadı veya analiz verisi boş.</p>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import { Trash2, Scissors, Plus, Palette, Type, Brain } from "lucide-react";
import { startRender, type AIAnalysis } from "./api";
import AIAnalysisPanel from "./AIAnalysisPanel";

export type Segment = { start: number; end: number; text: string };

type Props = {
  jobId: string;
  transcriptionData: string;
  aiAnalysisData?: string | null;
  targets: string[];
  font: string;
  onRenderStared: () => void;
};

const PX_PER_SEC = 200; // Zoom seviyesi

export default function TimelineEditor({ jobId, transcriptionData, aiAnalysisData, targets, font, onRenderStared }: Props) {
  const [segments, setSegments] = useState<Segment[]>(() => {
    try {
      return JSON.parse(transcriptionData);
    } catch {
      return [];
    }
  });

  const [quality, setQuality] = useState<string>("1080p");
  const [styleTemplate, setStyleTemplate] = useState<string>("mrbeast");
  
  // Custom Styles
  const [customFontSize, setCustomFontSize] = useState<string>("");
  const [customColor, setCustomColor] = useState<string>("");
  const [alignment, setAlignment] = useState<string>("bottom"); // bottom, middle, top

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(() => {
    if (!aiAnalysisData) return null;
    try {
      return JSON.parse(aiAnalysisData) as AIAnalysis;
    } catch {
      return null;
    }
  });
  const [showAiPanel, setShowAiPanel] = useState(!!aiAnalysisData);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const [dragState, setDragState] = useState<{ idx: number; type: 'start' | 'end' | 'move'; x: number; origStart: number; origEnd: number } | null>(null);

  // Waveform Entegrasyonu
  useEffect(() => {
    if (!videoRef.current || !waveformRef.current) return;
    const ws = WaveSurfer.create({
      container: waveformRef.current,
      media: videoRef.current,
      waveColor: 'rgba(255, 255, 255, 0.2)',
      progressColor: 'rgba(45, 212, 191, 0.5)', // Teal rengi
      height: 64,
      minPxPerSec: PX_PER_SEC,
      autoScroll: false,
      interact: false, // Kullanıcı kendi timeline track'ine tıklayacak
    });
    return () => ws.destroy();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleTimeUpdate = () => setCurrentTime(v.currentTime);
    const handleLoadedMetadata = () => {
      let d = v.duration;
      const maxSegEnd = segments.reduce((max, s) => Math.max(max, s.end), 0);
      if (maxSegEnd > d) d = maxSegEnd + 5;
      setDuration(d);
    };

    v.addEventListener("timeupdate", handleTimeUpdate);
    v.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      v.removeEventListener("timeupdate", handleTimeUpdate);
      v.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [segments]);

  // Drag & Drop / Resize Mantığı
  useEffect(() => {
    if (!dragState) return;

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.x;
      const dt = dx / PX_PER_SEC;
      let newStart = dragState.origStart;
      let newEnd = dragState.origEnd;

      if (dragState.type === 'start') {
        newStart = Math.max(0, Math.min(dragState.origEnd - 0.1, dragState.origStart + dt));
      } else if (dragState.type === 'end') {
        newEnd = Math.max(dragState.origStart + 0.1, dragState.origEnd + dt);
      } else if (dragState.type === 'move') {
        newStart = Math.max(0, dragState.origStart + dt);
        const shift = newStart - dragState.origStart;
        newEnd = dragState.origEnd + shift;
      }

      updateSegment(dragState.idx, 'start', Number(newStart.toFixed(2)));
      updateSegment(dragState.idx, 'end', Number(newEnd.toFixed(2)));
    };

    const onUp = () => setDragState(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragState]);

  const updateSegment = (idx: number, field: keyof Segment, val: string | number) => {
    const newSegs = [...segments];
    newSegs[idx] = { ...newSegs[idx], [field]: val };
    setSegments(newSegs);
  };

  const handleDeleteSegment = () => {
    if (selectedIdx === null) return;
    const newSegs = segments.filter((_, i) => i !== selectedIdx);
    setSegments(newSegs);
    setSelectedIdx(null);
  };

  const handleSplitSegment = () => {
    if (selectedIdx === null) return;
    const seg = segments[selectedIdx];
    if (currentTime > seg.start && currentTime < seg.end) {
      const newSegs = [...segments];
      const time = Number(currentTime.toFixed(2));
      
      const firstHalf = { ...seg, end: time };
      const secondHalf = { ...seg, start: time, text: seg.text + " (kopya)" };
      
      newSegs.splice(selectedIdx, 1, firstHalf, secondHalf);
      setSegments(newSegs);
      setSelectedIdx(selectedIdx + 1); // Select the new segment
    }
  };

  const handleAddSegment = () => {
    const time = Number(currentTime.toFixed(2));
    const newSeg = { start: time, end: time + 2, text: "Yeni Altyazı" };
    const newSegs = [...segments, newSeg].sort((a, b) => a.start - b.start);
    setSegments(newSegs);
    setSelectedIdx(newSegs.indexOf(newSeg));
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    videoRef.current.currentTime = clickX / PX_PER_SEC;
  };

  const handleRender = async () => {
    setBusy(true);
    setErr(null);
    try {
      const customFontData = JSON.stringify({
        family: font,
        size: customFontSize,
        color: customColor,
        alignment: alignment === "top" ? 8 : alignment === "middle" ? 5 : 2
      });
      await startRender(jobId, JSON.stringify(segments), targets, customFontData, quality, styleTemplate);
      onRenderStared();
    } catch (e: any) {
      setErr(e.message || "Render başlatılamadı");
    } finally {
      setBusy(false);
    }
  };

  // AI önerilerini uygula
  const handleApplyAI = (analysis: AIAnalysis) => {
    if (analysis.recommended_style) setStyleTemplate(analysis.recommended_style);
    if (analysis.recommended_font_size) setCustomFontSize(String(analysis.recommended_font_size));
    if (analysis.color_palette?.primary) setCustomColor(analysis.color_palette.primary);
    // alignment: AI'dan gelen recommended_style'a göre
    if (analysis.recommended_style === "mrbeast" || analysis.recommended_style === "hormozi") {
      setAlignment("middle");
    }
  };

  const selectedSeg = selectedIdx !== null ? segments[selectedIdx] : null;
  
  // Find current active segment for preview
  const activeSeg = segments.find(s => currentTime >= s.start && currentTime <= s.end);

  return (
    <div className="flex flex-col gap-6 mt-6 h-[85vh]">
      <div className="flex flex-row gap-6 h-[55%]">
        <div className="flex-1 rounded-2xl overflow-hidden bg-black border border-white/10 shadow-xl relative flex items-center justify-center group">
          <video
            ref={videoRef}
            controls
            className="w-full h-full object-contain"
            src={`/api/jobs/${jobId}/raw_video`}
          />
          
          {/* Real-time Subtitle Preview Overlay */}
          {activeSeg && (
            <div 
              className={`absolute left-0 right-0 px-10 pointer-events-none flex justify-center transition-all duration-200 ${
                alignment === "top" ? "top-8" : alignment === "middle" ? "top-1/2 -translate-y-1/2" : "bottom-12"
              }`}
            >
              <div 
                className="text-center font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] px-4 py-1 rounded"
                style={{ 
                  fontSize: customFontSize ? `${parseInt(customFontSize) / 4}px` : '24px',
                  color: customColor.startsWith('&H') ? '#fff' : (customColor || '#fff'),
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  fontFamily: font || 'inherit'
                }}
              >
                {activeSeg.text}
              </div>
            </div>
          )}
        </div>

        <div className="w-80 rounded-2xl border border-white/10 bg-surface-850/50 p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          {/* AI Analysis Panel */}
          {aiAnalysis && showAiPanel && (
            <div className="mb-2">
              <AIAnalysisPanel
                analysis={aiAnalysis}
                jobId={jobId}
                onApplyAll={handleApplyAI}
                onReAnalyze={(newAnalysis) => setAiAnalysis(newAnalysis)}
              />
            </div>
          )}

          {/* AI Toggle Button (if analysis exists but panel hidden) */}
          {aiAnalysis && !showAiPanel && (
            <button
              onClick={() => setShowAiPanel(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-500/10 border border-violet-500/20 py-2.5 text-sm font-medium text-violet-300 hover:bg-violet-500/20 transition-all mb-2"
            >
              <Brain className="w-4 h-4" />
              AI Analizi Göster
            </button>
          )}

          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-white flex items-center gap-2">
              <Type className="w-4 h-4 text-accent" />
              Denetçi
            </h3>
            <button
              onClick={handleAddSegment}
              className="p-1.5 rounded-lg bg-surface-900/60 text-slate-300 hover:text-accent hover:bg-accent/10 transition-colors"
              title="Yeni Altyazı Ekle"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {selectedSeg ? (
            <div className="flex flex-col gap-3 animate-fade-in-up">
              <div className="flex justify-end gap-2 mb-1">
                <button
                  onClick={handleSplitSegment}
                  className="p-1.5 rounded-lg bg-surface-900/60 text-amber-400 hover:bg-amber-400/20 transition-colors flex items-center gap-1 text-xs font-medium"
                  title="Oynatma imlecinden ikiye böl"
                >
                  <Scissors className="w-3.5 h-3.5" /> Böl
                </button>
                <button
                  onClick={handleDeleteSegment}
                  className="p-1.5 rounded-lg bg-surface-900/60 text-red-400 hover:bg-red-400/20 transition-colors flex items-center gap-1 text-xs font-medium"
                  title="Bu parçayı sil"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Sil
                </button>
              </div>

              <label className="text-sm font-medium text-slate-300">Metin</label>
              <textarea
                value={selectedSeg.text}
                onChange={(e) => updateSegment(selectedIdx!, "text", e.target.value)}
                className="w-full min-h-[80px] bg-surface-900/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-accent outline-none ring-1 ring-transparent focus:ring-accent/30 transition-all custom-scrollbar"
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Başlangıç (sn)</label>
                  <input
                    type="number" step="0.1"
                    value={selectedSeg.start}
                    onChange={(e) => updateSegment(selectedIdx!, "start", parseFloat(e.target.value) || 0)}
                    className="w-full bg-surface-900/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Bitiş (sn)</label>
                  <input
                    type="number" step="0.1"
                    value={selectedSeg.end}
                    onChange={(e) => updateSegment(selectedIdx!, "end", parseFloat(e.target.value) || 0)}
                    className="w-full bg-surface-900/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 py-10 text-center flex flex-col items-center gap-3 bg-surface-900/30 rounded-xl border border-white/5 p-6">
              <div className="p-3 bg-surface-800 rounded-full text-slate-400">
                <Type className="w-5 h-5" />
              </div>
              Zaman çizelgesinden bir blok seçin veya sağ kenarlarından sürükleyin.
            </div>
          )}

          <div className="mt-auto border-t border-white/10 pt-5 flex flex-col gap-4">
            
            <div className="bg-surface-900/40 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
              <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider mb-1">
                <Palette className="w-3.5 h-3.5 text-accent" /> İleri Seviye Stil
              </h4>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 mb-1 block">Boyut (px)</label>
                  <input
                    type="number"
                    placeholder="Oto"
                    value={customFontSize}
                    onChange={(e) => setCustomFontSize(e.target.value)}
                    className="w-full bg-surface-900/80 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-400 mb-1 block">Renk (Hex/&H...)</label>
                  <input
                    type="text"
                    placeholder="Oto"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-full bg-surface-900/80 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Konum (Hizalama)</label>
                <div className="flex gap-1 bg-surface-950/40 p-1 rounded-lg border border-white/5">
                  {(["top", "middle", "bottom"] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setAlignment(pos)}
                      className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${
                        alignment === pos 
                          ? "bg-accent text-surface-950 shadow-sm" 
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {pos === "top" ? "ÜST" : pos === "middle" ? "ORTA" : "ALT"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Yapay Zeka Şablonu</label>
              <select
                value={styleTemplate}
                onChange={(e) => setStyleTemplate(e.target.value)}
                className="w-full bg-surface-900/80 border border-accent/20 rounded-lg px-3 py-2.5 text-sm text-accent-glow outline-none focus:border-accent"
              >
                <option value="standard">Standart Temiz (Orijinal)</option>
                <option value="mrbeast">MrBeast Stili (Kalın & Sarı)</option>
                <option value="hormozi">Hormozi Stili (Renkli)</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-400 mb-1 block">Çıktı Kalitesi</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="w-full bg-surface-900/80 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-white/30"
                >
                  <option value="original">Orijinal Bırak</option>
                  <option value="1080p">1080p (FHD)</option>
                  <option value="720p">720p (HD)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleRender}
              disabled={busy}
              className="w-full rounded-lg bg-accent/20 border border-accent/40 py-3 text-accent-glow font-medium hover:bg-accent/30 disabled:opacity-50"
            >
              {busy ? "Oluşturuluyor..." : "Değişiklikleri Videoya Göm"}
            </button>
            {err && <p className="text-red-400 text-xs">{err}</p>}
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-2xl border border-white/10 bg-[#1e1e1e] overflow-hidden flex flex-col shadow-inner relative select-none">
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.8)]"
          style={{ left: `${(currentTime * PX_PER_SEC)}px`, transform: `translateX(${-(timelineRef.current?.scrollLeft ?? 0)}px)` }}
        >
          <div className="w-3 h-3 bg-red-500 clip-path-playhead absolute -top-1 -left-[5px]"></div>
        </div>

        <div
          className="flex-1 overflow-x-auto overflow-y-hidden relative custom-scrollbar"
          ref={timelineRef}
          onScroll={() => setCurrentTime(currentTime)}
        >
          <div
            className="absolute top-0 bottom-0 cursor-crosshair min-w-full"
            style={{ width: `${Math.max(duration, 10) * PX_PER_SEC}px` }}
            onClick={handleTimelineClick}
          >
            {/* Dalga Formu Desteği (Background) */}
            <div ref={waveformRef} className="absolute inset-0 top-8 opacity-40 pointer-events-none" />

            {/* AI Highlight Markers */}
            {aiAnalysis?.highlight_moments?.map((h, i) => (
              <div
                key={`highlight-${i}`}
                className="absolute top-8 bottom-0 pointer-events-none z-5 opacity-20"
                style={{
                  left: `${h.start * PX_PER_SEC}px`,
                  width: `${Math.max((h.end - h.start) * PX_PER_SEC, 4)}px`,
                  background: h.importance === 'high' 
                    ? 'linear-gradient(to bottom, rgba(251,191,36,0.4), transparent)'
                    : h.importance === 'medium'
                      ? 'linear-gradient(to bottom, rgba(168,85,247,0.3), transparent)'
                      : 'linear-gradient(to bottom, rgba(148,163,184,0.2), transparent)',
                }}
              >
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 text-[8px] font-bold px-1 rounded-b ${
                  h.importance === 'high' ? 'bg-amber-500/30 text-amber-300' : 'bg-violet-500/30 text-violet-300'
                }`}>
                  ★
                </div>
              </div>
            ))}

            {/* Zaman Cetveli */}
            <div className="h-8 border-b border-white/5 bg-[#252526] sticky top-0 flex pointer-events-none z-30">
              {Array.from({ length: Math.ceil(Math.max(duration, 10)) }).map((_, i) => (
                <div key={i} className="h-full border-l border-white/10 text-[10px] text-slate-500 pl-1 pt-1" style={{ width: `${PX_PER_SEC}px` }}>
                  00:00:{i.toString().padStart(2, '0')}
                </div>
              ))}
            </div>

            <div className="absolute top-[50%] h-14 w-full mt-[-10px] z-40">
              <div className="text-xs text-white/30 absolute -left-16 top-4 font-mono">TEXT</div>
              <div className="absolute inset-0 border-y border-white/5 bg-white/[0.02]"></div>

              {segments.map((seg, i) => {
                const isSelected = selectedIdx === i;
                return (
                  <div
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setSelectedIdx(i); }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragState({ idx: i, type: 'move', x: e.clientX, origStart: seg.start, origEnd: seg.end });
                      setSelectedIdx(i);
                    }}
                    className={`absolute h-10 top-2 rounded overflow-visible flex items-center px-2 cursor-grab active:cursor-grabbing transition-colors duration-100 group
                      ${isSelected ? "bg-accent/40 border border-accent/80 z-20 shadow-[0_0_10px_rgba(var(--color-accent),0.4)]" : "bg-teal-600/40 border border-teal-500/50 hover:bg-teal-500/50 z-10"}
                    `}
                    style={{
                      left: `${seg.start * PX_PER_SEC}px`,
                      width: `${Math.max((seg.end - seg.start) * PX_PER_SEC, 15)}px`
                    }}
                    title={`[${seg.start} - ${seg.end}] ${seg.text}`}
                  >
                    {/* Resize Left End */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDragState({ idx: i, type: 'start', x: e.clientX, origStart: seg.start, origEnd: seg.end });
                      }}
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize bg-white/0 group-hover:bg-white/20 hover:bg-red-400 z-30"
                    />

                    <span className="text-[11px] font-medium text-white whitespace-nowrap overflow-hidden text-ellipsis drop-shadow-md pointer-events-none">
                      {seg.text}
                    </span>

                    {/* Resize Right End */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDragState({ idx: i, type: 'end', x: e.clientX, origStart: seg.start, origEnd: seg.end });
                      }}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize bg-white/0 group-hover:bg-white/20 hover:bg-red-400 z-30"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

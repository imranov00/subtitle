import { useState } from "react";
import {
  Brain,
  Sparkles,
  Target,
  Palette,
  Scissors,
  Star,
  CheckCircle2,
  Zap,
  Eye,
  MessageSquare,
  Users,
  RefreshCw,
} from "lucide-react";
import { triggerAIAnalysis, type AIAnalysis } from "./api";

type Props = {
  analysis: AIAnalysis;
  jobId: string;
  onApplyAll: (analysis: AIAnalysis) => void;
  onReAnalyze: (analysis: AIAnalysis) => void;
};

const TONE_ICONS: Record<string, string> = {
  enerjik: "⚡",
  ciddi: "🎯",
  eğlenceli: "🎉",
  dramatik: "🎭",
  sakin: "🧘",
  motivasyonel: "💪",
  eğitici: "📚",
  romantik: "❤️",
};

const CONTENT_ICONS: Record<string, string> = {
  motivasyon: "💪",
  eğitim: "📚",
  eğlence: "🎮",
  haber: "📰",
  vlog: "📹",
  gaming: "🎮",
  müzik: "🎵",
  spor: "⚽",
  teknoloji: "💻",
  yemek: "🍕",
  seyahat: "✈️",
};

const STYLE_INFO: Record<string, { label: string; color: string; bg: string }> = {
  mrbeast: { label: "MrBeast Stili", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  hormozi: { label: "Hormozi Stili", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  standard: { label: "Standart Temiz", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  cinematic: { label: "Sinematik", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
};

export default function AIAnalysisPanel({ analysis, jobId, onApplyAll, onReAnalyze }: Props) {
  const [reAnalyzing, setReAnalyzing] = useState(false);
  const [appliedSections, setAppliedSections] = useState<Set<string>>(new Set());

  const styleInfo = STYLE_INFO[analysis.recommended_style] || STYLE_INFO.standard;
  const confidencePercent = Math.round((analysis.confidence || 0) * 100);

  const handleReAnalyze = async () => {
    setReAnalyzing(true);
    try {
      const result = await triggerAIAnalysis(jobId);
      onReAnalyze(result.analysis);
    } catch (e) {
      console.error("Re-analyze failed:", e);
    } finally {
      setReAnalyzing(false);
    }
  };

  const toggleSection = (section: string) => {
    setAppliedSections((prev) => {
      const n = new Set(prev);
      if (n.has(section)) n.delete(section);
      else n.add(section);
      return n;
    });
  };

  return (
    <div className="rounded-3xl overflow-hidden relative animate-fade-in-up">
      {/* AI Gradient Header */}
      <div className="relative bg-gradient-to-r from-violet-600/20 via-fuchsia-500/15 to-cyan-500/20 p-6 border border-white/10 rounded-t-3xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.15),transparent_50%)]" />
        <div className="absolute top-2 right-2 flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-pulse"
              style={{ animationDelay: `${i * 300}ms` }}
            />
          ))}
        </div>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500/30 rounded-xl blur-lg animate-pulse" />
              <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg">
                <Brain className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                AI Akıllı Analiz
                <span className="inline-flex items-center rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300 ring-1 ring-inset ring-violet-500/30 uppercase tracking-wider">
                  Gemini
                </span>
              </h3>
              <p className="text-sm text-slate-400">{analysis.topic || "Analiz tamamlandı"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Confidence Badge */}
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
              confidencePercent >= 80 ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20" :
              confidencePercent >= 50 ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20" :
              "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
            }`}>
              <Target className="w-3 h-3" />
              %{confidencePercent} Güven
            </div>

            <button
              onClick={handleReAnalyze}
              disabled={reAnalyzing}
              className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
              title="Yeniden Analiz Et"
            >
              <RefreshCw className={`w-4 h-4 ${reAnalyzing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="bg-surface-900/60 border border-t-0 border-white/10 rounded-b-3xl p-5 space-y-4">
        {/* Summary */}
        {analysis.summary && (
          <div className="bg-surface-950/50 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Özet</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
          </div>
        )}

        {/* Tags Row */}
        <div className="flex flex-wrap gap-2">
          {analysis.tone && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-white/5">
              <span>{TONE_ICONS[analysis.tone] || "🎬"}</span>
              {analysis.tone.charAt(0).toUpperCase() + analysis.tone.slice(1)}
            </span>
          )}
          {analysis.content_type && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-white/5">
              <span>{CONTENT_ICONS[analysis.content_type] || "📄"}</span>
              {analysis.content_type.charAt(0).toUpperCase() + analysis.content_type.slice(1)}
            </span>
          )}
          {analysis.audience && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-white/5">
              <Users className="w-3 h-3" />
              {analysis.audience.charAt(0).toUpperCase() + analysis.audience.slice(1)}
            </span>
          )}
          {analysis.crop_suggestion && analysis.crop_suggestion !== "keep_original" && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 ring-1 ring-amber-500/20">
              <Scissors className="w-3 h-3" />
              {analysis.crop_suggestion === "vertical_9_16" ? "9:16 Dikey" : "1:1 Kare"}
            </span>
          )}
        </div>

        {/* Recommended Style */}
        <div
          className={`rounded-xl p-4 border cursor-pointer transition-all ${
            appliedSections.has("style") ? "ring-2 ring-violet-500/50 bg-violet-500/5" : styleInfo.bg
          }`}
          onClick={() => toggleSection("style")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${styleInfo.bg}`}>
                <Palette className={`w-4 h-4 ${styleInfo.color}`} />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Önerilen Stil</span>
                <p className={`text-sm font-bold ${styleInfo.color}`}>{styleInfo.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                Font: <strong className="text-slate-300">{analysis.recommended_font}</strong>
              </span>
              {appliedSections.has("style") ? (
                <CheckCircle2 className="w-5 h-5 text-violet-400" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-white/20" />
              )}
            </div>
          </div>
        </div>

        {/* Highlight Moments */}
        {analysis.highlight_moments && analysis.highlight_moments.length > 0 && (
          <div className="rounded-xl bg-surface-950/50 p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Öne Çıkan Anlar</span>
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                {analysis.highlight_moments.length}
              </span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
              {analysis.highlight_moments.map((h, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-surface-900/60 p-2.5 border border-white/5 hover:border-amber-500/20 transition-colors group"
                >
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    h.importance === "high" ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]" :
                    h.importance === "medium" ? "bg-amber-400" : "bg-slate-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">
                        {h.start.toFixed(1)}s — {h.end.toFixed(1)}s
                      </span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        h.importance === "high" ? "bg-red-500/10 text-red-400" :
                        h.importance === "medium" ? "bg-amber-500/10 text-amber-400" :
                        "bg-slate-500/10 text-slate-400"
                      }`}>
                        {h.importance === "high" ? "Yüksek" : h.importance === "medium" ? "Orta" : "Düşük"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{h.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emoji Suggestions */}
        {analysis.emoji_suggestions && Object.keys(analysis.emoji_suggestions).length > 0 && (
          <div className="rounded-xl bg-surface-950/50 p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">😎</span>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Emoji Önerileri</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(analysis.emoji_suggestions).map(([word, emoji]) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1 rounded-md bg-surface-900/60 px-2 py-1 text-[11px] text-slate-300 border border-white/5 hover:border-violet-500/30 transition-colors cursor-default"
                >
                  <span>{emoji}</span>
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Editing Notes */}
        {analysis.editing_notes && analysis.editing_notes.length > 0 && (
          <div className="rounded-xl bg-surface-950/50 p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Düzenleme Önerileri</span>
            </div>
            <ul className="space-y-1.5">
              {analysis.editing_notes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <Zap className="w-3 h-3 text-cyan-500 mt-0.5 flex-shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Apply All Button */}
        <button
          onClick={() => onApplyAll(analysis)}
          className="w-full relative group rounded-xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
          <div className="relative flex items-center justify-center gap-2 py-3.5 text-white font-bold text-sm">
            <Sparkles className="w-4 h-4" />
            Tüm AI Önerilerini Uygula
          </div>
        </button>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileVideo, Languages, Settings2, Sparkles, Wand2, UploadCloud, ChevronRight, Brain } from "lucide-react";
import { getJob, uploadVideo, type JobPoll } from "./api";
import { TARGET_LANGUAGES } from "./langs";
import TimelineEditor from "./TimelineEditor";

function statusLabel(s: JobPoll["status"]): string {
  switch (s) {
    case "pending":
      return "Sırada";
    case "processing":
      return "İşleniyor";
    case "needs_review":
      return "Düzenleme Bekliyor";
    case "completed":
      return "Tamamlandı";
    case "failed":
      return "Hata";
    default:
      return s;
  }
}

export default function App() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(["tr", "en"]));
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<JobPoll | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [wordLevel, setWordLevel] = useState(true); // Varsayılan olarak Kelime Kelime aktif
  const [editorMode, setEditorMode] = useState(true);
  const [smartMode, setSmartMode] = useState(false);
  const [font, setFont] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{
    loaded: number;
    total: number;
    percent: number;
    startTime: number;
  } | null>(null);

  const toggleLang = (code: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  };

  const runUpload = useCallback(
    async (file: File) => {
      setErr(null);
      setBusy(true);
      setJob(null);
      setUploadProgress({ loaded: 0, total: file.size, percent: 0, startTime: Date.now() });

      try {
        const targets = Array.from(selected);
        const { job_id } = await uploadVideo(
          file,
          targets,
          wordLevel,
          editorMode || smartMode,
          font,
          (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress((prev) => ({
                ...prev!,
                loaded: event.loaded,
                percent,
              }));
            }
          },
          smartMode
        );
        const j = await getJob(job_id);
        setJob(j);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Yükleme başarısız");
      } finally {
        setBusy(false);
        setUploadProgress(null);
      }
    },
    [selected, wordLevel, editorMode, smartMode, font]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files[0];
      if (f) void runUpload(f);
    },
    [runUpload]
  );

  useEffect(() => {
    if (!job || (job.status !== "pending" && job.status !== "processing")) return;
    const t = window.setInterval(async () => {
      try {
        const j = await getJob(job.job_id);
        setJob(j);
      } catch {
        /* ignore */
      }
    }, 1500);
    return () => window.clearInterval(t);
  }, [job?.job_id, job?.status]);

  const langsSorted = useMemo(
    () => [...TARGET_LANGUAGES].sort((a, b) => a.label.localeCompare(b.label, "tr")),
    []
  );

  return (
    <div className="gradient-bg min-h-screen relative overflow-hidden text-slate-200 font-sans">
      {/* Animated Background Blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob pointer-events-none"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob animation-delay-2000 pointer-events-none"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob animation-delay-4000 pointer-events-none"></div>

      <header className="sticky top-0 z-50 border-b border-white/5 bg-surface-950/60 backdrop-blur-xl supports-[backdrop-filter]:bg-surface-950/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-indigo-600 shadow-glow overflow-hidden">
              <div className="absolute inset-0 bg-white/20 mix-blend-overlay"></div>
              <Wand2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Altyazı Studio
                <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20">
                  Beta
                </span>
              </h1>
              <p className="text-sm text-slate-400 font-medium">
                Yapay Zeka Destekli Çok Dilli Altyazı Oluşturucu
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 relative z-10">
        <div className="animate-fade-in-up">
          <section className="mb-8 rounded-3xl glass-panel p-8 transition-all hover:bg-surface-850/60">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                <Languages className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-white">Çeviri Dilleri</h2>
                <p className="text-sm text-slate-400">
                  İstediğiniz dilleri seçin. Kaynak dil otomatik algılanır.
                </p>
              </div>
            </div>
            
            <div className="mt-4 flex max-h-52 flex-wrap gap-2.5 overflow-y-auto pr-1 custom-scrollbar">
              {langsSorted.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleLang(code)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    selected.has(code)
                      ? "border-accent/50 bg-accent/10 text-accent shadow-[0_0_15px_rgba(34,211,238,0.15)] scale-[1.02]"
                      : "border-white/5 bg-surface-900/50 text-slate-300 hover:bg-surface-800 hover:border-white/10"
                  }`}
                >
                  {label}
                  {selected.has(code) && <Sparkles className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <section className="mb-10 rounded-3xl glass-panel p-8 transition-all hover:bg-surface-850/60">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-white">Stil ve Ayarlar</h2>
                <p className="text-sm text-slate-400">
                  Videonuzun görünümünü özelleştirin
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div className="space-y-6">
                <div>
                  <label className="mb-3 block text-sm font-medium text-slate-300">Gösterim Modu</label>
                  <div className="flex rounded-xl bg-surface-950/50 p-1.5 ring-1 ring-white/5">
                    <button
                      type="button"
                      onClick={() => setWordLevel(false)}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${!wordLevel ? "bg-surface-800 text-white shadow-sm ring-1 ring-white/10" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Cümle Cümle
                    </button>
                    <button
                      type="button"
                      onClick={() => setWordLevel(true)}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${wordLevel ? "bg-surface-800 text-white shadow-sm ring-1 ring-white/10" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Kelime Kelime
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="mb-3 block text-sm font-medium text-slate-300">İşlem Akışı</label>
                  <div className="flex rounded-xl bg-surface-950/50 p-1.5 ring-1 ring-white/5">
                    <button
                      type="button"
                      onClick={() => { setEditorMode(false); setSmartMode(false); }}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${!editorMode && !smartMode ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Hızlı Üret
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditorMode(true); setSmartMode(false); }}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${editorMode && !smartMode ? "bg-accent/20 text-accent ring-1 ring-accent/30" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      Editör
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditorMode(false); setSmartMode(true); }}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${smartMode ? "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-violet-300 ring-1 ring-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      <Brain className="w-3.5 h-3.5" />
                      AI Akıllı
                    </button>
                  </div>
                  {smartMode && (
                    <div className="mt-3 rounded-xl bg-violet-500/5 border border-violet-500/20 p-3 animate-fade-in-up">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs font-bold text-violet-300">AI Akıllı Editör Aktif</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Yapay zeka videonuzu analiz edecek, konuyu anlayacak ve otomatik olarak en uygun stili, fontları ve düzenleme önerilerini sunacak.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="mb-3 block text-sm font-medium text-slate-300">Font Seçimi</label>
                <div className="relative">
                  <select
                    value={font}
                    onChange={(e) => setFont(e.target.value)}
                    className="w-full appearance-none rounded-xl bg-surface-950/50 px-5 py-3.5 text-sm font-medium text-white outline-none ring-1 ring-white/5 transition-all focus:ring-accent hover:ring-white/20"
                  >
                    <option value="">Varsayılan Font</option>
                    <option value="Arial">Arial</option>
                    <option value="Impact">Impact</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Comic Sans MS">Comic Sans MS</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <ChevronRight className="h-4 w-4 rotate-90" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {!job || job.status !== "needs_review" ? (
            <section className="glass-panel rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                  <FileVideo className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-white">Video Yükle</h2>
                  <p className="text-sm text-slate-400">MP4, MKV, MOV, WEBM desteklenir</p>
                </div>
              </div>

            <label
              className={`group relative mt-4 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden ${
                drag 
                  ? "border-accent bg-accent/5 scale-[1.01]" 
                  : "border-white/10 bg-surface-900/40 hover:border-accent/40 hover:bg-surface-800/60"
              } px-8 py-20`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-950/20 pointer-events-none" />
              
              <input
                type="file"
                accept=".mp4,.mkv,.mov,.webm,.avi,.m4v,video/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void runUpload(f);
                }}
              />
              
              <div className={`relative flex items-center justify-center w-20 h-20 rounded-2xl mb-6 transition-transform duration-500 ${drag ? 'scale-110' : 'group-hover:scale-110 group-hover:-translate-y-2'}`}>
                <div className="absolute inset-0 bg-accent/20 rounded-2xl blur-xl" />
                <div className="relative flex items-center justify-center w-full h-full bg-surface-800 rounded-2xl border border-white/10 shadow-xl">
                  {busy ? (
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                      <div 
                        className="absolute inset-0 border-4 border-accent border-t-transparent rounded-full animate-spin" 
                        style={{ animationDuration: '0.6s' }}
                      />
                      {uploadProgress && (
                        <span className="text-[10px] font-bold text-accent">{uploadProgress.percent}%</span>
                      )}
                    </div>
                  ) : (
                    <UploadCloud className="w-10 h-10 text-accent" />
                  )}
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2 text-center">
                {busy ? (
                  uploadProgress ? (
                    <div className="flex flex-col items-center gap-2">
                      <span>Videonuz Yükleniyor... %{uploadProgress.percent}</span>
                      <div className="w-64 h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="h-full bg-accent transition-all duration-300 ease-out shadow-[0_0_10px_rgba(34,211,238,0.5)]" 
                          style={{ width: `${uploadProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  ) : "İşlem başlatılıyor..."
                ) : "Videonuzu buraya sürükleyin"}
              </h3>
              
              {busy && uploadProgress ? (
                <div className="mt-4 flex flex-col items-center gap-1 text-slate-400 text-sm font-medium">
                  <div className="flex items-center gap-3">
                    <span>{(uploadProgress.total / (1024 * 1024)).toFixed(1)} MB</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600" />
                    <span>
                      {(() => {
                        const elapsed = Date.now() - uploadProgress.startTime;
                        if (elapsed < 500) return "Hesaplanıyor...";
                        const speed = uploadProgress.loaded / elapsed; // bytes per ms
                        if (speed === 0) return "Bağlanıyor...";
                        const remaining = (uploadProgress.total - uploadProgress.loaded) / speed;
                        const seconds = Math.round(remaining / 1000);
                        return seconds > 60 
                          ? `${Math.floor(seconds / 60)} dk ${seconds % 60} sn kaldı`
                          : `${seconds} sn kaldı`;
                      })()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 italic">
                    Yükleme hızı: {((uploadProgress.loaded / (Date.now() - uploadProgress.startTime)) * 1000 / (1024 * 1024)).toFixed(1)} MB/sn
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-slate-400 text-center font-medium">
                    veya gözatmak için <span className="text-accent group-hover:underline">tıklayın</span>
                  </p>
                  <p className="mt-4 text-xs text-slate-500 max-w-xs text-center">
                    Maksimum dosya boyutu 500MB. Yükleme süresi internet hızınıza bağlıdır.
                  </p>
                </>
              )}
            </label>
          </section>
          ) : (
            <div className="animate-fade-in-up">
              <TimelineEditor 
                jobId={job.job_id} 
                transcriptionData={job.transcription_data || "[]"}
                aiAnalysisData={job.ai_analysis || null}
                targets={Array.from(selected)} 
                font={font} 
                onRenderStared={() => {
                   getJob(job.job_id).then(setJob);
                }} 
              />
            </div>
          )}
        </div>

        {err && (
          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-sm font-medium text-red-200 flex items-center gap-3 animate-fade-in-up">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {err}
          </div>
        )}

        {job && (
          <section className="mt-10 rounded-3xl glass-panel p-8 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <span className="rounded-xl bg-surface-950/50 px-4 py-2 font-mono text-sm text-slate-400 ring-1 ring-white/5">
                ID: {job.job_id.slice(0, 8)}…
              </span>
              <span
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm ${
                  job.status === "completed"
                    ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                    : job.status === "failed"
                      ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                      : "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                }`}
              >
                {job.status === "processing" && <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                {statusLabel(job.status)}
              </span>
              {job.source_language && (
                <span className="flex items-center gap-2 rounded-xl bg-surface-950/50 px-4 py-2 text-sm text-slate-300 ring-1 ring-white/5">
                  <Languages className="w-4 h-4 text-slate-400" />
                  <span>
                    Kaynak Dil: <strong className="text-white ml-1">{job.source_language.toUpperCase()}</strong>
                  </span>
                </span>
              )}
              
              <div className="flex-1"></div>
              
              <button
                onClick={() => {
                  setJob(null);
                  setErr(null);
                }}
                className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/20 transition-all ml-auto"
              >
                İptal Et / Yeni Video
              </button>
            </div>

            {job.error_message && (
              <div className="mt-4 rounded-2xl bg-red-500/5 p-4 border border-red-500/10">
                <p className="whitespace-pre-wrap text-sm text-red-300">{job.error_message}</p>
              </div>
            )}

            {job.status === "completed" && Object.keys(job.downloads).length > 0 && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {Object.entries(job.downloads).map(([key, urls]) => (
                  <div
                    key={key}
                    className="rounded-2xl border border-white/5 bg-surface-900/40 p-5 transition-all hover:bg-surface-800/40 hover:border-white/10"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center">
                        <span className="text-xs font-bold text-slate-300">
                          {key.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <p className="font-display text-base font-bold text-white">
                        {key === "original" ? "Orijinal Transkript" : key.toUpperCase()} Çıktısı
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2.5">
                      {urls.srt && (
                        <a
                          href={urls.srt}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-surface-700 focus:ring-2 focus:ring-accent/50"
                          download
                        >
                          .SRT İndir
                        </a>
                      )}
                      {urls.vtt && (
                        <a
                          href={urls.vtt}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-surface-700 focus:ring-2 focus:ring-accent/50"
                          download
                        >
                          .VTT İndir
                        </a>
                      )}
                      {urls.video && (
                        <a
                          href={urls.video}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-indigo-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-accent/20 transition-all hover:scale-[1.02] hover:shadow-accent/40 mt-1"
                          download
                        >
                          <FileVideo className="w-4 h-4" />
                          Gömülü Videoyu İndir (.MP4)
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="mt-20 border-t border-white/5 pt-8 text-center animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="inline-flex items-center gap-2 rounded-full bg-surface-900/40 px-4 py-2 text-xs font-medium text-slate-400 ring-1 ring-white/5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Yerel Whisper Modeli Aktif
          </div>
        </footer>
      </main>
    </div>
  );
}

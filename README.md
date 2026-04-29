# Altyazı Studio

Video yükleyerek otomatik **konuşma tanıma** (Whisper / faster-whisper), **çok dilli çeviri**, **SRT / VTT** ve **altyazısı videoya gömülü MP4** çıktısı üreten tam yığın uygulama.

## Özellikler

- FFmpeg ile sese dönüştürme, **faster-whisper** ile transkripsiyon (kaynak dil otomatik)
- Seçtiğiniz dillere çeviri (Google Translate üzerinden `deep-translator`)
- **original** + dil kodlarına göre dosyalar (ör. `tr.srt`, `en.vtt`, `tr.burned.mp4`)
- FastAPI + React arayüz (tek portta yayın)
- İş kuyruğu için **Celery** destekli, ama Docker/Redis yoksa **local fallback worker** ile çalışır

## Yerel geliştirme (Docker olmadan)

Önkoşullar: Python 3.11+, Node 20+, FFmpeg (`ffmpeg` PATH’te)

Windows'ta FFmpeg kurmak için en kısa yol:

```powershell
winget install -e --id Gyan.FFmpeg
```

Eğer PATH'e eklemek istemezseniz `backend/.env` dosyasına şu şekilde tam yol verebilirsiniz:

```env
FFMPEG_BIN=C:\ffmpeg\bin\ffmpeg.exe
```

### En kolay yöntem (tek komut)

```bash
./run-local.ps1
```

Ardından tarayıcıdan: **http://localhost:8000**

> Bu modda `TASK_MODE=local` ile Redis/Celery zorunlu değildir.

### Manuel başlatma

```bash
cd backend
py -3 -m pip install -r requirements.txt
copy .env.example .env
```

`.env` içinde:

```env
TASK_MODE=local
```

Frontend build:

```bash
cd frontend
npm install
npm run build
```

API başlat:

```bash
cd backend
py -3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`npm run build` çıktısı `backend/static` içine düşer; API hem `/api` hem de statik dosyaları sunar. Bu nedenle tek portla (`8000`) uygulama açılır.

Geliştirme modunda (sıcak yenileme için):

```bash
cd frontend
npm run dev
```

Bu modda Vite `5173` portunda çalışır ve `/api` isteklerini `8000`’e iletir — backend’in yine `8000`’de çalışması gerekir.

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|-----------|
| `TASK_MODE` | `local`, `celery`, `auto` (öneri: local) |
| `REDIS_URL` | `TASK_MODE=celery/auto` için broker |
| `DATABASE_URL` | SQLite önerilir |
| `WHISPER_MODEL` | `tiny`, `base`, `small`, `medium`, `large-v3` |
| `WHISPER_DEVICE` | `cpu` veya `cuda` |
| `WHISPER_COMPUTE_TYPE` | CPU için genelde `int8`, CUDA için `float16` |
| `FFMPEG_BIN` | FFmpeg komutu veya tam exe yolu |
| `CORS_ORIGINS` | Virgülle ayrılmış origin listesi |

## Notlar

- Çeviri servisi ücretsiz katmanlarda **oran sınırları**na takılabilir; bazı diller kısmen başarısız olursa iş tamamlanır ve uyarı mesajı saklanır.
- Üretim için GPU’lu worker, kalıcı nesne depolama ve PostgreSQL düşünülmelidir.
- `TASK_MODE=celery` kullanacaksanız Redis + Celery worker ayrı süreçte çalıştırılmalıdır.

## Lisans

Bu depo örnek amaçlıdır; kendi kullanımınıza göre lisanslayın.

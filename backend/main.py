from fastapi import FastAPI, File, UploadFile, HTTPException, Form, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import tempfile
import os
import asyncio
import hashlib
import json
import logging
import time
import uuid
import functools
from typing import Optional
import warnings
warnings.filterwarnings('ignore')

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Import our new services
from services.fast_whisper_service import get_fast_whisper_service  # Fast OpenAI API
from services.chord_detection import get_chord_service
from services.structure_detection import get_structure_service
from services.alignment_service import get_alignment_service
from services.audio_utils import trim_audio_to_duration, calculate_audio_hash, get_audio_duration
from services.spotify_service import get_spotify_service

app = FastAPI(
    title="Lyrics & Chord Detector API",
    description="Professional lyrics and chord detection with song structure recognition",
    version="2.0.0"
)

ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav"}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "12"))
CACHE_DIR = os.getenv("CACHE_DIR", "/tmp/lyrics_chord_detector_cache")


def _is_allowed_audio_upload(upload: UploadFile) -> bool:
    filename = upload.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext in {".mp3", ".wav"}:
        return True
    return (upload.content_type or "") in ALLOWED_AUDIO_TYPES


def _infer_title_artist_from_filename(filename: str) -> tuple[str, Optional[str]]:
    base = os.path.splitext(os.path.basename(filename or ""))[0].replace("_", " ").strip()
    if " - " in base:
        left, right = base.split(" - ", 1)
        title = left.strip() or "Unknown Song"
        artist = right.strip() or None
        return title.title(), artist.title() if artist else None
    title = base.replace("-", " ").strip() or "Unknown Song"
    return title.title(), None


logger = logging.getLogger("lyrics_chord_detector")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


def _get_request_id(request: Request) -> str:
    incoming = request.headers.get("x-request-id") or request.headers.get("x-correlation-id")
    if incoming and len(incoming) <= 64:
        return incoming
    return uuid.uuid4().hex


def _log_event(event: str, request_id: str, **data) -> None:
    payload = {"event": event, "request_id": request_id, **data}
    logger.info(json.dumps(payload, ensure_ascii=False))


_rate_limit_buckets: dict[str, list[float]] = {}


def _enforce_rate_limit(ip: str) -> None:
    now = time.time()
    window_start = now - 60.0
    bucket = _rate_limit_buckets.get(ip, [])
    bucket = [t for t in bucket if t >= window_start]
    if len(bucket) >= RATE_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    bucket.append(now)
    _rate_limit_buckets[ip] = bucket


def _cache_path_for_key(raw_key: str) -> str:
    digest = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    return os.path.join(CACHE_DIR, f"{digest}.json")


def _cache_get(raw_key: str):
    try:
        path = _cache_path_for_key(raw_key)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _cache_set(raw_key: str, value) -> None:
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        path = _cache_path_for_key(raw_key)
        tmp_path = f"{path}.{uuid.uuid4().hex}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(value, f, ensure_ascii=False)
        os.replace(tmp_path, path)
    except Exception:
        return


_jobs: dict[str, dict] = {}
_jobs_lock = asyncio.Lock()


async def _job_get(job_id: str) -> Optional[dict]:
    async with _jobs_lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


async def _job_set(job_id: str, job: dict) -> None:
    async with _jobs_lock:
        _jobs[job_id] = job


async def _job_patch(job_id: str, **fields) -> None:
    async with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].update(fields)


async def _run_pipeline(
    *,
    request_id: str,
    audio_path: str,
    title: str,
    artist: Optional[str],
    language: Optional[str],
    vocal_heavy: bool,
    job_id: Optional[str] = None,
):
    audio_hash = calculate_audio_hash(audio_path)

    last_step = "starting"
    last_progress = 0
    last_sent_at = 0.0

    def update(step: str, progress: int) -> None:
        nonlocal last_step, last_progress, last_sent_at
        p = int(progress)
        if p < last_progress:
            p = last_progress
        if p > 100:
            p = 100
        now = time.time()
        if step == last_step and p == last_progress and (now - last_sent_at) < 0.6:
            return
        last_step = step
        last_progress = p
        last_sent_at = now
        if job_id:
            asyncio.create_task(_job_patch(job_id, step=step, progress=p, updatedAt=now))
        _log_event("job_progress", request_id, job_id=job_id, step=step, progress=p)

    update("transcribing", 10)
    if whisper_service is None:
        transcription = {
            "text": "",
            "language": language or "unknown",
            "segments": [],
            "words": [],
            "warnings": ["Transcription is disabled (missing OPENAI_API_KEY)."],
        }
    else:
        transcription_key = f"transcription:{audio_hash}:{getattr(whisper_service, 'model', 'unknown')}:{language or 'auto'}:{int(bool(vocal_heavy))}"
        transcription = _cache_get(transcription_key)
        if transcription is None:
            update("transcribing", 20)
            transcribe_fn = functools.partial(
                whisper_service.transcribe,
                audio_path,
                language=language,
                vocal_heavy=vocal_heavy,
            )
            transcription = await asyncio.to_thread(transcribe_fn)
            _cache_set(transcription_key, transcription)
    update("transcribing", 35)

    warnings_list = list((transcription or {}).get("warnings", []))

    update("detecting_chords", 40)
    chords_key = f"chords:{audio_hash}:{chord_service.get_model_version()}"
    chords = _cache_get(chords_key)
    if chords is None:
        chords = await chord_service.detect_chords(audio_path, progress_cb=update, vocal_heavy=bool(vocal_heavy))
        _cache_set(chords_key, chords)
    update("detecting_chords", 75)

    update("detecting_key", 78)
    key_key = f"key:{audio_hash}"
    detected_key = _cache_get(key_key)
    if detected_key is None:
        detected_key = await asyncio.to_thread(chord_service.detect_key, audio_path)
        _cache_set(key_key, detected_key)
    update("detecting_key", 82)

    update("detecting_structure", 84)
    structure_key = f"structure:{audio_hash}:{language or 'auto'}:{chord_service.get_model_version()}"
    structure = _cache_get(structure_key)
    if structure is None:
        structure = await asyncio.to_thread(structure_service.detect_structure, audio_path, transcription["segments"], chords)
        _cache_set(structure_key, structure)
    update("detecting_structure", 88)

    if not structure:
        try:
            duration_s = float((await asyncio.to_thread(get_audio_duration, audio_path)) or 0.0)
        except Exception:
            duration_s = 0.0
        structure = [{"type": "instrumental", "start": 0.0, "end": round(duration_s, 2), "segments": []}]

    update("aligning", 90)
    if transcription.get("segments"):
        aligned_key = f"aligned:{audio_hash}:{language or 'auto'}:{chord_service.get_model_version()}"
        aligned_chords = _cache_get(aligned_key)
        if aligned_chords is None:
            aligned_chords = await asyncio.to_thread(alignment_service.align_chords_with_lyrics, transcription["segments"], chords)
            _cache_set(aligned_key, aligned_chords)
    else:
        aligned_chords = [{"chord": c.get("chord"), "time": c.get("time"), "confidence": c.get("confidence")} for c in chords]
    update("aligning", 94)

    update("formatting", 96)
    formatted_key = f"formatted:{audio_hash}:{language or 'auto'}:{chord_service.get_model_version()}:{getattr(alignment_service, '__class__', type('x', (), {})).__name__}"
    formatted_output = _cache_get(formatted_key)
    if formatted_output is None:
        formatted_output = await asyncio.to_thread(
            alignment_service.format_ultimate_guitar_style,
            structure,
            aligned_chords,
            title,
            artist,
            detected_key,
        )
        _cache_set(formatted_key, formatted_output)

    update("formatting", 100)
    return {
        "success": True,
        "audio_hash": audio_hash,
        "text": transcription["text"],
        "language": transcription["language"],
        "segments": transcription["segments"],
        "words": transcription.get("words", []),
        "warnings": warnings_list,
        "chords": chords,
        "structure": structure,
        "aligned_chords": aligned_chords,
        "formatted_output": formatted_output,
        "title": title,
        "artist": artist,
        "key": detected_key,
    }


def _parse_allowed_origins() -> tuple[list[str], bool]:
    raw = os.getenv("ALLOWED_ORIGINS", "*").strip()
    if raw in {"", "*"}:
        return ["*"], False

    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins, True


async def _save_upload_to_tempfile(upload: UploadFile) -> tuple[str, int]:
    suffix = ""
    if upload.filename:
        suffix = os.path.splitext(upload.filename)[1]

    total = 0
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_FILE_SIZE_BYTES:
                temp_path = temp_file.name
                temp_file.close()
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                raise HTTPException(
                    status_code=400,
                    detail=f"File too large. Maximum size is {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB",
                )
            temp_file.write(chunk)

        return temp_file.name, total


allowed_origins, allow_credentials = _parse_allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create API router with /api prefix
api_router = APIRouter(prefix="/api")

# Initialize services at startup
print("=" * 60)
print("🎵 Lyrics & Chord Detector API v2.0 (Fast)")
print("=" * 60)

# Load services - using OpenAI API for speed
try:
    whisper_service = get_fast_whisper_service()
except Exception as e:
    whisper_service = None
    print(f"⚠️ OpenAI Whisper disabled: {e}")
chord_service = get_chord_service()
structure_service = get_structure_service()
alignment_service = get_alignment_service()


print("✅ All services loaded successfully!")
print("=" * 60)


@api_router.get("/")
async def root():
    """API root endpoint."""
    return {
        "message": "Lyrics & Chord Detector API v2.0",
        "status": "running",
        "features": [
            "Multi-language support (CS, SK, EN, auto-detect)",
            "Word-level timestamps",
            "Advanced chord detection (7th, sus, dim, aug)",
            "Song structure detection (Intro, Verse, Chorus, etc.)",
            "Ultimate Guitar style formatting"
        ]
    }


@api_router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "whisper_model": getattr(whisper_service, "model", None) or getattr(whisper_service, "model_size", None),
        "whisper_enabled": whisper_service is not None,
        "chord_detection": chord_service.get_model_version(),
        "chord_detection_enabled": chord_service.is_configured(),
        "version": "2.0.0"
    }


@api_router.post("/jobs")
async def create_job(
    request: Request,
    file: Optional[UploadFile] = File(None),
    spotify_url: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    vocal_heavy: bool = Form(False),
):
    request_id = _get_request_id(request)
    ip = (request.client.host if request.client else "unknown")
    _enforce_rate_limit(ip)

    if (file is None and not spotify_url) or (file is not None and spotify_url):
        raise HTTPException(status_code=400, detail="Provide either file or spotify_url")

    upload_temp_path = None
    upload_filename = None
    if file is not None:
        upload_filename = file.filename
        if not _is_allowed_audio_upload(file):
            raise HTTPException(status_code=400, detail="Invalid file type. Only MP3 and WAV files are supported.")
        upload_temp_path, _file_size = await _save_upload_to_tempfile(file)

    job_id = str(uuid.uuid4())
    created_at = time.time()

    job = {
        "id": job_id,
        "status": "queued",
        "progress": 0,
        "step": "queued",
        "createdAt": created_at,
        "updatedAt": created_at,
        "error": None,
        "result": None,
        "meta": {
            "language": language,
            "vocal_heavy": bool(vocal_heavy),
            "source": "spotify" if spotify_url else "upload",
        },
    }
    await _job_set(job_id, job)

    async def run_job():
        try:
            await _job_patch(job_id, status="running", step="starting", progress=1, updatedAt=time.time())
            if spotify_url:
                spotify_service = get_spotify_service()
                track_title = None
                track_artist = None
                try:
                    track_title, track_artist = spotify_service.get_track_info(spotify_url)
                except Exception:
                    track_title, track_artist = None, None
                audio_path = await asyncio.to_thread(spotify_service.download_from_url, spotify_url)
                try:
                    if track_title:
                        title = track_title
                        artist = track_artist
                    else:
                        title, artist = _infer_title_artist_from_filename(audio_path)
                    result = await _run_pipeline(
                        request_id=request_id,
                        audio_path=audio_path,
                        title=title,
                        artist=artist,
                        language=language,
                        vocal_heavy=bool(vocal_heavy),
                        job_id=job_id,
                    )
                    result["filename"] = os.path.basename(audio_path)
                    await _job_patch(job_id, status="succeeded", progress=100, step="formatting", result=result, updatedAt=time.time())
                finally:
                    if os.path.exists(audio_path):
                        os.unlink(audio_path)
            else:
                try:
                    if not upload_temp_path:
                        raise HTTPException(status_code=400, detail="Missing upload")
                    title, artist = _infer_title_artist_from_filename(upload_filename or "Unknown Song")
                    result = await _run_pipeline(
                        request_id=request_id,
                        audio_path=upload_temp_path,
                        title=title,
                        artist=artist,
                        language=language,
                        vocal_heavy=bool(vocal_heavy),
                        job_id=job_id,
                    )
                    result["filename"] = upload_filename
                    await _job_patch(job_id, status="succeeded", progress=100, step="formatting", result=result, updatedAt=time.time())
                finally:
                    if upload_temp_path and os.path.exists(upload_temp_path):
                        os.unlink(upload_temp_path)
        except HTTPException as e:
            await _job_patch(job_id, status="failed", step="failed", error=e.detail, updatedAt=time.time())
        except Exception as e:
            await _job_patch(job_id, status="failed", step="failed", error=str(e), updatedAt=time.time())

    if file is not None and not upload_temp_path:
        raise HTTPException(status_code=400, detail="Failed to persist upload")

    asyncio.create_task(run_job())
    _log_event("job_created", request_id, job_id=job_id, source=job["meta"]["source"])
    return JSONResponse(content={"success": True, "job_id": job_id})


@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = await _job_get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.pop("result", None)
    return JSONResponse(content={"success": True, "job": job})


@api_router.get("/jobs/{job_id}/result")
async def get_job_result(job_id: str):
    job = await _job_get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("status") != "succeeded":
        raise HTTPException(status_code=409, detail="Job not finished")
    return JSONResponse(content=job.get("result") or {})

# ... existing API routes ...

# Frontend mounting moved to end of file





@api_router.post("/process-audio")
async def process_audio(
    request: Request,
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    vocal_heavy: bool = Form(False),
):
    """
    Process audio file - transcribe lyrics and detect chords.
    
    Args:
        file: Audio file (MP3/WAV)
        language: Language code ("en", "cs", "sk", etc.) or None for auto-detect
    
    Returns:
        JSON with:
        - text: Full transcribed text
        - language: Detected/specified language
        - segments: Segments with word-level timestamps
        - chords: Detected chords
        - structure: Song structure (Intro, Verse, Chorus, etc.)
        - aligned_chords: Chords aligned with specific words
        - formatted_output: Ultimate Guitar style text
    """
    request_id = _get_request_id(request)
    ip = (request.client.host if request.client else "unknown")
    _enforce_rate_limit(ip)

    # Validate file type
    if not _is_allowed_audio_upload(file):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only MP3 and WAV files are supported."
        )

    temp_path, file_size = await _save_upload_to_tempfile(file)
    
    try:
        print(f"\n{'='*60}")
        print(f"Processing: {file.filename}")
        print(f"Size: {file_size / 1024 / 1024:.2f}MB")
        print(f"Language: {language or 'auto-detect'}")
        print(f"{'='*60}\n")
        
        title, artist = _infer_title_artist_from_filename(file.filename)
        result = await _run_pipeline(
            request_id=request_id,
            audio_path=temp_path,
            title=title,
            artist=artist,
            language=language,
            vocal_heavy=bool(vocal_heavy),
            job_id=None,
        )
        result["filename"] = file.filename
        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as e:
        print(f"\n❌ Error processing file: {str(e)}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=500,
            detail=f"Processing error: {str(e)}"
        )
    
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@api_router.post("/download-spotify")
async def download_spotify(
    request: Request,
    spotify_url: str = Form(...),
    language: Optional[str] = Form(None),
    vocal_heavy: bool = Form(False),
):
    """
    Download song from Spotify URL and process it.
    
    Args:
        spotify_url: Spotify track URL
    
    Returns:
        JSON with processing results
    """
    request_id = _get_request_id(request)
    ip = (request.client.host if request.client else "unknown")
    _enforce_rate_limit(ip)

    try:
        print(f"\n{'='*60}")
        print(f"📥 Downloading from Spotify: {spotify_url}")
        print(f"{'='*60}\n")
        
        # Download from Spotify
        spotify_service = get_spotify_service()
        track_title = None
        track_artist = None
        try:
            track_title, track_artist = spotify_service.get_track_info(spotify_url)
        except Exception:
            track_title, track_artist = None, None
        audio_path = await asyncio.to_thread(spotify_service.download_from_url, spotify_url)
        
        try:
            if track_title:
                title = track_title
                artist = track_artist
            else:
                title, artist = _infer_title_artist_from_filename(audio_path)
            result = await _run_pipeline(
                request_id=request_id,
                audio_path=audio_path,
                title=title,
                artist=artist,
                language=language,
                vocal_heavy=bool(vocal_heavy),
                job_id=None,
            )
            
            print(f"\n✅ Processing complete!")
            print(f"{'='*60}\n")
            
            result["filename"] = os.path.basename(audio_path)
            return JSONResponse(content=result)
        
        finally:
            # Clean up downloaded file
            if os.path.exists(audio_path):
                os.unlink(audio_path)
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n❌ Error downloading/processing Spotify URL: {str(e)}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=500,
            detail=f"Spotify download error: {str(e)}"
        )


@api_router.post("/detect-language")
async def detect_language(file: UploadFile = File(...)):
    """
    Detect the language of an audio file.
    
    Args:
        file: Audio file (MP3/WAV)
    
    Returns:
        Detected language code
    """
    if not _is_allowed_audio_upload(file):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only MP3 and WAV files are supported.",
        )

    temp_path, _file_size = await _save_upload_to_tempfile(file)
    
    try:
        if whisper_service is None:
            raise HTTPException(status_code=503, detail="Language detection is not configured (missing OPENAI_API_KEY)")
        language = whisper_service.detect_language(temp_path)
        
        return JSONResponse(content={
            "success": True,
            "language": language,
            "filename": file.filename
        })
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Language detection error: {str(e)}"
        )
    
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


# Include API router
app.include_router(api_router)

# Serve frontend static files (for Railway deployment)
frontend_dist_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
print(f"\n{'='*20} DEBUG: FILESYSTEM CHECK {'='*20}")
print(f"Current Working Directory: {os.getcwd()}")
print(f"Backend Main File Path: {__file__}")
print(f"Expected Frontend Dist Path: {frontend_dist_path}")

try:
    parent_dir = os.path.join(os.path.dirname(__file__), "..")
    print(f"Listing contents of parent dir ({parent_dir}):")
    print(os.listdir(parent_dir))
    
    frontend_dir = os.path.join(parent_dir, "frontend")
    if os.path.exists(frontend_dir):
        print(f"Listing contents of frontend dir ({frontend_dir}):")
        print(os.listdir(frontend_dir))
    else:
        print("❌ Frontend dir does not exist!")
except Exception as e:
    print(f"Error checking filesystem: {e}")
print(f"{'='*60}\n")

if os.path.exists(frontend_dist_path):
    print(f"✅ Frontend found! Serving static files from {frontend_dist_path}")

    # Mount static assets (JS, CSS, images, etc.)
    assets_path = os.path.join(frontend_dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/")
    async def serve_root():
        """Serve index.html at root."""
        index_path = os.path.join(frontend_dist_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Index not found")

    # Serve index.html for root and all other routes (SPA support)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend for all non-API routes."""
        # If requesting a static file that exists, serve it
        file_path = os.path.join(frontend_dist_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)

        # Otherwise, serve index.html (for SPA routing)
        index_path = os.path.join(frontend_dist_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)

        raise HTTPException(status_code=404, detail="Frontend not found")
else:
    print(f"⚠️ Frontend dist not found at: {frontend_dist_path}")
    print("   Frontend will not be served. API-only mode.")

print("=" * 60)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

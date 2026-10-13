"""Persistent, single-worker cloud stem workbench. No paid model APIs."""
import asyncio
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import signal
import shutil
import sqlite3
import subprocess
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

DATA = Path(os.getenv("DATA_DIR", "/data"))
DATA.mkdir(parents=True, exist_ok=True)
PASSWORD = os.getenv("STUDIO_PASSWORD", "")
MAX_BYTES = 80 * 1024 * 1024


def db():
    conn = sqlite3.connect(DATA / "library.sqlite", timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def update(job_id, **fields):
    fields["updated"] = time.time()
    with db() as conn:
        conn.execute("UPDATE songs SET " + ",".join(f"{k}=?" for k in fields) + " WHERE id=?", [*fields.values(), job_id])


def song(job_id):
    with db() as conn:
        row = conn.execute("SELECT * FROM songs WHERE id=?", (job_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Skladba neexistuje.")
    value = dict(row)
    value["result"] = json.loads(value["result"]) if value["result"] else None
    return value


def token():
    return hmac.new(PASSWORD.encode(), b"stem-studio-session-v1", hashlib.sha256).hexdigest()


def authorized(request):
    return bool(PASSWORD) and secrets.compare_digest(request.cookies.get("studio_session", ""), token())


async def worker():
    while True:
        with db() as conn:
            row = conn.execute("SELECT id FROM songs WHERE status='queued' ORDER BY created LIMIT 1").fetchone()
        if not row:
            await asyncio.sleep(2)
            continue
        job_id = row["id"]
        update(job_id, status="running", step="separating", error=None)
        folder = DATA / job_id
        try:
            with (folder / "processing.log").open("w") as log:
                process = await asyncio.create_subprocess_exec(sys.executable, str(Path(__file__).with_name("studio_pipeline.py")), str(folder), stdout=log, stderr=log, start_new_session=True)
                try:
                    await asyncio.wait_for(process.wait(), timeout=3600)
                except (asyncio.TimeoutError, asyncio.CancelledError):
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    await process.wait()
                    raise
            if process.returncode:
                diagnostic = (folder / "processing.log").read_text(errors="replace")[-8000:]
                if "Sign in to confirm" in diagnostic or "HTTP Error 403" in diagnostic:
                    raise RuntimeError("Zdroj blokuje stažení z cloudu. Zkuste jiný výsledek, SoundCloud nebo nahrajte audio soubor.")
                raise RuntimeError("Zpracování selhalo. Záznam je uložený na serveru; skladbu lze zkusit znovu.")
            result = json.loads((folder / "result.json").read_text())
            fields = dict(status="ready", step="ready", result=json.dumps(result, ensure_ascii=False))
            if result.get("title"):
                fields["title"] = result["title"][:180]
            update(job_id, **fields)
        except asyncio.CancelledError:
            update(job_id, status="queued", step="queued")
            raise
        except Exception as exc:
            update(job_id, status="failed", step="failed", error=str(exc))


@asynccontextmanager
async def lifespan(app):
    with db() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS songs (id TEXT PRIMARY KEY,title TEXT,status TEXT,step TEXT,created REAL,updated REAL,error TEXT,result TEXT)")
        conn.execute("UPDATE songs SET status='queued',step='queued' WHERE status='running'")
    task = asyncio.create_task(worker())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Stem Studio", lifespan=lifespan)


@app.middleware("http")
async def protect(request, call_next):
    path = request.url.path
    if path.startswith("/api/") and path not in {"/api/health", "/api/session"}:
        if not authorized(request):
            return JSONResponse({"detail": "Přihlaste se heslem."}, status_code=401)
    # Reject cross-site mutations while allowing our frontend reverse proxy.
    if request.method not in {"GET", "HEAD", "OPTIONS"} and request.headers.get("sec-fetch-site") == "cross-site":
        return JSONResponse({"detail": "Nepovolený původ požadavku."}, status_code=403)
    response = await call_next(request)
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "private, no-store"
    return response


@app.get("/api/health")
def health():
    return {"status": "healthy", "version": "3.0", "engine": "cpu", "configured": bool(PASSWORD)}


@app.get("/api/session")
def session(request: Request):
    return {"authenticated": authorized(request)}


_attempts = {}


@app.post("/api/session")
async def login(request: Request):
    ip = request.client.host
    now = time.time()
    recent = [t for t in _attempts.get(ip, []) if t > now - 60]
    if len(recent) >= 10:
        raise HTTPException(429, "Zkuste přihlášení za minutu.")
    _attempts[ip] = recent + [now]
    body = await request.json()
    if not PASSWORD or not secrets.compare_digest(str(body.get("password", "")).encode(), PASSWORD.encode()):
        raise HTTPException(401, "Nesprávné heslo.")
    response = JSONResponse({"authenticated": True})
    response.set_cookie("studio_session", token(), httponly=True, secure=os.getenv("COOKIE_SECURE", "1") == "1", samesite="lax", max_age=30 * 86400)
    return response


@app.delete("/api/session")
def logout():
    response = JSONResponse({"authenticated": False})
    response.delete_cookie("studio_session")
    return response


@app.get("/api/songs")
def songs():
    with db() as conn:
        rows = conn.execute("SELECT id,title,status,step,created,error FROM songs ORDER BY created DESC").fetchall()
    return [dict(row) for row in rows]


_search_cache = {}
_search_lock = asyncio.Lock()


@app.get("/api/search")
async def search(q: str = Query(min_length=2, max_length=120), source: str = "youtube"):
    if len(q.strip()) < 2:
        raise HTTPException(400, "Zadejte alespoň dva znaky.")
    if source not in {"youtube", "soundcloud"}:
        raise HTTPException(400, "Vyberte YouTube nebo SoundCloud.")
    key = (source, q.strip().casefold())
    cached = _search_cache.get(key)
    if cached and time.time() - cached[0] < 300:
        return cached[1]
    if _search_lock.locked():
        raise HTTPException(429, "Hledání už probíhá. Zkuste to za chvíli.")
    async with _search_lock:
        prefix = "ytsearch6" if source == "youtube" else "scsearch6"
        process = await asyncio.create_subprocess_exec(sys.executable, "-m", "yt_dlp", f"{prefix}:{q.strip()}", "--flat-playlist", "--dump-single-json", "--skip-download", "--quiet", "--socket-timeout", "10", "--retries", "1", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, start_new_session=True)
        try:
            stdout, _ = await asyncio.wait_for(process.communicate(), timeout=40)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            await process.wait()
            raise HTTPException(504, "Zdroj neodpověděl včas. Zkuste odkaz nebo soubor.")
        if process.returncode:
            raise HTTPException(502, "Zdroj momentálně hledání z cloudu odmítá. Zkuste odkaz nebo soubor.")
        try:
            entries = json.loads(stdout).get("entries", [])
            items = []
            for entry in entries:
                if not entry:
                    continue
                url = entry.get("webpage_url") or entry.get("url", "")
                if not url.startswith("https://"):
                    continue
                duration = entry.get("duration")
                thumbnails = entry.get("thumbnails") or []
                items.append({"title": entry.get("title", "Skladba"), "artist": entry.get("uploader") or entry.get("channel") or "", "url": url, "duration": duration, "thumbnail": entry.get("thumbnail") or (thumbnails[-1].get("url") if thumbnails else None), "importable": not duration or 0 < duration <= 600})
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(502, "Výsledky zdroje se nepodařilo načíst.")
        result = {"source": source, "items": items}
        if len(_search_cache) >= 50:
            _search_cache.clear()
        _search_cache[key] = (time.time(), result)
        return result


@app.get("/api/songs/{job_id}")
def get_song(job_id: str):
    value = song(job_id)
    step_file = DATA / job_id / "step.json"
    if value["status"] == "running" and step_file.exists():
        try:
            value["step"] = json.loads(step_file.read_text())["step"]
        except (ValueError, OSError):
            pass
    return value


@app.post("/api/songs", status_code=202)
async def upload(file: UploadFile | None = File(None), url: str = Form(""), language: str = Form("auto"), lyrics: str = Form(""), title: str = Form("")):
    if language not in {"auto", "cs", "sk", "en", "de", "fr", "es"}:
        raise HTTPException(400, "Nepodporovaný jazyk.")
    if len(lyrics) > 20000:
        raise HTTPException(400, "Text je příliš dlouhý.")
    if bool(file) == bool(url.strip()):
        raise HTTPException(400, "Vyberte soubor nebo vložte jeden odkaz.")
    suffix = Path(file.filename or "").suffix.lower() if file else ""
    if file and suffix not in {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".mp4"}:
        raise HTTPException(400, "Nahrajte MP3, WAV, M4A, FLAC, OGG nebo MP4.")
    if url:
        from urllib.parse import urlparse
        try:
            parsed = urlparse(url.strip())
            valid = parsed.scheme == "https" and parsed.hostname in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "soundcloud.com", "www.soundcloud.com"} and not parsed.username and not parsed.password and parsed.port in {None, 443}
        except ValueError:
            valid = False
        if not valid:
            raise HTTPException(400, "Podporujeme HTTPS odkazy YouTube a SoundCloud. Spotify neposkytuje zdrojové audio.")
    with db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM songs WHERE status IN ('queued','running')").fetchone()[0]
    if count >= 3:
        raise HTTPException(429, "Fronta je plná. Počkejte na dokončení skladby.")
    if sum(p.stat().st_size for p in DATA.rglob("*") if p.is_file()) > 4 * 1024**3:
        raise HTTPException(413, "Knihovna je plná. Odstraňte některé skladby.")
    job_id = secrets.token_hex(16)
    folder = DATA / job_id
    folder.mkdir()
    total = 0
    try:
        if url:
            (folder / "input.json").write_text(json.dumps({"url": url.strip(), "language": language, "lyrics": lyrics}))
            now = time.time()
            with db() as conn:
                conn.execute("INSERT INTO songs VALUES (?,?,?,?,?,?,?,?)", (job_id, title.strip()[:180] or "Skladba z odkazu", "queued", "queued", now, now, None, None))
            return {"id": job_id}
        source = folder / ("upload" + suffix)
        with source.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_BYTES:
                    raise HTTPException(413, "Maximum je 80 MB.")
                output.write(chunk)
        if total == 0:
            raise HTTPException(400, "Soubor je prázdný.")
        probe = await asyncio.to_thread(subprocess.run, ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(source)], capture_output=True, text=True, timeout=30)
        duration = float(json.loads(probe.stdout).get("format", {}).get("duration", 0))
        if not 0 < duration <= 600:
            raise HTTPException(400, "Skladba musí mít nejvýše 10 minut.")
        (folder / "input.json").write_text(json.dumps({"source": source.name, "language": language, "lyrics": lyrics, "duration": duration}))
        now = time.time()
        with db() as conn:
            conn.execute("INSERT INTO songs VALUES (?,?,?,?,?,?,?,?)", (job_id, Path(file.filename).stem[:180], "queued", "queued", now, now, None, None))
    except HTTPException:
        shutil.rmtree(folder)
        raise
    except Exception:
        shutil.rmtree(folder)
        raise HTTPException(400, "Soubor se nepodařilo přečíst jako audio.")
    return {"id": job_id}


@app.post("/api/songs/{job_id}/retry")
def retry(job_id: str):
    value = song(job_id)
    if value["status"] != "failed":
        raise HTTPException(409, "Znovu lze spustit pouze neúspěšnou skladbu.")
    update(job_id, status="queued", step="queued", error=None)
    return {"id": job_id}


@app.delete("/api/songs/{job_id}")
def delete(job_id: str):
    value = song(job_id)
    if value["status"] in {"running", "queued"}:
        raise HTTPException(409, "Počkejte na dokončení zpracování.")
    shutil.rmtree(DATA / job_id, ignore_errors=True)
    with db() as conn:
        conn.execute("DELETE FROM songs WHERE id=?", (job_id,))
    return {"deleted": True}


@app.get("/api/songs/{job_id}/audio/{name}")
def audio(job_id: str, name: str):
    song(job_id)
    if name not in {"original", "vocals", "drums", "bass", "guitar", "piano", "other"}:
        raise HTTPException(404)
    path = DATA / job_id / "audio" / f"{name}.mp3"
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="audio/mpeg")


DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="studio")

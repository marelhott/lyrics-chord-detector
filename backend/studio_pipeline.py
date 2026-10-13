"""One job per process: memory is released when analysis ends."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def atomic_json(path, value):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False))
    tmp.replace(path)


def main(folder):
    inputs = json.loads((folder / "input.json").read_text())
    if (folder / "result.json").exists():
        return
    checkpoint = folder / "partial.json"
    result = json.loads(checkpoint.read_text()) if checkpoint.exists() else None
    timings = result.get("timings", {}) if result else {}
    started = time.monotonic()
    current_stage = None
    stage_started = started
    def stage(value):
        nonlocal current_stage, stage_started
        now = time.monotonic()
        if current_stage:
            timings[current_stage] = round(timings.get(current_stage, 0) + now - stage_started, 3)
            print(json.dumps({"stage": current_stage, "seconds": timings[current_stage]}), flush=True)
        current_stage, stage_started = value, now
        atomic_json(folder / "step.json", {"step": value, "started": time.time(), "timings": timings})
    def ffmpeg(source, target):
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k", str(target)], check=True)
    output = folder / "audio"
    output.mkdir(exist_ok=True)
    if not result and inputs.get("url") and not (folder / inputs.get("source", "missing")).is_file():
        stage("downloading")
        import yt_dlp
        options = {"format": "bestaudio/best", "noplaylist": True, "js_runtimes": {"node": {}}, "outtmpl": str(folder / "download.%(ext)s"), "max_filesize": 80 * 1024 * 1024, "socket_timeout": 20, "retries": 2, "match_filter": yt_dlp.utils.match_filter_func("duration <= 600 & !is_live"), "quiet": True}
        with yt_dlp.YoutubeDL(options) as downloader:
            info = downloader.extract_info(inputs["url"], download=True)
        if not info or info.get("_type") in {"playlist", "multi_video"}:
            raise RuntimeError("Odkaz se nepodařilo získat jako jednu skladbu.")
        source = next((p for p in folder.glob("download.*") if p.suffix not in {".part", ".ytdl"}), None)
        if not source or source.stat().st_size > 80 * 1024 * 1024:
            raise RuntimeError("Audio není dostupné nebo přesahuje 80 MB.")
        probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(source)], capture_output=True, text=True, check=True)
        duration = float(json.loads(probe.stdout)["format"]["duration"])
        if not 0 < duration <= 600:
            raise RuntimeError("Skladba musí mít nejvýše 10 minut.")
        inputs.update(source=source.name, duration=duration, title=info.get("title", "Skladba z odkazu"))
        atomic_json(folder / "input.json", inputs)
    names = ["vocals", "drums", "bass", "guitar", "piano", "other"]
    separated = folder / "separated" / "htdemucs_6s" / "original"
    if not result:
        stage("separating")
        # Keep a lossless input; MP3 re-encoding before inference adds avoidable artifacts.
        source_pcm = folder / "original.wav"
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(folder / inputs["source"]), "-vn", "-ar", "44100", "-ac", "2", "-c:a", "pcm_f32le", str(source_pcm)], check=True)
        ffmpeg(source_pcm, output / "original.mp3")
        env = dict(os.environ, OMP_NUM_THREADS="4", MKL_NUM_THREADS="4")
        subprocess.run([sys.executable, "-m", "demucs.separate", "-n", "htdemucs_6s", "-d", "cpu", "--shifts", "0", "--segment", "7", "--overlap", "0.25", "--float32", "--clip-mode", "none", "-j", "1", "-o", str(folder / "separated"), str(source_pcm)], check=True, env=env)
        separated = folder / "separated" / "htdemucs_6s" / "original"
        names = ["vocals", "drums", "bass", "guitar", "piano", "other"]
        import numpy as np
        waveforms = {}
        import soundfile as sf
        peak = 1.0
        for name in names:
            for chunk in sf.blocks(separated / f"{name}.wav", blocksize=65536):
                peak = max(peak, float(np.max(np.abs(chunk))))
        export_gain = min(1.0, 0.98 / peak)
        for name in names:
            decoded = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(separated / f"{name}.wav"), "-ac", "1", "-ar", "2000", "-f", "f32le", "-"], capture_output=True, check=True)
            samples = np.frombuffer(decoded.stdout, dtype=np.float32)
            peaks = np.array([np.max(np.abs(part)) if len(part) else 0 for part in np.array_split(samples, 110)])
            waveforms[name] = (peaks / max(float(peaks.max()), 1e-6)).round(3).tolist()
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(separated / f"{name}.wav"), "-af", f"volume={export_gain}", "-b:a", "256k", str(output / f"{name}.mp3")], check=True)
    warnings = ["AI stemy mohou obsahovat přeslechy; piano je u tohoto modelu slabší.", "Akordy jsou základní odhad dur/moll, nikoli ověřený přepis kytarového partu."]
    if not result:
        result = {"title": inputs.get("title"), "duration": inputs["duration"], "stems": names, "waveforms": waveforms, "chords": [], "key": "—", "language": inputs["language"], "words": [], "segments": [], "text": "", "suppliedLyrics": inputs.get("lyrics", ""), "warnings": warnings, "analysis": {"chords": "pending", "lyrics": "pending"}, "timings": timings, "exportGain": export_gain, "models": {"stems": "htdemucs_6s", "lyrics": os.getenv("WHISPER_MODEL", "small")}}
        stage("stems_ready")
        atomic_json(checkpoint, result)
    warnings = result["warnings"]
    stage("chords")
    if result["analysis"]["chords"] == "pending":
        # Analyze the accompaniment, not just guitar: a chord can be distributed across instruments.
        accompaniment = folder / "accompaniment.wav"
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(separated / "guitar.wav"), "-i", str(separated / "piano.wav"), "-i", str(separated / "bass.wav"), "-i", str(separated / "other.wav"), "-filter_complex", "amix=inputs=4:normalize=0", str(accompaniment)], check=True)
        from services.chord_detection import ChordDetectionService
        service = ChordDetectionService()
        try:
            chords = service._detect_chords_local(str(accompaniment))
            key = service.detect_key(str(accompaniment))
        except Exception:
            import traceback
            traceback.print_exc()
            chords, key = [], "Unknown"
            warnings.append("Akordy se nepodařilo vypočítat; stemy jsou dostupné.")
        result.update(chords=chords, key=key)
        result["models"]["chords"] = service.get_model_version()
        result["analysis"]["chords"] = "ready" if chords else "unavailable"
    atomic_json(checkpoint, result)
    stage("lyrics")
    if result["analysis"]["lyrics"] == "pending":
        words, segments = [], []
        try:
            from faster_whisper import WhisperModel
            model = WhisperModel(os.getenv("WHISPER_MODEL", "small"), device="cpu", compute_type="int8", cpu_threads=4, num_workers=1, download_root=os.getenv("HF_HOME", "/data/models"))
            generated, info = model.transcribe(str(separated / "vocals.wav"), language=None if inputs["language"] == "auto" else inputs["language"], word_timestamps=True, vad_filter=False, condition_on_previous_text=False, beam_size=5)
            for segment in generated:
                if segment.no_speech_prob > 0.8 or segment.avg_logprob < -1.5:
                    continue
                segments.append({"start": segment.start, "end": segment.end, "text": segment.text.strip()})
                for word in segment.words or []:
                    words.append({"start": word.start, "end": word.end, "word": word.word.strip(), "probability": word.probability})
            language = info.language
            del model
        except Exception:
            import traceback
            traceback.print_exc()
            language = inputs["language"]
            warnings.append("Přepis zpěvu se nepodařil; stemy a akordy zůstávají dostupné.")
        result.update(language=language, words=words, segments=segments, text=" ".join(s["text"] for s in segments))
        result["analysis"]["lyrics"] = "ready" if words else "unavailable"
    stage("ready")
    timings["thisRun"] = round(time.monotonic() - started, 3)
    atomic_json(folder / "result.json", result)
    # The user-facing copies are MP3; remove intermediate WAVs to bound storage.
    import shutil
    shutil.rmtree(folder / "separated", ignore_errors=True)
    (folder / "accompaniment.wav").unlink(missing_ok=True)
    (folder / "original.wav").unlink(missing_ok=True)
    (folder / inputs["source"]).unlink(missing_ok=True)


if __name__ == "__main__":
    main(Path(sys.argv[1]))

"""One job per process: memory is released when analysis ends."""
import json
import os
from pathlib import Path
import subprocess
import sys


def main(folder):
    inputs = json.loads((folder / "input.json").read_text())
    def stage(value):
        tmp = folder / "step.tmp"
        tmp.write_text(json.dumps({"step": value}))
        tmp.replace(folder / "step.json")
    def ffmpeg(source, target):
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k", str(target)], check=True)
    output = folder / "audio"
    output.mkdir(exist_ok=True)
    if inputs.get("url"):
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
    stage("separating")
    ffmpeg(folder / inputs["source"], output / "original.mp3")
    env = dict(os.environ, OMP_NUM_THREADS="4", MKL_NUM_THREADS="4")
    subprocess.run([sys.executable, "-m", "demucs.separate", "-n", "htdemucs_6s", "-d", "cpu", "--shifts", "0", "--segment", "5", "--overlap", "0.1", "-j", "1", "-o", str(folder / "separated"), str(output / "original.mp3")], check=True, env=env)
    separated = folder / "separated" / "htdemucs_6s" / "original"
    names = ["vocals", "drums", "bass", "guitar", "piano", "other"]
    import numpy as np
    waveforms = {}
    for name in names:
        decoded = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(separated / f"{name}.wav"), "-ac", "1", "-ar", "2000", "-f", "f32le", "-"], capture_output=True, check=True)
        samples = np.frombuffer(decoded.stdout, dtype=np.float32)
        peaks = np.array([np.max(np.abs(part)) if len(part) else 0 for part in np.array_split(samples, 110)])
        waveforms[name] = (peaks / max(float(peaks.max()), 1e-6)).round(3).tolist()
        ffmpeg(separated / f"{name}.wav", output / f"{name}.mp3")
    warnings = ["AI stemy mohou obsahovat přeslechy; piano je u tohoto modelu slabší.", "Akordy jsou základní odhad dur/moll, nikoli ověřený přepis kytarového partu."]
    stage("chords")
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
    stage("lyrics")
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
    result = {"title": inputs.get("title"), "duration": inputs["duration"], "stems": names, "waveforms": waveforms, "chords": chords, "key": key, "language": language, "words": words, "segments": segments, "text": " ".join(s["text"] for s in segments), "suppliedLyrics": inputs["lyrics"], "warnings": warnings, "models": {"stems": "htdemucs_6s", "lyrics": os.getenv("WHISPER_MODEL", "small"), "chords": service.get_model_version()}}
    (folder / "result.json").write_text(json.dumps(result, ensure_ascii=False))
    # The user-facing copies are MP3; remove intermediate WAVs to bound storage.
    import shutil
    shutil.rmtree(folder / "separated")
    accompaniment.unlink(missing_ok=True)
    (folder / inputs["source"]).unlink(missing_ok=True)
    stage("ready")


if __name__ == "__main__":
    main(Path(sys.argv[1]))

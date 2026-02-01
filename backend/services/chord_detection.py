"""Chord detection service."""
import numpy as np
import librosa
import os
import asyncio
import shutil
import subprocess
import tempfile
import sys
from typing import List, Dict, Optional, Callable, Tuple
import warnings
warnings.filterwarnings('ignore')

 


def _softmax(x: np.ndarray, axis: int = -1) -> np.ndarray:
    x = x - np.max(x, axis=axis, keepdims=True)
    e = np.exp(x)
    return e / (np.sum(e, axis=axis, keepdims=True) + 1e-12)


def _viterbi_decode(log_emissions: np.ndarray, log_transitions: np.ndarray) -> np.ndarray:
    n_states, n_frames = log_emissions.shape
    dp = np.full((n_states, n_frames), -np.inf, dtype=np.float64)
    back = np.zeros((n_states, n_frames), dtype=np.int32)

    dp[:, 0] = log_emissions[:, 0]
    back[:, 0] = 0

    for t in range(1, n_frames):
        prev = dp[:, t - 1][:, None] + log_transitions
        back[:, t] = np.argmax(prev, axis=0)
        dp[:, t] = log_emissions[:, t] + prev[back[:, t], np.arange(n_states)]

    states = np.zeros(n_frames, dtype=np.int32)
    states[-1] = int(np.argmax(dp[:, -1]))
    for t in range(n_frames - 1, 0, -1):
        states[t - 1] = int(back[states[t], t])
    return states


def _chord_templates() -> Tuple[List[str], np.ndarray]:
    pitch_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    major = np.array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], dtype=np.float32)
    minor = np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], dtype=np.float32)

    labels: List[str] = ["N"]
    templates: List[np.ndarray] = [np.zeros(12, dtype=np.float32)]
    for i, p in enumerate(pitch_names):
        labels.append(p)
        templates.append(np.roll(major, i))
    for i, p in enumerate(pitch_names):
        labels.append(f"{p}m")
        templates.append(np.roll(minor, i))

    T = np.stack(templates, axis=0)
    T = T / (np.linalg.norm(T, axis=1, keepdims=True) + 1e-9)
    return labels, T


def _default_transition_logp(n_states: int, self_prob: float = 0.985) -> np.ndarray:
    if n_states < 2:
        return np.zeros((n_states, n_states), dtype=np.float64)
    other = (1.0 - self_prob) / float(n_states - 1)
    P = np.full((n_states, n_states), other, dtype=np.float64)
    np.fill_diagonal(P, self_prob)
    return np.log(P + 1e-12)


def _segments_from_states(
    labels: List[str],
    states: np.ndarray,
    times: np.ndarray,
    probs: Optional[np.ndarray] = None,
    final_end_time: Optional[float] = None,
) -> List[Dict[str, float]]:
    out: List[Dict[str, float]] = []
    if len(states) == 0:
        return out

    start_idx = 0
    cur = int(states[0])
    for i in range(1, len(states)):
        s = int(states[i])
        if s != cur:
            start_t = float(times[start_idx])
            end_t = float(times[i])
            chord = labels[cur]
            conf = None
            if probs is not None:
                conf = float(np.mean(probs[cur, start_idx:i]))
            out.append({"chord": chord, "start": start_t, "end": end_t, "confidence": conf})
            start_idx = i
            cur = s

    start_t = float(times[start_idx])
    end_t = float(final_end_time if final_end_time is not None else times[-1])
    chord = labels[cur]
    conf = None
    if probs is not None:
        conf = float(np.mean(probs[cur, start_idx:]))
    out.append({"chord": chord, "start": start_t, "end": end_t, "confidence": conf})
    return out


def _has_demucs() -> bool:
    try:
        import demucs.separate  # type: ignore
        return True
    except Exception:
        return False


def _demucs_separate_to_other(audio_path: str) -> Tuple[Optional[str], Optional[str]]:
    if not _has_demucs():
        return None, None

    tmpdir = tempfile.mkdtemp(prefix="demucs-")
    outdir = os.path.join(tmpdir, "out")
    os.makedirs(outdir, exist_ok=True)
    model = (os.getenv("CHORD_DETECTION_DEMUCS_MODEL") or "mdx").strip()
    device = (os.getenv("CHORD_DETECTION_DEMUCS_DEVICE") or "cpu").strip()
    overlap = (os.getenv("CHORD_DETECTION_DEMUCS_OVERLAP") or "0.1").strip()
    segment = (os.getenv("CHORD_DETECTION_DEMUCS_SEGMENT") or "10").strip()
    jobs = (os.getenv("CHORD_DETECTION_DEMUCS_JOBS") or "").strip()

    cmd = [
        sys.executable,
        "-m",
        "demucs.separate",
        "--two-stems",
        "vocals",
        "--name",
        model,
        "--device",
        device,
        "--shifts",
        "0",
        "--overlap",
        overlap,
        "--segment",
        segment,
        "--out",
        outdir,
        audio_path,
    ]
    if jobs:
        cmd += ["-j", jobs]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    base = os.path.splitext(os.path.basename(audio_path))[0]
    for root, _dirs, files in os.walk(outdir):
        for f in files:
            if f.startswith(base) and "no_vocals" in f:
                return os.path.join(root, f), tmpdir
            if f.startswith(base) and f.startswith("other"):
                return os.path.join(root, f), tmpdir
            if f == "no_vocals.wav" or f == "no_vocals.flac" or f == "no_vocals.mp3":
                return os.path.join(root, f), tmpdir
            if f == "other.mp3" or f == "other.wav" or f == "no_vocals.mp3" or f == "no_vocals.wav":
                return os.path.join(root, f), tmpdir
    return None, tmpdir

class ChordDetectionService:
    """Service for detecting chords from audio files."""
    
    def __init__(self):
        self.provider = "local"
        self.use_demucs = (os.getenv("CHORD_DETECTION_DEMUCS") or "").strip().lower() in ("1", "true", "yes")
        print("✅ Using local chord detection")

    def is_configured(self) -> bool:
        return True
    
    async def detect_chords(
        self,
        audio_path: str,
        *,
        progress_cb: Optional[Callable[[str, int], None]] = None,
        vocal_heavy: bool = False,
    ) -> List[Dict]:
        chosen_audio_path = audio_path
        demucs_tmpdir = None
        demucs_mode = (os.getenv("CHORD_DETECTION_DEMUCS") or "").strip().lower()
        use_demucs = False
        if self.use_demucs:
            use_demucs = True
        elif demucs_mode in ("1", "true", "yes"):
            use_demucs = True
        elif demucs_mode == "auto":
            use_demucs = bool(vocal_heavy)

        if use_demucs:
            if progress_cb:
                progress_cb("chords_separation", 1)
            try:
                separated, tmpdir = await asyncio.to_thread(_demucs_separate_to_other, audio_path)
                demucs_tmpdir = tmpdir
                if separated:
                    chosen_audio_path = separated
            except Exception:
                chosen_audio_path = audio_path

        try:
            chords = await asyncio.to_thread(self._detect_chords_local, chosen_audio_path, progress_cb)
        finally:
            if demucs_tmpdir and os.path.isdir(demucs_tmpdir):
                try:
                    import shutil as _shutil
                    _shutil.rmtree(demucs_tmpdir, ignore_errors=True)
                except Exception:
                    pass
        chords = self._normalize_chords(chords)
        return self._post_process_chords(chords)

    def get_model_version(self) -> str:
        return "local:hmm-chroma-viterbi"

    def _detect_chords_local(
        self,
        audio_path: str,
        progress_cb: Optional[Callable[[str, int], None]] = None,
    ) -> List[Dict]:
        if progress_cb:
            progress_cb("chords_loading", 2)

        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        if len(y) == 0:
            return []

        if progress_cb:
            progress_cb("chords_features", 5)

        y_harm, y_perc = librosa.effects.hpss(y)
        hop_length = 2048

        chroma = librosa.feature.chroma_cens(y=y_harm, sr=sr, hop_length=hop_length)
        chroma = np.maximum(chroma, 0.0)
        chroma = chroma / (np.linalg.norm(chroma, axis=0, keepdims=True) + 1e-9)

        duration_s = float(len(y)) / float(sr)
        times = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr, hop_length=hop_length)

        try:
            _tempo, beats = librosa.beat.beat_track(y=y_perc, sr=sr, hop_length=hop_length)
            if beats is not None and len(beats) >= 2:
                chroma = librosa.util.sync(chroma, beats, aggregate=np.median)
                beat_times = librosa.frames_to_time(beats, sr=sr, hop_length=hop_length)
                times = beat_times
        except Exception:
            pass

        labels, templates = _chord_templates()
        sim = templates @ chroma

        temperatures = float(os.getenv("CHORD_LOCAL_TEMPERATURE") or 0.08)
        log_em = sim / max(temperatures, 1e-3)

        n_states = len(labels)
        log_tr = _default_transition_logp(n_states)

        if progress_cb:
            progress_cb("chords_decoding", 12)

        states = _viterbi_decode(log_em, log_tr)
        probs = _softmax(log_em, axis=0)

        segs = _segments_from_states(labels, states, times, probs, final_end_time=duration_s)
        out: List[Dict] = []
        for s in segs:
            chord = s.get("chord")
            if chord is None:
                continue
            out.append(
                {
                    "chord": chord,
                    "start": round(float(s.get("start") or 0.0), 2),
                    "end": round(float(s.get("end") or 0.0), 2),
                    "time": round(float(s.get("start") or 0.0), 2),
                    "confidence": round(float(s.get("confidence") or 0.0), 3),
                }
            )
        if progress_cb:
            progress_cb("chords", 18)
        return out

    def _normalize_chords(self, chords: List[Dict]) -> List[Dict]:
        normalized: List[Dict] = []
        for item in chords or []:
            if not isinstance(item, dict):
                continue
            chord = item.get("chord")
            if not chord:
                continue

            time_value = item.get("time")
            if time_value is None and item.get("start") is not None:
                time_value = item.get("start")
            try:
                t = round(float(time_value or 0.0), 2)
            except Exception:
                t = 0.0

            out = {
                "chord": str(chord).replace("**", "").replace("*", ""),
                "time": t,
            }

            if item.get("confidence") is not None:
                try:
                    out["confidence"] = round(float(item["confidence"]), 3)
                except Exception:
                    pass
            if item.get("start") is not None:
                try:
                    out["start"] = round(float(item["start"]), 2)
                except Exception:
                    pass
            if item.get("end") is not None:
                try:
                    out["end"] = round(float(item["end"]), 2)
                except Exception:
                    pass
            normalized.append(out)

        normalized.sort(key=lambda x: x.get("time", 0.0))
        return normalized

    def _post_process_chords(
        self,
        chords: List[Dict],
        *,
        min_duration_s: float = 0.6,
        max_events: int = 600,
    ) -> List[Dict]:
        if not chords:
            return []

        merged: List[Dict] = []
        last_chord = None
        for c in chords:
            chord_name = c.get("chord")
            if not chord_name or chord_name == "N":
                continue
            if last_chord == chord_name:
                continue
            merged.append(c)
            last_chord = chord_name

        if len(merged) <= 1:
            return merged

        with_end = []
        for i, c in enumerate(merged):
            next_time = merged[i + 1]["time"] if i + 1 < len(merged) else None
            out = dict(c)
            if out.get("start") is None:
                out["start"] = out.get("time")
            if next_time is not None and out.get("end") is None:
                out["end"] = round(float(next_time), 2)
            with_end.append(out)

        filtered: List[Dict] = []
        for c in with_end:
            start = c.get("start")
            end = c.get("end")
            if start is None or end is None:
                filtered.append(c)
                continue
            try:
                if float(end) - float(start) < min_duration_s:
                    continue
            except Exception:
                pass
            filtered.append(c)

        if len(filtered) > max_events:
            step = int(np.ceil(len(filtered) / max_events))
            filtered = filtered[::step]

        return filtered
    
    def detect_key(self, audio_path: str) -> str:
        """
        Detect the key (tonicity) of the song.
        
        Args:
            audio_path: Path to audio file
        
        Returns:
            Detected key (e.g., "C Major", "Am")
        """
        print("Detecting key...")
        try:
            # Load audio
            y, sr = librosa.load(audio_path, sr=22050)
            
            # Extract chroma features
            chromagram = librosa.feature.chroma_stft(y=y, sr=sr)
            
            # Calculate mean chroma vector
            mean_chroma = np.mean(chromagram, axis=1)
            
            # Key profiles (Krumhansl-Schmuckler)
            major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
            minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
            
            # Normalize profiles
            major_profile = major_profile / np.linalg.norm(major_profile)
            minor_profile = minor_profile / np.linalg.norm(minor_profile)
            
            # Normalize mean chroma
            mean_chroma = mean_chroma / np.linalg.norm(mean_chroma)
            
            # pitches
            pitches = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            
            best_score = -1
            best_key = ""
            
            # Correlate with major and minor profiles for all 12 pitches
            for i in range(12):
                # Major
                rotated_major = np.roll(major_profile, i)
                score_major = np.dot(mean_chroma, rotated_major)
                
                if score_major > best_score:
                    best_score = score_major
                    best_key = f"{pitches[i]} Major"
                
                # Minor
                rotated_minor = np.roll(minor_profile, i)
                score_minor = np.dot(mean_chroma, rotated_minor)
                
                if score_minor > best_score:
                    best_score = score_minor
                    best_key = f"{pitches[i]}m"
            
            print(f"Detected key: {best_key}")
            return best_key
            
        except Exception as e:
            print(f"Error detecting key: {str(e)}")
            return "Unknown"
            
    
# Singleton instance
_chord_service = None


def get_chord_service(use_madmom: bool = True) -> ChordDetectionService:
    """Get or create ChordDetectionService singleton."""
    global _chord_service
    
    if _chord_service is None:
        _chord_service = ChordDetectionService()
    
    return _chord_service

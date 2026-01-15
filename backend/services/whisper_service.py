"""
Enhanced Whisper service with word-level timestamps and multi-language support.
Uses stable-ts for precise word timing needed for chord alignment.
"""
import whisper
from typing import Dict, List, Optional
import warnings
warnings.filterwarnings('ignore')

try:
    import stable_whisper
    STABLE_TS_AVAILABLE = True
except ImportError:
    STABLE_TS_AVAILABLE = False
    print("Warning: stable-ts not installed. Word-level timestamps will not be available.")
    print("Install with: pip install -U stable-ts")


class WhisperService:
    """Service for high-quality speech-to-text with word-level timestamps."""
    
    def __init__(self, model_size: str = "medium"):
        """
        Initialize Whisper service.
        
        Args:
            model_size: Model size - "tiny", "base", "small", "medium", "large", "large-v3"
                       Recommended: "medium" for balance of quality and speed
        """
        self.model_size = model_size
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """Load the Whisper model."""
        print(f"Loading Whisper model ({self.model_size})...")
        
        if STABLE_TS_AVAILABLE:
            # Use stable-ts for word-level timestamps
            self.model = stable_whisper.load_model(self.model_size)
            print(f"Loaded stable-ts Whisper model: {self.model_size}")
        else:
            # Fallback to standard whisper (no word timestamps)
            self.model = whisper.load_model(self.model_size)
            print(f"Loaded standard Whisper model: {self.model_size}")
    
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> Dict:
        """
        Transcribe audio file with word-level timestamps.
        
        Args:
            audio_path: Path to audio file
            language: Language code (e.g., "en", "cs", "sk") or None for auto-detect
            task: "transcribe" or "translate" (translate to English)
        
        Returns:
            Dict with:
                - text: Full transcribed text
                - language: Detected/specified language
                - segments: List of segments with word-level timestamps
                - words: Flat list of all words with timestamps
        """
        print(f"Transcribing audio: {audio_path}")
        print(f"Language: {language or 'auto-detect'}")
        
        if STABLE_TS_AVAILABLE:
            # Use stable-ts for word-level timestamps
            result = self.model.transcribe(
                audio_path,
                language=language,
                task=task,
                word_timestamps=True,
                regroup=True,  # Regroup words into better segments
                suppress_silence=True,
                vad=True  # Voice activity detection
            )
            
            # Extract word-level data
            words = []
            for segment in result.segments:
                if hasattr(segment, 'words'):
                    for word in segment.words:
                        words.append({
                            "word": word.word.strip(),
                            "start": round(word.start, 2),
                            "end": round(word.end, 2),
                            "probability": round(word.probability, 2) if hasattr(word, 'probability') else 1.0
                        })
            
            # Format segments
            segments = []
            for segment in result.segments:
                seg_data = {
                    "text": segment.text.strip(),
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2)
                }
                
                # Add word-level data to segment
                if hasattr(segment, 'words'):
                    seg_data["words"] = [
                        {
                            "word": w.word.strip(),
                            "start": round(w.start, 2),
                            "end": round(w.end, 2)
                        }
                        for w in segment.words
                    ]
                
                segments.append(seg_data)
            
            return {
                "text": result.text.strip(),
                "language": result.language,
                "segments": segments,
                "words": words
            }
        
        else:
            # Fallback: Standard whisper without word timestamps
            result = self.model.transcribe(
                audio_path,
                language=language,
                task=task
            )
            
            segments = [
                {
                    "text": seg["text"].strip(),
                    "start": round(seg["start"], 2),
                    "end": round(seg["end"], 2),
                    "words": []  # Empty - no word-level data
                }
                for seg in result["segments"]
            ]
            
            return {
                "text": result["text"].strip(),
                "language": result.get("language", language or "unknown"),
                "segments": segments,
                "words": []  # Empty - no word-level data
            }
    
    def detect_language(self, audio_path: str) -> str:
        """
        Detect the language of an audio file.
        
        Args:
            audio_path: Path to audio file
        
        Returns:
            Language code (e.g., "en", "cs", "sk")
        """
        # Load audio and detect language
        audio = whisper.load_audio(audio_path)
        audio = whisper.pad_or_trim(audio)
        
        # Make log-Mel spectrogram
        mel = whisper.log_mel_spectrogram(audio).to(self.model.device)
        
        # Detect language
        _, probs = self.model.detect_language(mel)
        detected_language = max(probs, key=probs.get)
        
        print(f"Detected language: {detected_language} (confidence: {probs[detected_language]:.2f})")
        
        return detected_language


# Singleton instance
_whisper_service = None


def get_whisper_service(model_size: str = "medium") -> WhisperService:
    """Get or create WhisperService singleton."""
    global _whisper_service
    
    if _whisper_service is None:
        _whisper_service = WhisperService(model_size)
    
    return _whisper_service

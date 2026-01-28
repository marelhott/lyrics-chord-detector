"""
Fast Whisper service using OpenAI API.
Much faster than local Whisper (5-10s vs 5-10min).
"""
import os
from openai import OpenAI
import httpx
from typing import Optional, Dict, List
import warnings
warnings.filterwarnings('ignore')


class FastWhisperService:
    """Fast Whisper service using OpenAI API."""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize OpenAI Whisper API service.
        
        Args:
            api_key: OpenAI API key (or set OPENAI_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        
        if not self.api_key:
            raise ValueError(
                "OpenAI API key required. Set OPENAI_API_KEY environment variable "
                "or pass api_key parameter."
            )
        
        # Explicitly create httpx client to bypass potential version conflicts
        # with 'proxies' vs 'proxy' argument in OpenAI's internal wrapper.
        self.http_client = httpx.Client()
        self.client = OpenAI(api_key=self.api_key, http_client=self.http_client)
        self.model = "whisper-1"
        
        print(f"✅ OpenAI Whisper API ready (model: {self.model})")
    
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None
    ) -> Dict:
        """
        Transcribe audio using OpenAI Whisper API with word-level timestamps.
        
        Args:
            audio_path: Path to audio file
            language: Language code (optional, API auto-detects)
        
        Returns:
            Dict with:
            - text: Full transcribed text
            - language: Detected language
            - segments: List of segments with timestamps
            - words: List of words with timestamps (for chord alignment)
        """
        print(f"Transcribing with OpenAI API: {audio_path}")
        print(f"Language: {language or 'auto-detect'}")
        
        # Open audio file
        with open(audio_path, "rb") as audio_file:
            # Transcribe with word-level timestamps
            transcript = self.client.audio.transcriptions.create(
                model=self.model,
                file=audio_file,
                language=language,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"]  # Request both!
            )
        
        # Extract data
        text = transcript.text
        detected_language = transcript.language
        
        # Convert segments
        segments = []
        for seg in transcript.segments:
            segments.append({
                "text": seg.text.strip(),
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "words": []  # Will be filled from word-level data
            })
        
        # Extract word-level timestamps
        all_words = []
        
        # Debug: Check what we got from API
        print(f"DEBUG: transcript type: {type(transcript)}")
        print(f"DEBUG: has 'words' attr: {hasattr(transcript, 'words')}")
        if hasattr(transcript, 'words'):
            print(f"DEBUG: words value: {transcript.words}")
            print(f"DEBUG: words type: {type(transcript.words)}")
        
        if hasattr(transcript, 'words') and transcript.words:
            for word in transcript.words:
                all_words.append({
                    "word": word.word.strip(),
                    "start": round(word.start, 2),
                    "end": round(word.end, 2)
                })
        else:
            print("WARNING: No word-level timestamps in API response!")
            print(f"DEBUG: Available attributes: {dir(transcript)}")
        
        # Assign words to segments
        # Use word START time to determine segment membership (not end time)
        # This prevents losing words that span segment boundaries
        for segment in segments:
            segment_words = [
                w for w in all_words
                if w["start"] >= segment["start"] and w["start"] < segment["end"]
            ]
            segment["words"] = segment_words
        
        print(f"✅ Transcription complete!")
        print(f"   Language: {detected_language}")
        print(f"   Segments: {len(segments)}")
        print(f"   Words: {len(all_words)}")
        print(f"   Text length: {len(text)} chars")
        
        return {
            "text": text,
            "language": detected_language,
            "segments": segments,
            "words": all_words
        }
    
    def detect_language(self, audio_path: str) -> str:
        """
        Detect language of audio file.
        
        Args:
            audio_path: Path to audio file
        
        Returns:
            Language code (e.g., 'en', 'cs', 'sk')
        """
        # Transcribe first 30 seconds to detect language
        with open(audio_path, "rb") as audio_file:
            transcript = self.client.audio.transcriptions.create(
                model=self.model,
                file=audio_file,
                response_format="verbose_json"
            )
        
        return transcript.language


# Singleton instance
_fast_whisper_service = None


def get_fast_whisper_service(api_key: Optional[str] = None) -> FastWhisperService:
    """Get or create FastWhisperService singleton."""
    global _fast_whisper_service
    
    if _fast_whisper_service is None:
        _fast_whisper_service = FastWhisperService(api_key=api_key)
    
    return _fast_whisper_service

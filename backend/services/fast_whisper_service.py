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

from services.audio_utils import prepare_audio_for_transcription


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

        self.validate_credentials()
        
        print(f"✅ OpenAI Whisper API ready (model: {self.model})")

    def validate_credentials(self) -> None:
        try:
            _ = self.client.models.list()
        except Exception as e:
            error_message = str(e)
            if "invalid_api_key" in error_message or "Incorrect API key" in error_message or " 401" in error_message:
                raise ValueError("OpenAI authentication failed. Check OPENAI_API_KEY.")
            raise
    
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        vocal_heavy: bool = False,
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
        warnings_list: List[str] = []
        prepared_path = prepare_audio_for_transcription(audio_path, vocal_heavy=bool(vocal_heavy))
        
        try:
            with open(prepared_path, "rb") as audio_file:
                try:
                    transcript = self.client.audio.transcriptions.create(
                        model=self.model,
                        file=audio_file,
                        language=language,
                        response_format="verbose_json",
                        timestamp_granularities=["word", "segment"],
                    )
                except Exception as e:
                    error_message = str(e)
                    if "invalid_api_key" in error_message or "Incorrect API key" in error_message:
                        raise RuntimeError("OpenAI authentication failed. Check OPENAI_API_KEY.")
                    raise
        finally:
            if prepared_path != audio_path:
                try:
                    os.unlink(prepared_path)
                except Exception:
                    pass
        
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
        
        all_words = []
        if hasattr(transcript, 'words') and transcript.words:
            for word in transcript.words:
                all_words.append({
                    "word": word.word.strip(),
                    "start": round(word.start, 2),
                    "end": round(word.end, 2)
                })
        else:
            warnings_list.append("No word-level timestamps returned by transcription; using segment-only alignment.")
        
        # Assign words to segments
        for segment in segments:
            segment_words = [
                w for w in all_words
                if w["start"] >= segment["start"] and w["end"] <= segment["end"]
            ]
            segment["words"] = segment_words
        
        return {
            "text": text,
            "language": detected_language,
            "segments": segments,
            "words": all_words,
            "warnings": warnings_list,
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
            try:
                transcript = self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    response_format="verbose_json"
                )
            except Exception as e:
                error_message = str(e)
                if "invalid_api_key" in error_message or "Incorrect API key" in error_message:
                    raise RuntimeError("OpenAI authentication failed. Check OPENAI_API_KEY.")
                raise
        
        return transcript.language


# Singleton instance
_fast_whisper_service = None


def get_fast_whisper_service(api_key: Optional[str] = None) -> FastWhisperService:
    """Get or create FastWhisperService singleton."""
    global _fast_whisper_service
    
    if _fast_whisper_service is None:
        _fast_whisper_service = FastWhisperService(api_key=api_key)
    
    return _fast_whisper_service

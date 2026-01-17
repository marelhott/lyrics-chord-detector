"""
Music.ai SDK service for premium chord detection.
Provides high-accuracy chord recognition with jazz/extended chords support.
"""
import os
from typing import List, Dict, Optional

try:
    from music_ai import MusicAI
    MUSIC_AI_AVAILABLE = True
except ImportError:
    MUSIC_AI_AVAILABLE = False
    print("Warning: music-ai SDK not installed.")
    print("Install with: pip install music-ai")


class MusicAIChordService:
    """Service for premium chord detection using Music.ai SDK."""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Music.ai service.
        
        Args:
            api_key: Music.ai API key (or set MUSIC_AI_API_KEY env var)
        """
        if not MUSIC_AI_AVAILABLE:
            raise ImportError("music-ai SDK not installed")
        
        self.api_key = api_key or os.getenv("MUSIC_AI_API_KEY")
        if not self.api_key:
            raise ValueError("Music.ai API key required. Set MUSIC_AI_API_KEY environment variable.")
        
        self.client = MusicAI(api_key=self.api_key)
        print("✅ Music.ai SDK initialized")
    
    def detect_chords_premium(
        self, 
        audio_path: str, 
        classification: str = "complex_pop"
    ) -> List[Dict]:
        """
        Detect chords using Music.ai SDK (premium quality).
        
        Args:
            audio_path: Path to audio file
            classification: Chord classification type:
                - 'simple_pop': Basic pop chords (C, Am, F, G, etc.)
                - 'complex_pop': Extended pop chords (Cmaj7, Am9, etc.)
                - 'simple_jazz': Basic jazz chords
                - 'complex_jazz': Full jazz vocabulary (altered, diminished, etc.)
        
        Returns:
            List of chord detections:
            [
                {
                    "time": 0.5,
                    "chord": "Cmaj7",
                    "bass": "C",
                    "confidence": 0.92
                },
                ...
            ]
        """
        print(f"Detecting chords with Music.ai ({classification})...")
        
        try:
            # Call Music.ai API
            result = self.client.transcribe_chords(
                audio_path,
                classification=classification,
                include_bass=True
            )
            
            # Convert to standard format
            chords = []
            for annotation in result.get('timeline', []):
                chords.append({
                    'time': annotation['time'],
                    'chord': annotation['chord'],
                    'bass': annotation.get('bass'),
                    'confidence': annotation.get('confidence', 1.0)
                })
            
            print(f"✅ Detected {len(chords)} chords with Music.ai")
            return chords
            
        except Exception as e:
            print(f"❌ Music.ai error: {str(e)}")
            raise


# Singleton instance
_music_ai_service = None

def get_music_ai_service(api_key: Optional[str] = None) -> Optional[MusicAIChordService]:
    """Get or create Music.ai service instance."""
    global _music_ai_service
    
    if not MUSIC_AI_AVAILABLE:
        return None
    
    if _music_ai_service is None:
        try:
            _music_ai_service = MusicAIChordService(api_key=api_key)
        except (ValueError, ImportError) as e:
            print(f"Music.ai not available: {str(e)}")
            return None
    
    return _music_ai_service

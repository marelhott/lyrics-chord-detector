"""
ChordMini API Service - Free chord detection with 75-80% accuracy.
Uses ChordMini's open API for chord recognition.
"""
import httpx
from typing import List, Dict, Optional
import tempfile
import os


class ChordMiniService:
    """Service for detecting chords using ChordMini API."""
    
    def __init__(self):
        """Initialize ChordMini service."""
        self.api_url = "https://api.chordmini.me"
        self.timeout = 60.0  # 60 seconds timeout
        print("✅ ChordMini API service initialized")
    
    async def detect_chords(self, audio_path: str) -> List[Dict]:
        """
        Detect chords from audio file using ChordMini API.
        
        Args:
            audio_path: Path to local audio file
        
        Returns:
            List of chord detections:
            [
                {"chord": "C", "time": 0.5, "confidence": 0.85},
                {"chord": "Am", "time": 2.0, "confidence": 0.90},
                ...
            ]
        """
        print(f"Detecting chords with ChordMini API: {audio_path}")
        
        try:
            # ChordMini expects file upload (multipart/form-data)
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                with open(audio_path, 'rb') as audio_file:
                    files = {'file': audio_file}
                    
                    print(f"Uploading to ChordMini API...")
                    response = await client.post(
                        f"{self.api_url}/api/recognize-chords",
                        files=files
                    )
                    
                    if response.status_code != 200:
                        raise Exception(f"ChordMini API error: {response.status_code} - {response.text}")
                    
                    data = response.json()
                    print(f"ChordMini API response received")
                    
                    # Parse and format results
                    chords = self._format_chords(data)
                    print(f"✅ ChordMini detected {len(chords)} chord changes")
                    return chords
        
        except Exception as e:
            print(f"⚠️  ChordMini API failed: {str(e)}")
            print(f"   Falling back to librosa...")
            # Return empty list to trigger fallback
            return []
    
    def _format_chords(self, data: dict) -> List[Dict]:
        """
        Convert ChordMini API response to our standard format.
        
        ChordMini format:
        {
            "chords": [
                {"label": "C", "timestamp": 0.5, "confidence": 0.85},
                ...
            ]
        }
        """
        chords = data.get('chords', [])
        
        formatted = []
        for chord in chords:
            formatted.append({
                "chord": chord.get("label", "N"),
                "time": round(float(chord.get("timestamp", 0)), 2),
                "confidence": round(float(chord.get("confidence", 0.75)), 2)
            })
        
        # Remove consecutive duplicates
        if len(formatted) > 0:
            deduplicated = [formatted[0]]
            for chord in formatted[1:]:
                if chord["chord"] != deduplicated[-1]["chord"]:
                    deduplicated.append(chord)
            return deduplicated
        
        return formatted


# Singleton instance
_chordmini_service = None


def get_chordmini_service() -> ChordMiniService:
    """Get or create ChordMiniService singleton."""
    global _chordmini_service
    
    if _chordmini_service is None:
        _chordmini_service = ChordMiniService()
    
    return _chordmini_service

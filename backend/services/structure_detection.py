"""
Song structure detection service.
Identifies sections like Intro, Verse, Chorus, Bridge, Outro.
"""
import numpy as np
import librosa
from typing import List, Dict
from difflib import SequenceMatcher
import warnings
warnings.filterwarnings('ignore')


class StructureDetectionService:
    """Service for detecting song structure (Intro, Verse, Chorus, etc.)."""
    
    def __init__(self):
        """Initialize structure detection service."""
        pass
    
    def detect_structure(
        self,
        audio_path: str,
        segments: List[Dict],
        chords: List[Dict]
    ) -> List[Dict]:
        """
        Detect song structure from audio and lyrics.
        
        Args:
            audio_path: Path to audio file
            segments: Transcribed segments with text and timestamps
            chords: Detected chords with timestamps
        
        Returns:
            List of sections:
            [
                {"type": "intro", "start": 0, "end": 8, "segments": [...]},
                {"type": "verse", "number": 1, "start": 8, "end": 32, "segments": [...]},
                {"type": "chorus", "start": 32, "end": 48, "segments": [...]},
                ...
            ]
        """
        print("Detecting song structure...")
        
        # Combine audio analysis and lyrics analysis
        audio_boundaries = self._detect_audio_boundaries(audio_path)
        lyric_structure = self._analyze_lyric_patterns(segments)
        
        # Merge results
        structure = self._merge_structure(audio_boundaries, lyric_structure, segments, chords)
        
        print(f"Detected {len(structure)} sections")
        return structure
    
    def _detect_audio_boundaries(self, audio_path: str) -> List[float]:
        """
        Detect section boundaries.
        Optimized for Render Free Tier: Skips heavy self-similarity matrix analysis.
        Returns basic intervals as a fallback.
        """
        try:
            # Skip heavy librosa.segment.recurrence_matrix (O(N^2) memory limits)
            # Just get duration and return standard 16-bar(ish) segments as hints
            # duration = librosa.get_duration(path=audio_path)
            # return [i * 15 for i in range(1, int(duration / 15))]
            
            # Actually, we can just return empty and rely on lyrics
            return []
        
        except Exception as e:
            print(f"Error in audio boundary detection: {str(e)}")
            return []
    
    def _analyze_lyric_patterns(self, segments: List[Dict]) -> Dict:
        """
        Analyze lyrics to find repeating patterns (chorus detection).
        """
        if not segments:
            return {"chorus_indices": [], "verse_indices": []}
        
        # Extract text from segments
        texts = [seg["text"].strip().lower() for seg in segments]
        
        # Find repeating segments (potential chorus)
        chorus_indices = []
        verse_indices = []
        
        # Compare each segment with others
        for i, text1 in enumerate(texts):
            if len(text1) < 10:  # Skip very short segments
                continue
            
            matches = []
            for j, text2 in enumerate(texts):
                if i != j and len(text2) >= 10:
                    # Calculate similarity
                    similarity = SequenceMatcher(None, text1, text2).ratio()
                    if similarity > 0.7:  # High similarity threshold
                        matches.append(j)
            
            # If this segment repeats, it's likely a chorus
            if len(matches) >= 1:  # Repeats at least once
                chorus_indices.append(i)
                for match_idx in matches:
                    if match_idx not in chorus_indices:
                        chorus_indices.append(match_idx)
        
        # Remaining segments are likely verses
        for i in range(len(texts)):
            if i not in chorus_indices:
                verse_indices.append(i)
        
        return {
            "chorus_indices": sorted(set(chorus_indices)),
            "verse_indices": sorted(set(verse_indices))
        }
    
    def _merge_structure(
        self,
        audio_boundaries: List[float],
        lyric_structure: Dict,
        segments: List[Dict],
        chords: List[Dict]
    ) -> List[Dict]:
        """
        Merge audio and lyric analysis into final structure.
        """
        if not segments:
            return []
        
        structure = []
        chorus_indices = set(lyric_structure.get("chorus_indices", []))
        verse_indices = set(lyric_structure.get("verse_indices", []))
        
        # Detect intro (no vocals at start)
        first_vocal_time = segments[0]["start"] if segments else 0
        if first_vocal_time > 3:  # More than 3 seconds of instrumental
            structure.append({
                "type": "intro",
                "start": 0,
                "end": round(first_vocal_time, 2),
                "segments": []
            })
        
        # Group segments into sections
        current_section = None
        verse_count = 0
        chorus_count = 0
        
        for i, segment in enumerate(segments):
            # Determine section type
            if i in chorus_indices:
                section_type = "chorus"
            elif i in verse_indices:
                section_type = "verse"
            else:
                section_type = "verse"  # Default
            
            # Start new section if type changed
            if current_section is None or current_section["type"] != section_type:
                # Save previous section
                if current_section is not None:
                    structure.append(current_section)
                
                # Start new section
                if section_type == "verse":
                    verse_count += 1
                    current_section = {
                        "type": "verse",
                        "number": verse_count,
                        "start": segment["start"],
                        "end": segment["end"],
                        "segments": [segment]
                    }
                elif section_type == "chorus":
                    chorus_count += 1
                    current_section = {
                        "type": "chorus",
                        "start": segment["start"],
                        "end": segment["end"],
                        "segments": [segment]
                    }
            else:
                # Continue current section
                current_section["end"] = segment["end"]
                current_section["segments"].append(segment)
        
        # Add last section
        if current_section is not None:
            structure.append(current_section)
        
        # Detect outro (instrumental at end)
        if segments:
            last_vocal_time = segments[-1]["end"]
            try:
                total_duration = librosa.get_duration(path=audio_path) if 'audio_path' in locals() else last_vocal_time + 10
                if total_duration - last_vocal_time > 3:
                    structure.append({
                        "type": "outro",
                        "start": round(last_vocal_time, 2),
                        "end": round(total_duration, 2),
                        "segments": []
                    })
            except:
                pass
        
        return structure


# Singleton instance
_structure_service = None


def get_structure_service() -> StructureDetectionService:
    """Get or create StructureDetectionService singleton."""
    global _structure_service
    
    if _structure_service is None:
        _structure_service = StructureDetectionService()
    
    return _structure_service

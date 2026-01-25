"""
Advanced chord detection service using Madmom library.
Provides more accurate chord detection with support for extended chords.
"""
import numpy as np
import librosa
from typing import List, Dict, Optional
import warnings
warnings.filterwarnings('ignore')

try:
    from madmom.features.chords import DeepChromaChordRecognitionProcessor
    MADMOM_AVAILABLE = True
except ImportError:
    MADMOM_AVAILABLE = False
    print("Warning: madmom not installed. Using fallback chord detection.")
    print("Install with: pip install madmom")


class ChordDetectionService:
    """Service for detecting chords from audio files."""
    
    def __init__(self, use_madmom: bool = True):
        """
        Initialize chord detection service.
        
        Args:
            use_madmom: Use Madmom if available, otherwise use librosa fallback
        """
        self.use_madmom = use_madmom and MADMOM_AVAILABLE
        
        if self.use_madmom:
            print("Initializing Madmom chord detection...")
            self.processor = DeepChromaChordRecognitionProcessor()
            print("Madmom chord detection ready")
        else:
            print("Using librosa-based chord detection (fallback)")
            self.processor = None
    
    def detect_chords(self, audio_path: str, quality: str = "free") -> List[Dict]:
        """
        Detect chords from audio file with quality tier support.
        
        Args:
            audio_path: Path to audio file
            quality: Detection quality tier:
                - 'free': Madmom only (~75-80% accuracy)
                - 'premium': Demucs separation + Madmom (~80-85% accuracy)
        
        Returns:
            List of chord detections:
            [
                {"chord": "C", "time": 0.5, "confidence": 0.85},
                {"chord": "Am", "time": 2.0, "confidence": 0.90},
                ...
            ]
        """
        if quality == "premium":
            return self._detect_premium(audio_path)
        elif self.use_madmom:
            return self._detect_with_madmom(audio_path)
        else:
            return self._detect_with_librosa(audio_path)
    
    def _detect_premium(self, audio_path: str) -> List[Dict]:
        """Detect chords using premium tier (Demucs + Madmom)."""
        try:
            from services.demucs_service import get_demucs_service
            import os
            
            # Get Demucs service
            demucs = get_demucs_service()
            
            if not demucs:
                print("Demucs not available, falling back to Madmom")
                return self._detect_with_madmom(audio_path)
            
            # Step 1: Separate guitar using Demucs
            print("🎸 Separating guitar track with Demucs...")
            guitar_path = demucs.separate_guitar(audio_path)
            
            try:
                # Step 2: Detect chords on isolated guitar with Madmom
                print("🎵 Detecting chords on isolated guitar...")
                chords = self._detect_with_madmom(guitar_path)
                
                print(f"✅ Premium detection complete: {len(chords)} chords")
                return chords
                
            finally:
                # Cleanup separated audio
                if os.path.exists(guitar_path):
                    os.unlink(guitar_path)
                    
        except Exception as e:
            print(f"Premium detection failed: {str(e)}")
            print("Falling back to standard Madmom...")
            return self._detect_with_madmom(audio_path)

    
    def _detect_with_madmom(self, audio_path: str) -> List[Dict]:
        """Detect chords using Madmom (more accurate)."""
        print("Detecting chords with Madmom...")
        
        # Process audio file
        chords = self.processor(audio_path)
        
        # Format results
        result = []
        prev_chord = None
        
        for time, chord_label in chords:
            # Skip if same as previous chord (merge consecutive)
            if chord_label == prev_chord:
                continue
            
            # Parse chord label (Madmom format: "C:maj", "A:min", "G:7", etc.)
            chord_name = self._parse_madmom_chord(chord_label)
            
            # Skip "N" (no chord) detections
            if chord_name == "N":
                continue
            
            result.append({
                "chord": chord_name,
                "time": round(float(time), 2),
                "confidence": 0.85  # Madmom doesn't provide confidence, use default
            })
            
            prev_chord = chord_label
        
        print(f"Detected {len(result)} chord changes")
        return result
    
    def _parse_madmom_chord(self, chord_label: str) -> str:
        """
        Parse Madmom chord label to standard format.
        
        Madmom format: "C:maj", "A:min", "G:7", "D:min7", etc.
        Output format: "C", "Am", "G7", "Dm7", etc.
        """
        if chord_label == "N":
            return "N"
        
        parts = chord_label.split(":")
        root = parts[0]
        
        if len(parts) == 1:
            return root
        
        quality = parts[1]
        
        # Convert to standard notation
        if quality == "maj":
            return root
        elif quality == "min":
            return root + "m"
        elif quality == "7":
            return root + "7"
        elif quality == "maj7":
            return root + "maj7"
        elif quality == "min7":
            return root + "m7"
        elif quality == "dim":
            return root + "dim"
        elif quality == "aug":
            return root + "aug"
        elif quality == "sus4":
            return root + "sus4"
        elif quality == "sus2":
            return root + "sus2"
        else:
            # Unknown quality, return as-is
            return chord_label.replace(":", "")
    
    def _detect_with_librosa(self, audio_path: str) -> List[Dict]:
        """
        Enhanced chord detection using librosa with extended templates.
        Improved from basic 24 chords to 50+ with better filtering.
        """
        print("Detecting chords with enhanced librosa...")
        
        try:
            # Load audio
            y, sr = librosa.load(audio_path, sr=22050)
            
            # Extract chroma features with better resolution
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
            
            hop_length = 512
            frame_duration = hop_length / sr
            
            # ENHANCED: Extended chord templates (50+ chords)
            chord_templates = self._get_extended_chord_templates()
            
            chords = []
            
            # Detect chords for each frame
            for i in range(0, chroma.shape[1], 20):  # Every 20 frames (~0.5s)
                if i + 20 > chroma.shape[1]:
                    break
                
                # Average chroma for this segment
                avg_chroma = np.mean(chroma[:, i:i+20], axis=1)
                
                # Find best matching chord
                best_match = None
                best_score = -1
                
                for chord_name, template in chord_templates.items():
                    # Cosine similarity
                    score = np.dot(avg_chroma, template) / (
                        np.linalg.norm(avg_chroma) * np.linalg.norm(template) + 1e-10
                    )
                    
                    if score > best_score:
                        best_score = score
                        best_match = chord_name
                
                # ENHANCED: Higher confidence threshold (0.65 instead of 0.5)
                if best_score > 0.65:
                    time = i * frame_duration
                    chords.append({
                        "chord": best_match,
                        "time": round(time, 2),
                        "confidence": round(float(best_score), 2)
                    })
            
            # ENHANCED: Temporal smoothing - merge consecutive duplicates
            merged_chords = []
            if chords:
                current = chords[0]
                for next_chord in chords[1:]:
                    if next_chord["chord"] == current["chord"]:
                        # Same chord - update confidence to max
                        current["confidence"] = max(current["confidence"], next_chord["confidence"])
                        continue
                    else:
                        # ENHANCED: Only change if new chord has significantly higher confidence
                        # or is substantially different
                        if next_chord["confidence"] >= current["confidence"] - 0.1:
                            merged_chords.append(current)
                            current = next_chord
                        # Otherwise skip this false detection
                        
                merged_chords.append(current)
            
            # ENHANCED: Remove very short chords (< 0.5s)
            filtered_chords = []
            for i, chord in enumerate(merged_chords):
                if i < len(merged_chords) - 1:
                    duration = merged_chords[i + 1]["time"] - chord["time"]
                    if duration >= 0.5:  # At least 0.5 seconds
                        filtered_chords.append(chord)
                else:
                    filtered_chords.append(chord)
            
            print(f"Detected {len(filtered_chords)} chord changes (enhanced)")
            print(f"Sample chords: {[c['chord'] for c in filtered_chords[:5]]}")
            return filtered_chords
        
        except Exception as e:
            print(f"Error in chord detection: {str(e)}")
            return []
    
    def _get_extended_chord_templates(self) -> Dict[str, List[float]]:
        """
        Get extended chord templates including 7th, sus, dim, aug chords.
        Returns 50+ chord templates for better detection.
        """
        templates = {}
        
        # Major chords (12)
        major_chords = {
            'C': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
            'C#': [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'D': [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
            'D#': [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
            'E': [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
            'F': [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            'F#': [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
            'G': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            'G#': [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
            'A': [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            'A#': [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
            'B': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
        }
        templates.update(major_chords)
        
        # Minor chords (12)
        minor_chords = {
            'Cm': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
            'C#m': [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            'Dm': [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'D#m': [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
            'Em': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
            'Fm': [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'F#m': [0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
            'Gm': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
            'G#m': [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
            'Am': [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            'A#m': [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            'Bm': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
        }
        templates.update(minor_chords)
        
        # 7th chords (12)
        seventh_chords = {
            'C7': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
            'D7': [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1],
            'E7': [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1],
            'F7': [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
            'G7': [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            'A7': [0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
            'B7': [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
        }
        templates.update(seventh_chords)
        
        # Minor 7th chords (7)
        minor_seventh_chords = {
            'Cm7': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
            'Dm7': [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
            'Em7': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1],
            'Fm7': [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1],
            'Gm7': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
            'Am7': [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
            'Bm7': [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0],
        }
        templates.update(minor_seventh_chords)
        
        # Sus chords (12)
        sus_chords = {
            'Csus4': [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
            'Dsus4': [0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0],
            'Esus4': [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1],
            'Fsus4': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
            'Gsus4': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
            'Asus4': [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
        }
        templates.update(sus_chords)
        
        # Diminished chords (6)
        dim_chords = {
            'Cdim': [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            'Ddim': [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'Edim': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
            'Fdim': [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1],
            'Gdim': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
            'Adim': [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
        }
        templates.update(dim_chords)
        
        print(f"Loaded {len(templates)} chord templates (enhanced)")
        return templates



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
        _chord_service = ChordDetectionService(use_madmom)
    
    return _chord_service

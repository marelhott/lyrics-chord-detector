"""
Hybrid chord detection service.
- Primary: Replicate BTC model (90%+ accuracy, transformer-based)
- Free tier: Essentia (70-80% accuracy, lightweight)
- Premium tier: Modal.com with Madmom+Demucs (89%+ accuracy)
- Fallback: Librosa (60-70% accuracy)
"""
import numpy as np
import librosa
import httpx
import os
from typing import List, Dict, Optional
import warnings
warnings.filterwarnings('ignore')

# Import available services
try:
    from services.replicate_chord_service import get_replicate_service
    REPLICATE_AVAILABLE = True
except ImportError:
    REPLICATE_AVAILABLE = False
    print("Warning: Replicate service not available.")

try:
    from services.essentia_chord_service import get_essentia_service
    ESSENTIA_AVAILABLE = True
except ImportError:
    ESSENTIA_AVAILABLE = False
    print("Warning: Essentia not installed.")

try:
    from madmom.features.chords import DeepChromaChordRecognitionProcessor
    MADMOM_AVAILABLE = True
except ImportError:
    MADMOM_AVAILABLE = False
    print("Warning: madmom not installed. Using fallback chord detection.")


class ChordDetectionService:
    """Service for detecting chords from audio files."""

    def __init__(self, use_madmom: bool = False):
        """
        Initialize chord detection service.

        Args:
            use_madmom: Use Madmom if available (for local dev), otherwise use Essentia
        """
        self.modal_endpoint = os.getenv("MODAL_CHORD_ENDPOINT")

        # Try Replicate first (best quality - BTC transformer model)
        if REPLICATE_AVAILABLE:
            self.replicate_service = get_replicate_service()
            self.use_replicate = self.replicate_service is not None
        else:
            self.use_replicate = False
            self.replicate_service = None

        # Try Essentia second (best for Railway free tier)
        if ESSENTIA_AVAILABLE:
            self.essentia_service = get_essentia_service()
            self.use_essentia = self.essentia_service is not None
        else:
            self.use_essentia = False
            self.essentia_service = None

        # Madmom fallback (for local dev)
        self.use_madmom = use_madmom and MADMOM_AVAILABLE
        if self.use_madmom:
            print("Initializing Madmom chord detection...")
            self.processor = DeepChromaChordRecognitionProcessor()
            print("Madmom chord detection ready")
        else:
            self.processor = None

        # Log active method
        if self.use_replicate:
            print("✅ Using Replicate BTC chord detection (90%+ accuracy)")
        elif self.use_essentia:
            print("✅ Using Essentia chord detection (70-80% accuracy)")
        elif self.use_madmom:
            print("✅ Using Madmom chord detection (89%+ accuracy)")
        else:
            print("✅ Using Librosa chord detection (fallback, 60-70% accuracy)")
    
    async def detect_chords(self, audio_path: str, quality: str = "free") -> List[Dict]:
        """
        Detect chords from audio file with quality tier support.

        Args:
            audio_path: Path to audio file
            quality: Detection quality tier:
                - 'free': Replicate BTC (if available) > Essentia > Librosa
                - 'premium': Modal.com with Madmom+Demucs (89%+ accuracy)

        Returns:
            List of chord detections:
            [
                {"chord": "C", "time": 0.5, "confidence": 0.85},
                {"chord": "Am", "time": 2.0, "confidence": 0.90},
                ...
            ]
        """
        # Premium tier: Call Modal.com
        if quality == "premium" and self.modal_endpoint:
            return await self._detect_premium_modal(audio_path)

        # Try Replicate BTC first (best quality)
        if self.use_replicate:
            try:
                chords = await self.replicate_service.detect_chords(audio_path)
                if chords:
                    return chords
                print("⚠️ Replicate returned no chords, falling back...")
            except Exception as e:
                print(f"⚠️ Replicate failed: {e}, falling back...")

        # Fallback: Essentia
        if self.use_essentia:
            return self.essentia_service.detect_chords(audio_path)

        # Fallback: Madmom
        if self.use_madmom:
            return self._detect_with_madmom(audio_path)

        # Final fallback: Librosa
        return self._detect_with_librosa(audio_path)
    
    async def _detect_premium_modal(self, audio_path: str) -> List[Dict]:
        """Call Modal.com endpoint for premium chord detection."""
        try:
            print("🚀 Calling Modal.com for premium chord detection...")
            
            # Read audio file
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()
            
            # Call Modal endpoint
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    self.modal_endpoint,
                    files={"audio_file": ("audio.mp3", audio_bytes, "audio/mpeg")}
                )
                response.raise_for_status()
                result = response.json()
            
            print(f"✅ Modal.com returned {result.get('chord_count', 0)} chords")
            return result.get("chords", [])
            
        except Exception as e:
            print(f"❌ Modal premium detection failed: {e}")
            print("Falling back to Essentia...")
            
            # Fallback to free tier
            if self.use_essentia:
                return self.essentia_service.detect_chords(audio_path)
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
        Fallback chord detection using librosa (less accurate).
        This is the same as the original implementation.
        """
        print("Detecting chords with librosa (fallback)...")
        
        try:
            # Load audio
            y, sr = librosa.load(audio_path, sr=22050)
            
            # Extract chroma features
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
            
            hop_length = 512
            frame_duration = hop_length / sr
            
            # Extended chord templates
            chord_templates = {
                # Major chords
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
                # Minor chords
                'Cm': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
                'Dm': [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
                'Em': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
                'Fm': [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
                'Gm': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
                'Am': [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            }
            
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
                
                # Only add if confidence is high enough
                if best_score > 0.5:
                    time = i * frame_duration
                    chords.append({
                        "chord": best_match,
                        "time": round(time, 2),
                        "confidence": round(float(best_score), 2)
                    })
            
            # Merge consecutive duplicate chords
            merged_chords = []
            if chords:
                current = chords[0]
                for next_chord in chords[1:]:
                    if next_chord["chord"] == current["chord"]:
                        continue
                    else:
                        merged_chords.append(current)
                        current = next_chord
                merged_chords.append(current)
            
            print(f"Detected {len(merged_chords)} chord changes")
            return merged_chords
        
        except Exception as e:
            print(f"Error in chord detection: {str(e)}")
            return []


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

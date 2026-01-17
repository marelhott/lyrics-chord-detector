"""
Demucs service for audio source separation.
Isolates guitar/bass from vocals and drums for better chord detection.
"""
import torch
import tempfile
import os
from typing import Optional

try:
    from demucs import pretrained
    from demucs.apply import apply_model
    from demucs.audio import AudioFile, save_audio
    DEMUCS_AVAILABLE = True
except ImportError:
    DEMUCS_AVAILABLE = False
    print("Warning: demucs not installed.")
    print("Install with: pip install demucs")


class DemucsService:
    """Service for separating audio sources using Demucs."""
    
    def __init__(self, model_name: str = "htdemucs"):
        """
        Initialize Demucs for source separation.
        
        Args:
            model_name: Demucs model to use:
                - 'htdemucs': Best quality (default)
                - 'htdemucs_ft': Faster, slightly lower quality
                - 'mdx_extra': Alternative high-quality model
        """
        if not DEMUCS_AVAILABLE:
            raise ImportError("demucs not installed")
        
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading Demucs model '{model_name}' on {self.device}...")
        
        self.model = pretrained.get_model(model_name)
        self.model.to(self.device)
        
        print(f"✅ Demucs model loaded ({self.device})")
    
    def separate_guitar(self, audio_path: str) -> str:
        """
        Separate guitar/bass from vocals and drums.
        
        Args:
            audio_path: Path to input audio file
        
        Returns:
            Path to isolated guitar/bass audio file
        """
        print("Separating guitar/bass track with Demucs...")
        
        try:
            # Load audio
            wav = AudioFile(audio_path).read(
                streams=0,
                samplerate=self.model.samplerate,
                channels=self.model.audio_channels
            )
            
            # Normalize
            ref = wav.mean(0)
            wav = (wav - ref.mean()) / ref.std()
            
            # Apply model
            sources = apply_model(self.model, wav[None], device=self.device)[0]
            sources = sources * ref.std() + ref.mean()
            
            # Demucs outputs: [drums, bass, other, vocals]
            # Combine bass (1) + other/guitar (2)
            guitar_bass = sources[1] + sources[2]
            
            # Save to temp file
            output_path = tempfile.mktemp(suffix=".wav")
            save_audio(
                guitar_bass, 
                output_path, 
                samplerate=self.model.samplerate
            )
            
            print(f"✅ Guitar/bass separated: {output_path}")
            return output_path
            
        except Exception as e:
            print(f"❌ Demucs error: {str(e)}")
            raise


# Singleton instance
_demucs_service = None

def get_demucs_service(model_name: str = "htdemucs") -> Optional[DemucsService]:
    """Get or create Demucs service instance."""
    global _demucs_service
    
    if not DEMUCS_AVAILABLE:
        return None
    
    if _demucs_service is None:
        try:
            _demucs_service = DemucsService(model_name=model_name)
        except ImportError as e:
            print(f"Demucs not available: {str(e)}")
            return None
    
    return _demucs_service

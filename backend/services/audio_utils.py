"""
Audio processing utilities for demo mode.
Handles audio trimming and hash calculation.
"""
from pydub import AudioSegment
import hashlib
import os


def trim_audio_to_duration(file_path: str, duration_seconds: int = 30) -> str:
    """
    Trim audio file to specified duration.
    
    Args:
        file_path: Path to input audio file
        duration_seconds: Duration to trim to (default 30s)
    
    Returns:
        Path to trimmed audio file
    """
    try:
        # Load audio file
        audio = AudioSegment.from_file(file_path)
        
        # Trim to specified duration (convert to milliseconds)
        trimmed = audio[:duration_seconds * 1000]
        
        # Generate output path
        base, ext = os.path.splitext(file_path)
        output_path = f"{base}_trimmed{ext}"
        
        # Export trimmed audio
        trimmed.export(output_path, format="mp3")
        
        return output_path
    except Exception as e:
        print(f"Error trimming audio: {str(e)}")
        raise


def calculate_audio_hash(file_path: str) -> str:
    """
    Calculate SHA256 hash of audio file for duplicate detection.
    
    Args:
        file_path: Path to audio file
    
    Returns:
        SHA256 hash as hex string
    """
    try:
        sha256_hash = hashlib.sha256()
        
        # Read file in chunks to handle large files
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        
        return sha256_hash.hexdigest()
    except Exception as e:
        print(f"Error calculating hash: {str(e)}")
        raise


def get_audio_duration(file_path: str) -> float:
    """
    Get duration of audio file in seconds.
    
    Args:
        file_path: Path to audio file
    
    Returns:
        Duration in seconds
    """
    try:
        audio = AudioSegment.from_file(file_path)
        return len(audio) / 1000.0  # Convert ms to seconds
    except Exception as e:
        print(f"Error getting audio duration: {str(e)}")
        raise

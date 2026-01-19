"""
Spotify download service using spotdl.
Downloads audio from Spotify URLs (via YouTube).
"""
import os
import tempfile
from typing import Optional
from spotdl import Spotdl


class SpotifyDownloadService:
    """Service for downloading songs from Spotify URLs."""
    
    def __init__(self):
        """Initialize Spotdl client."""
        self.spotdl = Spotdl(
            client_id=os.getenv("SPOTIFY_CLIENT_ID"),
            client_secret=os.getenv("SPOTIFY_CLIENT_SECRET"),
            user_auth=False,
            headless=True
        )
        print("✅ Spotify download service initialized")
    
    def download_from_url(self, spotify_url: str, output_dir: Optional[str] = None) -> str:
        """
        Download song from Spotify URL.
        
        Args:
            spotify_url: Spotify track URL (e.g., https://open.spotify.com/track/...)
            output_dir: Directory to save the downloaded file (default: temp directory)
        
        Returns:
            Path to downloaded MP3 file
        
        Raises:
            ValueError: If URL is invalid or download fails
        """
        if not output_dir:
            output_dir = tempfile.gettempdir()
        
        try:
            # Download the song
            songs = self.spotdl.search([spotify_url])
            
            if not songs:
                raise ValueError("No song found for the provided URL")
            
            song = songs[0]
            
            # Download to specified directory
            download_path, _ = self.spotdl.downloader.search_and_download(song)
            
            if not download_path or not os.path.exists(download_path):
                raise ValueError("Download failed - file not created")
            
            print(f"✅ Downloaded: {song.name} by {song.artist}")
            print(f"   Path: {download_path}")
            
            return download_path
            
        except Exception as e:
            raise ValueError(f"Failed to download from Spotify: {str(e)}")


# Singleton instance
_spotify_service = None


def get_spotify_service() -> SpotifyDownloadService:
    """Get or create SpotifyDownloadService singleton."""
    global _spotify_service
    
    if _spotify_service is None:
        _spotify_service = SpotifyDownloadService()
    
    return _spotify_service

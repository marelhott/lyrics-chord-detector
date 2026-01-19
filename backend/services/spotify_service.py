"""
Spotify download service using yt-dlp.
Downloads audio from Spotify URLs by searching YouTube.
"""
import os
import tempfile
import re
from typing import Optional


class SpotifyDownloadService:
    """Service for downloading songs from Spotify URLs."""
    
    def __init__(self):
        """Initialize yt-dlp."""
        try:
            import yt_dlp
            self.yt_dlp = yt_dlp
            print("✅ Spotify download service initialized (using yt-dlp)")
        except ImportError:
            print("⚠️ yt-dlp not installed. Spotify download feature will be unavailable.")
            print("   Install with: pip install yt-dlp")
            self.yt_dlp = None
    
    def _extract_track_info_from_url(self, spotify_url: str) -> tuple[str, str]:
        """
        Extract track info from Spotify URL using Spotify's embed API.
        Returns (track_name, artist_name)
        """
        # Extract track ID from URL
        match = re.search(r'track/([a-zA-Z0-9]+)', spotify_url)
        if not match:
            raise ValueError("Invalid Spotify track URL")
        
        track_id = match.group(1)
        
        # Use Spotify's public embed API (no auth required)
        import urllib.request
        import json
        
        try:
            url = f"https://open.spotify.com/embed/track/{track_id}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                html = response.read().decode('utf-8')
                
            # Extract track info from embed page
            # Look for the title in meta tags
            title_match = re.search(r'<title>([^<]+)</title>', html)
            if title_match:
                title = title_match.group(1)
                # Format is usually "Track Name - Artist Name | Spotify"
                if ' - ' in title and ' | ' in title:
                    parts = title.split(' | ')[0].split(' - ')
                    if len(parts) >= 2:
                        return parts[0].strip(), parts[1].strip()
                    return parts[0].strip(), "Unknown Artist"
                return title.replace(' | Spotify', '').strip(), "Unknown Artist"
            
            raise ValueError("Could not extract track info from Spotify URL")
            
        except Exception as e:
            raise ValueError(f"Failed to fetch Spotify track info: {str(e)}")
    
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
        if self.yt_dlp is None:
            raise ValueError(
                "Spotify download feature is not available. "
                "The yt-dlp library is not installed. "
                "Please install it with: pip install yt-dlp"
            )
        
        if not output_dir:
            output_dir = tempfile.gettempdir()
        
        try:
            # Extract track info from Spotify
            track_name, artist_name = self._extract_track_info_from_url(spotify_url)
            search_query = f"{track_name} {artist_name} audio"
            
            print(f"🔍 Searching for: {search_query}")
            
            # Download from YouTube using yt-dlp
            ydl_opts = {
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'outtmpl': os.path.join(output_dir, f'{track_name} - {artist_name}.%(ext)s'),
                'quiet': True,
                'no_warnings': True,
                'default_search': 'ytsearch1',  # Search YouTube and take first result
            }
            
            with self.yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(search_query, download=True)
                
                # Get the downloaded file path
                if info:
                    filename = ydl.prepare_filename(info)
                    # Replace extension with .mp3
                    download_path = os.path.splitext(filename)[0] + '.mp3'
                    
                    if os.path.exists(download_path):
                        print(f"✅ Downloaded: {track_name} by {artist_name}")
                        print(f"   Path: {download_path}")
                        return download_path
            
            raise ValueError("Download failed - file not created")
            
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

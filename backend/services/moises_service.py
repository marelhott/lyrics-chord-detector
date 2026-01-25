"""
Moises.ai API Service - Premium chord detection with 85-90% accuracy.
Pricing: $0.04 per minute of audio.
"""
import httpx
import os
from typing import List, Dict, Optional
import asyncio


class MoisesService:
    """Service for detecting chords using Moises.ai API (premium)."""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Moises.ai service.
        
        Args:
            api_key: Moises.ai API key (or set MOISES_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("MOISES_API_KEY")
        self.api_url = "https://api.moises.ai/v1"
        self.timeout = 120.0  # 2 minutes timeout
        
        if not self.api_key:
            print("⚠️  Moises.ai API key not set. Premium chord detection unavailable.")
            print("   Set MOISES_API_KEY environment variable to enable.")
        else:
            print("✅ Moises.ai API service initialized (premium)")
    
    async def detect_chords(self, audio_path: str) -> List[Dict]:
        """
        Detect chords from audio file using Moises.ai API.
        
        Args:
            audio_path: Path to local audio file
        
        Returns:
            List of chord detections:
            [
                {"chord": "C", "time": 0.5, "confidence": 0.90},
                {"chord": "Am", "time": 2.0, "confidence": 0.95},
                ...
            ]
        """
        if not self.api_key:
            raise Exception("Moises.ai API key not configured")
        
        print(f"Detecting chords with Moises.ai API (premium): {audio_path}")
        
        try:
            # Step 1: Upload file
            print("Step 1/3: Uploading to Moises.ai...")
            file_url = await self._upload_file(audio_path)
            
            # Step 2: Start analysis
            print("Step 2/3: Starting chord analysis...")
            job_id = await self._start_analysis(file_url)
            
            # Step 3: Poll for results
            print("Step 3/3: Waiting for results...")
            chords = await self._get_results(job_id)
            
            print(f"✅ Moises.ai detected {len(chords)} chord changes")
            return chords
        
        except Exception as e:
            print(f"⚠️  Moises.ai API failed: {str(e)}")
            raise
    
    async def _upload_file(self, audio_path: str) -> str:
        """Upload audio file to Moises.ai and get file URL."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            with open(audio_path, 'rb') as audio_file:
                files = {'file': audio_file}
                headers = {'Authorization': f'Bearer {self.api_key}'}
                
                response = await client.post(
                    f"{self.api_url}/upload",
                    files=files,
                    headers=headers
                )
                
                if response.status_code != 200:
                    raise Exception(f"Upload failed: {response.status_code} - {response.text}")
                
                data = response.json()
                return data.get('fileUrl', data.get('url'))
    
    async def _start_analysis(self, file_url: str) -> str:
        """Start chord analysis job."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'fileUrl': file_url,
                'features': ['chords', 'key', 'beats']
            }
            
            response = await client.post(
                f"{self.api_url}/analyze",
                json=payload,
                headers=headers
            )
            
            if response.status_code != 200:
                raise Exception(f"Analysis failed: {response.status_code} - {response.text}")
            
            data = response.json()
            return data.get('jobId', data.get('id'))
    
    async def _get_results(self, job_id: str, max_wait: int = 120) -> List[Dict]:
        """Poll for analysis results."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            headers = {'Authorization': f'Bearer {self.api_key}'}
            
            # Poll every 2 seconds for up to max_wait seconds
            for _ in range(max_wait // 2):
                response = await client.get(
                    f"{self.api_url}/jobs/{job_id}",
                    headers=headers
                )
                
                if response.status_code != 200:
                    raise Exception(f"Status check failed: {response.status_code}")
                
                data = response.json()
                status = data.get('status')
                
                if status == 'completed':
                    # Extract chords from results
                    return self._format_chords(data.get('result', {}))
                elif status == 'failed':
                    raise Exception(f"Analysis failed: {data.get('error')}")
                
                # Wait before next poll
                await asyncio.sleep(2)
            
            raise Exception("Analysis timeout - took too long")
    
    def _format_chords(self, result: dict) -> List[Dict]:
        """
        Convert Moises.ai API response to our standard format.
        
        Moises.ai format (approximate):
        {
            "chords": [
                {"label": "C", "start": 0.5, "end": 2.0, "confidence": 0.90},
                ...
            ]
        }
        """
        chords_data = result.get('chords', [])
        
        formatted = []
        for chord in chords_data:
            formatted.append({
                "chord": chord.get("label", "N"),
                "time": round(float(chord.get("start", 0)), 2),
                "confidence": round(float(chord.get("confidence", 0.85)), 2)
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
_moises_service = None


def get_moises_service(api_key: Optional[str] = None) -> MoisesService:
    """Get or create MoisesService singleton."""
    global _moises_service
    
    if _moises_service is None:
        _moises_service = MoisesService(api_key=api_key)
    
    return _moises_service

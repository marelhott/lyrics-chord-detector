"""
Replicate BTC Chord Recognition Service.
Uses the BTC (Bi-Directional Transformer for Musical Chord Recognition) model
for high-quality chord detection via Replicate API.
"""
import os
import base64
import httpx
import asyncio
from typing import List, Dict, Optional
import warnings
warnings.filterwarnings('ignore')


class ReplicateChordService:
    """Service for chord detection using Replicate's BTC model."""

    # BTC chord recognition model on Replicate
    # This is a transformer-based model trained on chord recognition
    MODEL_VERSION = "andreasjansson/chord-recognition:59beab66a680b2fb4be8f39e5cf57b44a09a9d97bcf3c3e4813a09baf25ead2c"

    def __init__(self, api_token: Optional[str] = None):
        """
        Initialize Replicate chord service.

        Args:
            api_token: Replicate API token (or set REPLICATE_API_TOKEN env var)
        """
        self.api_token = api_token or os.getenv("REPLICATE_API_TOKEN")

        if not self.api_token:
            print("⚠️ REPLICATE_API_TOKEN not set - Replicate chord detection unavailable")
            self.available = False
            return

        self.available = True
        self.base_url = "https://api.replicate.com/v1"
        print("✅ Replicate BTC chord service ready")

    async def detect_chords(self, audio_path: str) -> List[Dict]:
        """
        Detect chords using Replicate's BTC model.

        Args:
            audio_path: Path to audio file

        Returns:
            List of chord detections:
            [
                {"chord": "C", "time": 0.5, "confidence": 0.95},
                {"chord": "Am", "time": 2.0, "confidence": 0.92},
                ...
            ]
        """
        if not self.available:
            print("❌ Replicate service not available")
            return []

        print("🚀 Calling Replicate BTC model for chord detection...")

        try:
            # Read and encode audio file as base64
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()
            audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

            # Determine mime type
            if audio_path.lower().endswith(".wav"):
                mime_type = "audio/wav"
            else:
                mime_type = "audio/mpeg"

            # Create data URI
            audio_uri = f"data:{mime_type};base64,{audio_base64}"

            # Create prediction
            async with httpx.AsyncClient(timeout=300.0) as client:
                # Start prediction
                response = await client.post(
                    f"{self.base_url}/predictions",
                    headers={
                        "Authorization": f"Token {self.api_token}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "version": self.MODEL_VERSION.split(":")[-1],
                        "input": {
                            "audio": audio_uri
                        }
                    }
                )
                response.raise_for_status()
                prediction = response.json()

                # Poll for completion
                prediction_url = prediction.get("urls", {}).get("get")
                if not prediction_url:
                    prediction_url = f"{self.base_url}/predictions/{prediction['id']}"

                # Wait for prediction to complete (max 5 minutes)
                max_attempts = 60
                for attempt in range(max_attempts):
                    status_response = await client.get(
                        prediction_url,
                        headers={"Authorization": f"Token {self.api_token}"}
                    )
                    status_response.raise_for_status()
                    status = status_response.json()

                    if status["status"] == "succeeded":
                        return self._parse_output(status.get("output", []))
                    elif status["status"] == "failed":
                        error = status.get("error", "Unknown error")
                        print(f"❌ Replicate prediction failed: {error}")
                        return []
                    elif status["status"] == "canceled":
                        print("❌ Replicate prediction was canceled")
                        return []

                    # Wait before polling again
                    await asyncio.sleep(5)

                print("❌ Replicate prediction timed out")
                return []

        except httpx.HTTPStatusError as e:
            print(f"❌ Replicate API error: {e.response.status_code} - {e.response.text}")
            return []
        except Exception as e:
            print(f"❌ Replicate chord detection failed: {e}")
            return []

    def _parse_output(self, output: any) -> List[Dict]:
        """
        Parse Replicate model output to standard chord format.

        The BTC model returns chord labels with timestamps.
        Format can vary, so we handle multiple possibilities.
        """
        chords = []

        # Handle string output (chord sequence with newlines)
        if isinstance(output, str):
            lines = output.strip().split("\n")
            for line in lines:
                parsed = self._parse_chord_line(line)
                if parsed:
                    chords.append(parsed)

        # Handle list output
        elif isinstance(output, list):
            for item in output:
                if isinstance(item, dict):
                    # Already in dict format
                    chord = item.get("chord") or item.get("label") or item.get("name")
                    time = item.get("time") or item.get("start") or item.get("timestamp", 0)
                    confidence = item.get("confidence") or item.get("score", 0.9)

                    if chord and chord not in ["N", "X", "unknown"]:
                        chords.append({
                            "chord": self._normalize_chord(chord),
                            "time": round(float(time), 2),
                            "confidence": round(float(confidence), 2)
                        })
                elif isinstance(item, str):
                    parsed = self._parse_chord_line(item)
                    if parsed:
                        chords.append(parsed)

        # Merge consecutive duplicate chords
        merged = []
        prev_chord = None
        for chord in chords:
            if chord["chord"] != prev_chord:
                merged.append(chord)
                prev_chord = chord["chord"]

        print(f"✅ Replicate detected {len(merged)} chord changes")
        return merged

    def _parse_chord_line(self, line: str) -> Optional[Dict]:
        """Parse a single line of chord output."""
        line = line.strip()
        if not line:
            return None

        # Try format: "0.5 C" or "0.5\tC" (time chord)
        parts = line.replace("\t", " ").split()
        if len(parts) >= 2:
            try:
                time = float(parts[0])
                chord = parts[1]
                if chord not in ["N", "X", "unknown"]:
                    return {
                        "chord": self._normalize_chord(chord),
                        "time": round(time, 2),
                        "confidence": 0.9
                    }
            except ValueError:
                pass

        # Try format: "C 0.5" (chord time)
        if len(parts) >= 2:
            try:
                time = float(parts[-1])
                chord = parts[0]
                if chord not in ["N", "X", "unknown"]:
                    return {
                        "chord": self._normalize_chord(chord),
                        "time": round(time, 2),
                        "confidence": 0.9
                    }
            except ValueError:
                pass

        return None

    def _normalize_chord(self, chord: str) -> str:
        """
        Normalize chord notation to standard format.

        Handles various formats:
        - "C:maj" -> "C"
        - "A:min" -> "Am"
        - "G:7" -> "G7"
        - "D:min7" -> "Dm7"
        """
        if ":" not in chord:
            return chord

        parts = chord.split(":")
        root = parts[0]

        if len(parts) == 1:
            return root

        quality = parts[1].lower()

        # Convert to standard notation
        quality_map = {
            "maj": "",
            "major": "",
            "min": "m",
            "minor": "m",
            "7": "7",
            "maj7": "maj7",
            "min7": "m7",
            "dim": "dim",
            "dim7": "dim7",
            "aug": "aug",
            "sus4": "sus4",
            "sus2": "sus2",
            "add9": "add9",
            "9": "9",
            "11": "11",
            "13": "13"
        }

        suffix = quality_map.get(quality, quality)
        return root + suffix


# Singleton instance
_replicate_service = None


def get_replicate_service(api_token: Optional[str] = None) -> Optional[ReplicateChordService]:
    """Get or create ReplicateChordService singleton."""
    global _replicate_service

    if _replicate_service is None:
        _replicate_service = ReplicateChordService(api_token=api_token)

    if not _replicate_service.available:
        return None

    return _replicate_service

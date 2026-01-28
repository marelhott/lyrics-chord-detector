"""
Chord-to-lyric alignment service.
Aligns detected chords with specific words in the lyrics.
"""
from typing import List, Dict, Optional
import bisect


class AlignmentService:
    """Service for aligning chords with lyrics."""
    
    def __init__(self):
        """Initialize alignment service."""
        pass
    
    def align_chords_with_lyrics(
        self,
        segments: List[Dict],
        chords: List[Dict]
    ) -> List[Dict]:
        """
        Align chords with specific words in lyrics.
        Filters to show only SIGNIFICANT chord changes (not every tiny variation).
        
        Args:
            segments: Transcribed segments with word-level timestamps
            chords: Detected chords with timestamps
        
        Returns:
            List of aligned chords (filtered for significance)
        """
        if not chords or not segments:
            return []
        
        # First, filter chords to keep only significant changes
        filtered_chords = self._filter_significant_chords(chords)
        
        aligned = []
        
        for chord in filtered_chords:
            chord_time = chord["time"]
            
            # Find the segment containing this chord time
            segment_idx = self._find_segment_at_time(segments, chord_time)
            
            if segment_idx is None:
                # Chord is outside vocal range (intro/outro)
                aligned.append({
                    "chord": chord["chord"],
                    "time": chord["time"],
                    "word": None,
                    "word_index": None,
                    "line_index": None,
                    "segment_index": None,
                    "confidence": chord.get("confidence", 0.85),
                    "is_fundamental": self._is_fundamental_chord(chord["chord"])
                })
                continue
            
            segment = segments[segment_idx]
            
            # Find the word closest to this chord time
            word_data = self._find_closest_word(segment, chord_time)
            
            if word_data:
                aligned.append({
                    "chord": chord["chord"],
                    "time": chord["time"],
                    "word": word_data["word"],
                    "word_index": word_data["index"],
                    "line_index": 0,  # Will be calculated later in formatting
                    "segment_index": segment_idx,
                    "confidence": chord.get("confidence", 0.85),
                    "is_fundamental": self._is_fundamental_chord(chord["chord"])
                })
            else:
                # No words in segment (shouldn't happen, but handle it)
                aligned.append({
                    "chord": chord["chord"],
                    "time": chord["time"],
                    "word": None,
                    "word_index": None,
                    "line_index": None,
                    "segment_index": segment_idx,
                    "confidence": chord.get("confidence", 0.85),
                    "is_fundamental": self._is_fundamental_chord(chord["chord"])
                })
        
        return aligned
    
    def _filter_significant_chords(self, chords: List[Dict]) -> List[Dict]:
        """
        Filter chords to keep only significant changes.
        Removes redundant detections and minor variations.
        
        Args:
            chords: All detected chords
        
        Returns:
            Filtered list of significant chords only
        """
        if not chords:
            return []
        
        filtered = []
        last_chord = None
        last_time = -999
        
        for chord in chords:
            chord_name = chord["chord"]
            chord_time = chord["time"]
            
            # Skip if same chord detected within 0.5 seconds (likely duplicate detection)
            # Reduced from 2.0s to preserve legitimate quick chord changes
            if last_chord == chord_name and (chord_time - last_time) < 0.5:
                continue
            
            # Skip very complex/unusual chords (likely detection errors)
            if len(chord_name) > 5 or '**' in chord_name or '*' in chord_name:
                continue
            
            # Keep this chord
            filtered.append(chord)
            last_chord = chord_name
            last_time = chord_time
        
        return filtered
    
    def _find_segment_at_time(self, segments: List[Dict], time: float) -> Optional[int]:
        """
        Find the segment index that contains the given time.
        
        Args:
            segments: List of segments with start/end times
            time: Time to search for
        
        Returns:
            Index of segment, or None if not found
        """
        for i, segment in enumerate(segments):
            if segment["start"] <= time <= segment["end"]:
                return i
        
        return None
    
    def _find_closest_word(self, segment: Dict, time: float) -> Optional[Dict]:
        """
        Find the word in a segment closest to the given time.
        
        Args:
            segment: Segment with words array
            time: Time to search for
        
        Returns:
            Dict with word and index, or None if no words
        """
        words = segment.get("words", [])
        
        if not words:
            # No word-level data, return None
            return None
        
        # Find word with start time closest to chord time
        closest_word = None
        closest_distance = float('inf')
        closest_index = None
        
        for i, word in enumerate(words):
            word_start = word.get("start", segment["start"])
            distance = abs(word_start - time)
            
            if distance < closest_distance:
                closest_distance = distance
                closest_word = word.get("word", "")
                closest_index = i
        
        if closest_word:
            return {
                "word": closest_word,
                "index": closest_index
            }
        
        return None
    
    def format_ultimate_guitar_style(
        self,
        structure: List[Dict],
        aligned_chords: List[Dict],
        title: str = "Unknown Song",
        key: str = "Unknown"
    ) -> str:
        """
        Format lyrics and chords in Ultimate Guitar style.
        
        Args:
            structure: Song structure with sections and segments
            aligned_chords: Chords aligned with words
            title: Song title
            key: Song key (tonicity)
        
        Returns:
            Formatted text with chords above lyrics
        """
        output = []
        
        # Add Header with Title and Key
        output.append(f"Title: {title}")
        output.append(f"Key: {key}")
        output.append("")
        output.append("-" * 40)
        output.append("")
        
        for section in structure:
            # Section header
            section_type = section["type"].title()
            if section.get("number"):
                section_header = f"[{section_type} {section['number']}]"
            else:
                section_header = f"[{section_type}]"
            
            output.append(section_header)
            
            # Get segments in this section
            section_segments = section.get("segments", [])
            
            if not section_segments:
                # Empty section (intro/outro)
                # Show chords only
                section_chords = [
                    c for c in aligned_chords
                    if section["start"] <= c["time"] <= section["end"]
                ]
                if section_chords:
                    chord_line = "  ".join([self._format_chord(c["chord"]) for c in section_chords])
                    output.append(chord_line)
                output.append("")
                output.append("")  # Extra space
                output.append("")  # Extra space
                continue
            
            # Process each segment as a line
            for seg_idx, segment in enumerate(section_segments):
                # Get chords for this segment (by time range)
                segment_chords = [
                    c for c in aligned_chords
                    if segment["start"] <= c["time"] <= segment["end"]
                ]
                
                # Get words from segment
                words = segment.get("words", [])
                text = segment["text"].strip()
                
                if not words or not segment_chords:
                    # No word-level data or no chords - just show text
                    if segment_chords:
                        chord_line = "  ".join([self._format_chord(c["chord"]) for c in segment_chords])
                        output.append(chord_line)
                    output.append(text)
                else:
                    # Build chord line with proper positioning
                    chord_line = self._build_chord_line(text, words, segment_chords)
                    output.append(chord_line)
                    output.append(text)
                
                output.append("")  # Empty line between segments
            
            output.append("")  # Extra empty line between sections
            output.append("")  # Extra empty line between sections
            output.append("")  # Extra empty line between sections
        
        return "\n".join(output)
    
    def _is_fundamental_chord(self, chord: str) -> bool:
        """
        Check if a chord is fundamental (basic major/minor).
        
        Args:
            chord: Chord name
        
        Returns:
            True if fundamental, False otherwise
        """
        fundamental_chords = [
            'C', 'D', 'E', 'F', 'G', 'A', 'B',
            'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm'
        ]
        return chord in fundamental_chords
    
    def _format_chord(self, chord: str) -> str:
        """
        Format a chord for display.
        Just return the chord name - styling will be done in frontend.
        
        Args:
            chord: Chord name (e.g., "G", "C#", "Am7")
        
        Returns:
            Chord name (plain text)
        """
        # Remove any asterisks or weird characters
        chord = chord.replace('*', '').replace('**', '')
        return chord
    
    def _build_chord_line(
        self,
        text: str,
        words: List[Dict],
        chords: List[Dict]
    ) -> str:
        """
        Build a line with chords positioned PRECISELY above the correct words.
        This matches Ultimate Guitar format where chords appear exactly where they change.
        Fundamental chords are shown in BOLD.
        
        Args:
            text: The lyric line
            words: Word-level data with timestamps
            chords: Chords for this line with word alignment
        
        Returns:
            String with chords positioned above words (bold for fundamental)
        """
        if not chords or not words:
            return ""
        
        # Build a map of word positions in the text
        word_positions = []
        current_pos = 0
        
        for word_data in words:
            word_text = word_data.get("word", "").strip()
            if not word_text:
                continue
            
            # Find this word in the remaining text
            search_text = text[current_pos:].lower()
            word_lower = word_text.lower()
            
            # Handle punctuation - word might have it stripped
            word_clean = word_lower.strip('.,!?;:"\'-')
            
            # Try to find the word
            pos = search_text.find(word_clean)
            if pos == -1:
                # Try exact match
                pos = search_text.find(word_lower)
            
            if pos != -1:
                actual_pos = current_pos + pos
                word_positions.append({
                    "word": word_text,
                    "start": word_data.get("start"),
                    "position": actual_pos,
                    "length": len(word_text)
                })
                current_pos = actual_pos + len(word_text)
        
        # Create chord line (same length as text)
        chord_line = [" "] * len(text)

        # Track used word positions to avoid assigning multiple chords to same word occurrence
        used_positions = set()

        # Place each chord at the position of its aligned word
        for chord in chords:
            chord_word = chord.get("word")
            chord_name = chord.get("chord", "")

            if not chord_word or not chord_name:
                continue

            # Format the chord (bold if fundamental)
            chord_str = self._format_chord(chord_name)

            # Find the word position that matches this chord
            matching_pos = None
            for word_pos in word_positions:
                pos = word_pos["position"]
                if pos in used_positions:
                    continue  # Skip already used positions
                if word_pos["word"].lower().strip() == chord_word.lower().strip():
                    # Check if this is the right occurrence based on timestamp
                    if abs(word_pos.get("start", 0) - chord.get("time", 0)) < 1.0:
                        matching_pos = pos
                        used_positions.add(pos)
                        break

            if matching_pos is None:
                # Fallback: find any unused occurrence of the word
                for word_pos in word_positions:
                    pos = word_pos["position"]
                    if pos in used_positions:
                        continue
                    if word_pos["word"].lower().strip() == chord_word.lower().strip():
                        matching_pos = pos
                        used_positions.add(pos)
                        break

            if matching_pos is not None:
                # Place chord at this position
                # Make sure we don't overflow or overwrite other chords
                for i, char in enumerate(chord_str):
                    pos = matching_pos + i
                    if pos < len(chord_line):
                        # Only place if there's space (don't overwrite existing chords)
                        if chord_line[pos] == " ":
                            chord_line[pos] = char
        
        return "".join(chord_line).rstrip()


# Singleton instance
_alignment_service = None


def get_alignment_service() -> AlignmentService:
    """Get or create AlignmentService singleton."""
    global _alignment_service
    
    if _alignment_service is None:
        _alignment_service = AlignmentService()
    
    return _alignment_service

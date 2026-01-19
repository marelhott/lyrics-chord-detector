/**
 * Transforms the backend API response into the format expected by ResultScreen.
 * 
 * Backend format:
 * - structure: Array of sections { type: "intro", label: "[Intro]", start: 0.0, end: 15.0 }
 * - aligned_chords: Array of { chord: "C", time: 1.2, word: "Hello" }
 * - segments: Array of { text: "Hello world", start: 1.0, end: 3.0, words: [...] }
 * 
 * Target format (ResultScreen):
 * - sections: Array of { id: "section-0", name: "Intro" }
 * - lyrics: Object where key is section.id, value is Array of lines
 *   - line: { chords: ["C", "", "G"], words: ["Hello", "world", "again"] }
 */
export function transformSongData(backendData) {
  if (!backendData || !backendData.structure) return null;

  const sections = backendData.structure.map((section, index) => ({
    id: `section-${index}`,
    name: section.label || section.type || `Section ${index + 1}`,
    start: section.start,
    end: section.end,
    type: section.type
  }));

  const lyrics = {};

  sections.forEach((section) => {
    const sectionLines = [];
    
    // Find segments that fall into this section
    // We add a small buffer or check overlap
    const sectionSegments = backendData.segments.filter(seg => 
      (seg.start >= section.start && seg.start < section.end) || 
      (seg.end > section.start && seg.end <= section.end)
    );

    if (sectionSegments.length === 0) {
      // If no lyrics segments, might be instrumental (Intro/Outro)
      // Check for chords in this time range
      const sectionChords = backendData.aligned_chords.filter(chord => 
        chord.time >= section.start && chord.time < section.end
      );

      if (sectionChords.length > 0) {
        // Create an instrumental line
        sectionLines.push({
          chords: sectionChords.map(c => c.chord),
          words: sectionChords.map(() => "") // Empty words for instrumental
        });
      }
    } else {
      // Process each segment as a line
      sectionSegments.forEach(segment => {
        const lineWords = [];
        const lineChords = [];

        const segStart = segment.start;
        const segEnd = segment.end;
        
        const chordsInSeg = backendData.aligned_chords.filter(c => 
          c.time >= segStart && c.time < segEnd
        );
        
        // If we have words
        if (segment.words && segment.words.length > 0) {
          segment.words.forEach(w => {
            lineWords.push(w.word);
            
            // Find chord starting around this word
            const chord = chordsInSeg.find(c => 
              c.time >= w.start && c.time < w.end
            );
            lineChords.push(chord ? chord.chord : "");
          });
        } else {
          const words = segment.text.trim().split(/\s+/).filter(Boolean);
          const chordsText = chordsInSeg.length > 0 ? chordsInSeg.map(c => c.chord).join(" ") : "";

          if (words.length === 0) {
            lineWords.push(segment.text.trim());
            lineChords.push(chordsText);
          } else {
            words.forEach((w, i) => {
              lineWords.push(w);
              lineChords.push(i === 0 ? chordsText : "");
            });
          }
        }
        
        sectionLines.push({
          chords: lineChords,
          words: lineWords
        });
      });
    }

    lyrics[section.id] = sectionLines;
  });

  return { sections, lyrics };
}

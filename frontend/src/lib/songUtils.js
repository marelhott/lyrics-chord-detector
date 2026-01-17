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

  sections.forEach((section, index) => {
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

        // Get words from segment if available, otherwise split text
        const words = segment.words || segment.text.trim().split(/\s+/).map(w => ({ word: w }));

        words.forEach(wordObj => {
          const wordText = wordObj.word;
          lineWords.push(wordText);

          // Find chord associated with this word
          // The backend might associate chords with words. 
          // Check aligned_chords for matching time or explicit linkage if available.
          // The current aligned_chords structure in python service creates formatting but here we have raw data.
          // Let's look at aligned_chords data again. It has 'word' field if aligned.
          
          // Strategy: Find a chord that has this 'word' assigned or is closest in time
          const chord = backendData.aligned_chords.find(c => 
            (c.word === wordText && Math.abs(c.time - (wordObj.start || segment.start)) < 1.0) ||
            (c.time >= (wordObj.start || segment.start) && c.time < (wordObj.end || segment.end))
          );
          
          // We need a more robust mapping because multiple chords can be on one word? 
          // Or usually 1 chord per word change.
          // Ideally, we align chords to words 1:1 for the grid.
          
          // For now, simple matching:
          // Filter chords in this line's timeframe
          
        });
        
        // Alternative simple approach relying on backend alignment if possible:
        // But backend sends flat lists.
        
        // Let's reconstruct lines based on segments.
        // For each segment:
        // 1. Get text/words.
        // 2. Get chords that fall into segment timeframe.
        // 3. Align them in a grid.
        
        // Improved logic:
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
          // Fallback if no word timestamps: split by space and distribute chords evenly?
          // Or just put chords at start.
          const textParam = segment.text.trim();
          lineWords.push(textParam);
          lineChords.push(chordsInSeg.length > 0 ? chordsInSeg.map(c => c.chord).join(" ") : "");
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

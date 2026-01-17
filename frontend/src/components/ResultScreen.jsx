import { useState, useMemo } from 'react';
import { FileText, FileDown, FileJson, Plus, Minus, ChevronRight, ArrowLeft, Download } from 'lucide-react';

// Adapter to transform generic songData into the component's expected format
function useAdaptedData(songData) {
  return useMemo(() => {
    if (!songData || !songData.sections) return [];

    return songData.sections.map(section => {
      const sectionId = section.id;
      // Get lines for this section from the lyrics map
      const rawLines = songData.lyrics[sectionId] || [];

      const lines = rawLines.map(line => {
        // Line structure: { words: ["Hello", "world"], chords: ["C", "", "G"] }
        // Component expects: { lyrics: "Hello world", chords: ["C", "G"], positions: [0, 6] }
        // This position mapping is tricky because we need character indices.
        // Let's approximate positions based on word lengths if we don't have exact char indices.

        let currentText = "";
        let chordsList = [];
        let positionsList = [];

        // Helper to build line text and positions
        line.words.forEach((word, idx) => {
          const startPos = currentText.length;
          const chord = line.chords[idx];

          if (chord) {
            chordsList.push(chord);
            positionsList.push(startPos);
          }

          currentText += word + " ";
        });

        return {
          lyrics: currentText.trim(),
          chords: chordsList,
          positions: positionsList
        };
      });

      return {
        section: section.name,
        lines: lines
      };
    });
  }, [songData]);
}

export function ResultsScreen({ fileName, songData, onExport, onNewAnalysis }) {
  const [selectedSection, setSelectedSection] = useState(null);
  const [showChords, setShowChords] = useState(true);
  const [fontSize, setFontSize] = useState(16);

  const lyricsData = useAdaptedData(songData);

  // Derive song structure names from the adapted data
  const songStructure = lyricsData.map(s => s.section);

  // Calculate stats for each section
  const getSectionStats = (sectionName) => {
    // Note: multiple sections might have same name (Chorus), so we filter all of them
    // But reference UI treats them as distinct items in nav? 
    // The reference `songStructure` array was just strings. If we have duplicate names, 
    // we need to be careful with keys. 
    // My adapted `lyricsData` is an array corresponding 1:1 to sections.
    // So we should find the specific section index from the nav map.

    // For simplicity, let's filter by name as in original code
    const sectionItems = lyricsData.filter(s => s.section === sectionName);

    const totalWords = sectionItems.reduce((acc, s) =>
      acc + s.lines.reduce((wordAcc, line) =>
        wordAcc + line.lyrics.split(' ').length, 0), 0);

    const totalChords = sectionItems.reduce((acc, s) =>
      acc + s.lines.reduce((chordAcc, line) =>
        chordAcc + line.chords.length, 0), 0);

    return { words: totalWords, chords: totalChords };
  };

  // Calculate total stats
  const totalStats = useMemo(() => {
    const totalWords = lyricsData.reduce((acc, s) =>
      acc + s.lines.reduce((wordAcc, line) =>
        wordAcc + line.lyrics.split(' ').length, 0), 0);

    const totalChords = lyricsData.reduce((acc, s) =>
      acc + s.lines.reduce((chordAcc, line) =>
        chordAcc + line.chords.length, 0), 0);

    const allChords = lyricsData.reduce((acc, s) => {
      s.lines.forEach(line => {
        line.chords.forEach(chord => acc.add(chord));
      });
      return acc;
    }, new Set());

    return {
      words: totalWords,
      chords: totalChords,
      uniqueChords: Array.from(allChords).sort()
    };
  }, [lyricsData]);

  // Handle section clicking - toggle off if same clicked
  const handleSectionClick = (sectionName) => {
    if (selectedSection === sectionName) {
      setSelectedSection(null);
    } else {
      setSelectedSection(sectionName);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0f0d] text-white font-sans">
      {/* Top Action Bar */}
      <header className="border-b border-[#1a2520] px-8 py-4 bg-[#0a0f0d]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onNewAnalysis}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#a4e887]"></div>
              <h1 className="text-white text-lg font-medium">
                {fileName || 'Untitled song'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onExport}
              className="px-4 py-2 bg-[#0f1612] border border-[#1a2520] text-gray-300 rounded-lg hover:border-[#2a3530] transition-all text-sm flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Export TXT
            </button>
            <button
              onClick={onExport}
              className="px-4 py-2 bg-[#0f1612] border border-[#1a2520] text-gray-300 rounded-lg hover:border-[#2a3530] transition-all text-sm flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={onExport}
              className="px-4 py-2 bg-[#0f1612] border border-[#1a2520] text-gray-300 rounded-lg hover:border-[#2a3530] transition-all text-sm flex items-center gap-2"
            >
              <FileJson className="w-4 h-4" />
              Export JSON
            </button>
            <button
              onClick={onNewAnalysis}
              className="px-4 py-2 bg-[#a4e887] text-[#0a0f0d] rounded-lg hover:bg-[#b5f497] transition-all text-sm font-medium"
            >
              New analysis
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Song Structure */}
        <aside className="w-64 border-r border-[#1a2520] bg-[#0a0f0d] p-6 overflow-y-auto">
          <h2 className="text-gray-400 text-xs font-medium mb-4 tracking-wide">SONG STRUCTURE</h2>
          <nav className="space-y-1">
            {/* 
              Note: if duplicate section names exist (e.g. Chorus appearing multiple times),
              mapping by index is safer for rendering the list, but logic uses name for selection.
            */}
            {lyricsData.map((sectionData, index) => {
              const sectionName = sectionData.section;
              // We calculate stats specific to this INSTANCE of the section for the sidebar?
              // The original code calculated stats for ALL sections with that name.
              // Let's stick to original behavior (summing by name) for the stats.
              const stats = getSectionStats(sectionName);

              return (
                <button
                  key={`${sectionName}-${index}`}
                  onClick={() => handleSectionClick(sectionName)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all group ${selectedSection === sectionName
                      ? 'bg-[#1a2520] text-[#a4e887]'
                      : 'text-gray-400 hover:bg-[#0f1612] hover:text-white'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{sectionName}</span>
                    {selectedSection === sectionName && (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    {/* These stats are aggregated for all sections with this name */}
                    <span>{stats.words} words</span>
                    <span>·</span>
                    <span>{stats.chords} chords</span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Total Stats Section */}
          <div className="mt-8 pt-6 border-t border-[#1a2520]">
            <h2 className="text-gray-400 text-xs font-medium mb-4 tracking-wide">TOTAL STATS</h2>

            <div className="bg-[#0f1612] border border-[#1a2520] rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="text-2xl font-bold text-white">{totalStats.words}</div>
                  <div className="text-xs text-gray-500">Total Words</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#a4e887]">{totalStats.chords}</div>
                  <div className="text-xs text-gray-500">Total Chords</div>
                </div>
              </div>
            </div>

            <div className="bg-[#0f1612] border border-[#1a2520] rounded-lg p-4">
              <h3 className="text-xs font-medium text-gray-400 mb-3 tracking-wide">CHORDS USED</h3>
              <div className="flex flex-wrap gap-2">
                {totalStats.uniqueChords.map((chord) => (
                  <span
                    key={chord}
                    className="px-2.5 py-1.5 bg-[#1a2520] border border-[#2a3530] rounded text-[#a4e887] text-sm font-mono font-medium hover:bg-[#2a3530] transition-colors"
                  >
                    {chord}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Panel - Lyrics + Chords Viewer */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Controls */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#1a2520]">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowChords(!showChords)}
                  className={`px-4 py-2 rounded-lg border transition-all text-sm ${showChords
                      ? 'bg-[#1a2520] border-[#a4e887] text-[#a4e887]'
                      : 'bg-[#0f1612] border-[#1a2520] text-gray-400 hover:border-[#2a3530]'
                    }`}
                >
                  {showChords ? 'Hide chords' : 'Show chords'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm mr-2">Font size:</span>
                <button
                  onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
                  className="w-8 h-8 rounded-lg bg-[#0f1612] border border-[#1a2520] text-gray-300 hover:border-[#2a3530] transition-all flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setFontSize(prev => Math.min(24, prev + 2))}
                  className="w-8 h-8 rounded-lg bg-[#0f1612] border border-[#1a2520] text-gray-300 hover:border-[#2a3530] transition-all flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lyrics Content */}
            <div className="space-y-12">
              {lyricsData.map((section, sectionIndex) => (
                <div
                  key={sectionIndex}
                  className={`transition-all ${selectedSection === null || selectedSection === section.section
                      ? 'opacity-100'
                      : 'opacity-30'
                    }`}
                >
                  <h3 className="text-[#a4e887] font-medium mb-6 text-sm tracking-wide uppercase">
                    {section.section}
                  </h3>
                  <div className="space-y-6 font-mono">
                    {section.lines.map((line, lineIndex) => (
                      <div key={lineIndex} className="relative">
                        {showChords && (
                          <div className="mb-1 relative" style={{ fontSize: `${fontSize}px`, height: `${fontSize + 8}px` }}>
                            {line.chords.map((chord, chordIndex) => (
                              <span
                                key={chordIndex}
                                className="absolute px-2 py-0.5 bg-[#0f1612] border border-[#1a2520] rounded text-[#a4e887] inline-block whitespace-nowrap"
                                style={{
                                  left: `${line.positions[chordIndex] * 0.6}em`,
                                  fontSize: `${fontSize}px`
                                }}
                              >
                                {chord}
                              </span>
                            ))}
                          </div>
                        )}
                        <div
                          className="text-gray-300 whitespace-pre"
                          style={{ fontSize: `${fontSize}px` }}
                        >
                          {line.lyrics}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

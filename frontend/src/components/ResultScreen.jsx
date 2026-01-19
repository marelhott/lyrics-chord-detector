import { useState, useMemo } from 'react';
import { FileText, FileDown, FileJson, Plus, Minus, ChevronRight, ArrowLeft } from 'lucide-react';
import UltimateGuitarPreview from './UltimateGuitarPreview';

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

export function ResultsScreen({ fileName, songData, rawResult, onExport, onNewAnalysis }) {
  const [selectedSection, setSelectedSection] = useState(null);
  const [showChords, setShowChords] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [viewMode, setViewMode] = useState(rawResult?.formatted_output ? 'ug' : 'structured');

  const lyricsData = useAdaptedData(songData);

  // Calculate stats for each section
  const getSectionStats = (sectionName) => {
    const sectionItems = lyricsData.filter(s => s.section === sectionName);

    const totalWords = sectionItems.reduce((acc, s) =>
      acc + s.lines.reduce((wordAcc, line) =>
        wordAcc + line.lyrics.split(' ').filter(w => w.trim()).length, 0), 0);

    // Count unique chords only
    const uniqueChords = new Set();
    sectionItems.forEach(s => {
      s.lines.forEach(line => {
        line.chords.forEach(chord => uniqueChords.add(chord));
      });
    });

    return { words: totalWords, chords: uniqueChords.size };
  };

  // Calculate total stats
  const totalStats = useMemo(() => {
    const totalWords = lyricsData.reduce((acc, s) =>
      acc + s.lines.reduce((wordAcc, line) =>
        wordAcc + line.lyrics.split(' ').filter(w => w.trim()).length, 0), 0);

    const allChords = lyricsData.reduce((acc, s) => {
      s.lines.forEach(line => {
        line.chords.forEach(chord => acc.add(chord));
      });
      return acc;
    }, new Set());

    return {
      words: totalWords,
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
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Top Action Bar */}
      <header className="border-b border-border px-8 py-4 bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onNewAnalysis}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <h1 className="text-foreground text-lg font-medium">
                {fileName || 'Untitled song'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onExport('txt')}
              className="px-4 py-2 bg-card border border-border text-muted-foreground rounded-lg hover:border-primary/50 transition-all text-sm flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Export TXT
            </button>
            <button
              onClick={() => onExport('pdf')}
              className="px-4 py-2 bg-card border border-border text-muted-foreground rounded-lg hover:border-primary/50 transition-all text-sm flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={() => onExport('json')}
              className="px-4 py-2 bg-card border border-border text-muted-foreground rounded-lg hover:border-primary/50 transition-all text-sm flex items-center gap-2"
            >
              <FileJson className="w-4 h-4" />
              Export JSON
            </button>
            <button
              onClick={onNewAnalysis}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all text-sm font-medium"
            >
              New analysis
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Song Structure */}
        <aside className="w-64 border-r border-border bg-background p-6 overflow-y-auto">
          <h2 className="text-muted-foreground text-xs font-medium mb-4 tracking-wide">SONG STRUCTURE</h2>
          <div className="space-y-2">
            {lyricsData.map((sectionData, index) => (
              <div key={index} className="flex items-center gap-2">
                <button
                  onClick={() => handleSectionClick(sectionData.section)}
                  className={`text-sm font-medium transition-colors ${selectedSection === sectionData.section
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {sectionData.section}
                </button>
                {index < lyricsData.length - 1 && (
                  <span className="text-muted-foreground/40">↓</span>
                )}
              </div>
            ))}
          </div>

          {/* Total Stats Section */}
          <div className="mt-8 pt-6 border-t border-border">
            <h2 className="text-muted-foreground text-xs font-medium mb-4 tracking-wide">STATISTICS</h2>

            <div className="bg-card border border-border rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="text-2xl font-bold text-foreground">{totalStats.words}</div>
                  <div className="text-xs text-muted-foreground">Words</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{totalStats.uniqueChords.length}</div>
                  <div className="text-xs text-muted-foreground">Unique Chords</div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-3 tracking-wide">CHORDS USED</h3>
              <div className="flex flex-wrap gap-2">
                {totalStats.uniqueChords.map((chord) => (
                  <span
                    key={chord}
                    className="px-2.5 py-1.5 bg-muted border border-border rounded text-primary text-sm font-mono font-medium hover:bg-muted/80 transition-colors"
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
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
              <div className="flex items-center gap-4">
                {rawResult?.formatted_output && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewMode('ug')}
                      className={`px-4 py-2 rounded-lg border transition-all text-sm ${viewMode === 'ug'
                        ? 'bg-muted border-primary text-primary'
                        : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                        }`}
                    >
                      Formatted
                    </button>
                    <button
                      onClick={() => setViewMode('structured')}
                      className={`px-4 py-2 rounded-lg border transition-all text-sm ${viewMode === 'structured'
                        ? 'bg-muted border-primary text-primary'
                        : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                        }`}
                    >
                      Structured
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setShowChords(!showChords)}
                  className={`px-4 py-2 rounded-lg border transition-all text-sm ${showChords
                    ? 'bg-muted border-primary text-primary'
                    : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                    }`}
                >
                  {showChords ? 'Hide chords' : 'Show chords'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm mr-2">Font size:</span>
                <button
                  onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
                  className="w-8 h-8 rounded-lg bg-card border border-border text-muted-foreground hover:border-primary/50 transition-all flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setFontSize(prev => Math.min(24, prev + 2))}
                  className="w-8 h-8 rounded-lg bg-card border border-border text-muted-foreground hover:border-primary/50 transition-all flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {viewMode === 'ug' && rawResult?.formatted_output ? (
              <UltimateGuitarPreview result={rawResult} />
            ) : (
              <div className="space-y-12">
                {lyricsData.map((section, sectionIndex) => (
                  <div
                    key={sectionIndex}
                    className={`transition-all ${selectedSection === null || selectedSection === section.section
                      ? 'opacity-100'
                      : 'opacity-30'
                      }`}
                  >
                    <h3 className="text-primary font-medium mb-6 text-sm tracking-wide uppercase">
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
                                  className="absolute px-2.5 py-1 bg-card border border-border rounded-md text-primary inline-block whitespace-nowrap font-medium"
                                  style={{
                                    left: `${line.positions[chordIndex] * 0.6}em`,
                                    fontSize: `${Math.max(12, fontSize - 2)}px`,
                                    minWidth: '2.5em',
                                    textAlign: 'center'
                                  }}
                                >
                                  {chord}
                                </span>
                              ))}
                            </div>
                          )}
                          <div
                            className="text-foreground/80 whitespace-pre"
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
            )}
          </div>
        </main>
      </div>
    </div>
  );
}


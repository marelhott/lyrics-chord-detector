import React from 'react';

// Simple chord diagram component
export function ChordDiagram({ chord }) {
    // Basic chord fingering data (simplified)
    const chordShapes = {
        'C': { fingers: [0, 3, 2, 0, 1, 0], name: 'C' },
        'D': { fingers: [-1, -1, 0, 2, 3, 2], name: 'D' },
        'E': { fingers: [0, 2, 2, 1, 0, 0], name: 'E' },
        'F': { fingers: [1, 3, 3, 2, 1, 1], name: 'F', barre: 1 },
        'G': { fingers: [3, 2, 0, 0, 0, 3], name: 'G' },
        'A': { fingers: [-1, 0, 2, 2, 2, 0], name: 'A' },
        'B': { fingers: [-1, 2, 4, 4, 4, 2], name: 'B', barre: 2 },
        'Am': { fingers: [-1, 0, 2, 2, 1, 0], name: 'Am' },
        'Dm': { fingers: [-1, -1, 0, 2, 3, 1], name: 'Dm' },
        'Em': { fingers: [0, 2, 2, 0, 0, 0], name: 'Em' },
        'Fm': { fingers: [1, 3, 3, 1, 1, 1], name: 'Fm', barre: 1 },
        'Gm': { fingers: [3, 5, 5, 3, 3, 3], name: 'Gm', barre: 3 },
    };

    // Normalize chord name (remove variations like 7, maj7, etc for now)
    const baseChord = chord.replace(/[0-9]/g, '').replace('maj', '').replace('sus', '');
    const shape = chordShapes[baseChord];

    if (!shape) {
        // Fallback for unknown chords - just show the name
        return (
            <div className="flex flex-col items-center p-2">
                <div className="text-xs font-mono font-bold text-primary mb-1">{chord}</div>
                <div className="text-[10px] text-muted-foreground">No diagram</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center p-2 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors">
            <div className="text-xs font-mono font-bold text-primary mb-2">{chord}</div>
            <svg width="50" height="60" viewBox="0 0 50 60" className="text-foreground">
                {/* Fret lines */}
                {[0, 1, 2, 3, 4].map(fret => (
                    <line
                        key={`fret-${fret}`}
                        x1="5"
                        y1={10 + fret * 10}
                        x2="45"
                        y2={10 + fret * 10}
                        stroke="currentColor"
                        strokeWidth={fret === 0 ? "2" : "1"}
                        opacity="0.3"
                    />
                ))}

                {/* String lines */}
                {[0, 1, 2, 3, 4, 5].map(string => (
                    <line
                        key={`string-${string}`}
                        x1={5 + string * 8}
                        y1="10"
                        x2={5 + string * 8}
                        y2="50"
                        stroke="currentColor"
                        strokeWidth="1"
                        opacity="0.3"
                    />
                ))}

                {/* Finger positions */}
                {shape.fingers.map((fret, stringIndex) => {
                    if (fret === -1) {
                        // X mark for muted string
                        return (
                            <text
                                key={`finger-${stringIndex}`}
                                x={5 + stringIndex * 8}
                                y="7"
                                fontSize="8"
                                fill="currentColor"
                                textAnchor="middle"
                                opacity="0.5"
                            >
                                ×
                            </text>
                        );
                    } else if (fret === 0) {
                        // O mark for open string
                        return (
                            <circle
                                key={`finger-${stringIndex}`}
                                cx={5 + stringIndex * 8}
                                cy="5"
                                r="2.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1"
                                opacity="0.5"
                            />
                        );
                    } else {
                        // Filled circle for fretted note
                        return (
                            <circle
                                key={`finger-${stringIndex}`}
                                cx={5 + stringIndex * 8}
                                cy={10 + (fret - 0.5) * 10}
                                r="3"
                                fill="hsl(var(--primary))"
                            />
                        );
                    }
                })}
            </svg>
        </div>
    );
}

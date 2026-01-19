/**
 * Ultimate Guitar style preview component
 * Displays lyrics with chords positioned above the correct words
 */
import { useState } from 'react'

// Helper function to check if a chord is fundamental
function isFundamentalChord(chord) {
    const fundamental = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm']
    return fundamental.includes(chord)
}

// Helper function to check if a token is a valid chord
function isValidChordToken(token) {
    // Ignore empty tokens or purely whitespace/symbols that might separate chords
    if (!token || !token.trim()) return true

    // Strict regex for valid chord
    // Must start with A-G
    // Optional # or b
    // Optional suffix (m, maj, min, dim, sus, aug, add, 5, 6, 7, 9, 11, 13)
    // Optional bass note (/C, etc.)
    return /^[A-G](#|b)?(m|maj|min|sus|dim|aug|add|5|6|7|9|11|13)*(\/[A-G](#|b)?)?$/.test(token)
}

// Helper function to render chord lines with styled chord boxes
function renderChordLine(line, fontSize) {
    // Handle Metadata headers (Title, Key)
    if (line.startsWith('Title:')) {
        return <span className="font-bold text-primary text-xl">{line}</span>
    }
    if (line.startsWith('Key:')) {
        return <span className="font-semibold text-primary">{line}</span>
    }

    // 1. Strict check: Is this purely a chord line?
    // Split by whitespace to get tokens
    const tokens = line.trim().split(/\s+/)

    // If the line has NO tokens, it's empty
    if (tokens.length === 0) return <span>{line}</span>

    // Check if ALL tokens are valid chords
    // Exception: Section headers like [Chorus] are NOT chords
    if (line.trim().startsWith('[')) {
        return <span className="font-bold text-primary/80">{line}</span>
    }

    const areAllTokensChords = tokens.every(token => isValidChordToken(token))

    // If not all tokens are chords, treat as lyric line
    if (!areAllTokensChords) {
        return <span className="text-foreground">{line}</span>
    }

    // This IS a chord line - parse and render chords
    const chords = []
    let currentPos = 0
    const chordRegex = /[A-G](#|b)?(m|maj|min|sus|dim|aug|add|5|6|7|9|11|13)*(\/[A-G](#|b)?)?/g
    let match

    while ((match = chordRegex.exec(line)) !== null) {
        const chord = match[0]
        const position = match.index

        // Skip if match is empty
        if (!chord) continue;

        // Add spacing before chord
        if (position > currentPos) {
            chords.push(
                <span key={`space-${currentPos}`} style={{ whiteSpace: 'pre' }}>
                    {line.substring(currentPos, position)}
                </span>
            )
        }

        // Add chord in a box
        const isFundamental = isFundamentalChord(chord)
        chords.push(
            <span
                key={`chord-${position}`}
                className={`inline-block px-2 py-1 mx-0.5 rounded-lg border ${isFundamental
                    ? 'bg-primary/20 text-primary border-primary/30 font-bold'
                    : 'bg-muted border-border text-muted-foreground font-semibold'
                    }`}
                style={{ fontSize: fontSize === 'text-xs' ? '11px' : fontSize === 'text-sm' ? '12px' : '13px' }}
            >
                {chord}
            </span>
        )

        currentPos = position + chord.length
    }

    // Add remaining text
    if (currentPos < line.length) {
        chords.push(
            <span key={`end-${currentPos}`} style={{ whiteSpace: 'pre' }}>
                {line.substring(currentPos)}
            </span>
        )
    }

    return <>{chords}</>
}

export default function UltimateGuitarPreview({ result }) {
    const [fontSize, setFontSize] = useState('text-sm')

    if (!result || !result.structure) {
        return null
    }

    const { structure, formatted_output } = result

    // If we have formatted output from backend, use it
    if (formatted_output) {
        // Split into lines and render with styled chords
        const lines = formatted_output.split('\n')

        return (
            <div className="bg-card rounded-2xl overflow-hidden shadow-lg border border-border">
                {/* Header */}
                <div className="bg-muted/50 border-b border-border px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <span className="text-sm font-bold text-primary uppercase tracking-wider">
                            Lyrics & Chords
                        </span>
                    </div>

                    {/* Font size controls */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Size:</span>
                        <select
                            value={fontSize}
                            onChange={(e) => setFontSize(e.target.value)}
                            className="text-xs font-semibold px-3 py-1.5 bg-background border border-border rounded-lg text-foreground cursor-pointer hover:border-primary/50 transition-colors"
                        >
                            <option value="text-xs">Small</option>
                            <option value="text-sm">Medium</option>
                            <option value="text-base">Large</option>
                        </select>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 overflow-x-auto custom-scrollbar">
                    <div className={`font-mono ${fontSize} leading-loose text-foreground`}>
                        {lines.map((line, idx) => (
                            <div key={idx} className="whitespace-pre min-h-[1.8em]">
                                {renderChordLine(line, fontSize)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // Fallback: Render structure manually
    return (
        <div className="bg-card rounded-2xl overflow-hidden shadow-lg border border-border">
            <div className="bg-muted/50 border-b border-border px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                    </div>
                    <span className="text-sm font-bold text-primary uppercase tracking-wider">
                        Song Structure
                    </span>
                </div>
            </div>

            <div className="p-8 space-y-8">
                {structure.map((section, idx) => (
                    <div key={idx} className="space-y-3">
                        {/* Section header */}
                        <h3 className="text-base font-bold text-primary uppercase tracking-wide flex items-center gap-2">
                            <div className="w-1 h-4 bg-primary rounded-full"></div>
                            [{section.type}{section.number ? ` ${section.number}` : ''}]
                        </h3>

                        {/* Section content */}
                        {section.segments && section.segments.length > 0 ? (
                            <div className="space-y-2 pl-4">
                                {section.segments.map((segment, segIdx) => (
                                    <p key={segIdx} className="text-sm text-foreground/80 leading-relaxed">
                                        {segment.text}
                                    </p>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic pl-4">Instrumental</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}


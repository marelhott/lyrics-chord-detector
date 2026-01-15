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
        return <span className="font-bold text-monstera-900 text-lg">{line}</span>
    }
    if (line.startsWith('Key:')) {
        return <span className="font-semibold text-monstera-700">{line}</span>
    }

    // 1. Strict check: Is this purely a chord line?
    // Split by whitespace to get tokens
    const tokens = line.trim().split(/\s+/)

    // If the line has NO tokens, it's empty
    if (tokens.length === 0) return <span>{line}</span>

    // Check if ALL tokens are valid chords
    // Exception: Section headers like [Chorus] are NOT chords
    if (line.trim().startsWith('[')) {
        return <span className="font-bold text-monstera-900">{line}</span>
    }

    const areAllTokensChords = tokens.every(token => isValidChordToken(token))

    // If not all tokens are chords, treat as lyric line
    if (!areAllTokensChords) {
        return <span>{line}</span>
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
                className={`inline-block px-1.5 py-0.5 mx-0.5 rounded border ${isFundamental
                    ? 'bg-monstera-100 border-monstera-400 text-monstera-900 font-black'
                    : 'bg-gray-50 border-gray-300 text-gray-600 font-semibold'
                    }`}
                style={{ fontSize: fontSize === 'text-xs' ? '10px' : fontSize === 'text-sm' ? '11px' : '12px' }}
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
            <div className="bg-white border border-monstera-200 rounded-md overflow-hidden shadow-sm">
                {/* Header */}
                <div className="bg-monstera-50 border-b border-monstera-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-monstera-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        <span className="text-xs font-black text-monstera-800 uppercase tracking-widest">
                            Lyrics & Chords
                        </span>
                    </div>

                    {/* Font size controls */}
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-monstera-600 uppercase tracking-wide">Velikost:</span>
                        <select
                            value={fontSize}
                            onChange={(e) => setFontSize(e.target.value)}
                            className="text-[10px] font-bold px-2 py-1 border border-monstera-200 rounded bg-white text-monstera-800"
                        >
                            <option value="text-xs">Malá</option>
                            <option value="text-sm">Střední</option>
                            <option value="text-base">Velká</option>
                        </select>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-x-auto">
                    <div className={`font-mono ${fontSize} leading-relaxed text-ink`}>
                        {lines.map((line, idx) => (
                            <div key={idx} className="whitespace-pre min-h-[1.5em]">
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
        <div className="bg-white border border-monstera-200 rounded-md overflow-hidden shadow-sm">
            <div className="bg-monstera-50 border-b border-monstera-200 px-4 py-3">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-monstera-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <span className="text-xs font-black text-monstera-800 uppercase tracking-widest">
                        Song Structure
                    </span>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {structure.map((section, idx) => (
                    <div key={idx} className="space-y-2">
                        {/* Section header */}
                        <h3 className="text-sm font-black text-monstera-800 uppercase tracking-wide">
                            [{section.type}{section.number ? ` ${section.number}` : ''}]
                        </h3>

                        {/* Section content */}
                        {section.segments && section.segments.length > 0 ? (
                            <div className="space-y-1">
                                {section.segments.map((segment, segIdx) => (
                                    <p key={segIdx} className="text-sm text-ink leading-relaxed">
                                        {segment.text}
                                    </p>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-monstera-400 italic">Instrumental</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

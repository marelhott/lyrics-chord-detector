/**
 * Demo Preview Component
 * Shows blurred/blocked preview with unlock button
 */
import { useState } from 'react'

// Helper to check if chord is fundamental
function isFundamentalChord(chord) {
    const fundamental = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm']
    return fundamental.includes(chord)
}

export default function DemoPreview({ result, onUnlock }) {
    const [fontSize, setFontSize] = useState('text-sm')

    if (!result || !result.formatted_output) {
        return null
    }

    const lines = result.formatted_output.split('\n')

    // Render chord with blur effect
    const renderBlurredChord = (chord) => {
        const isFundamental = isFundamentalChord(chord)
        return (
            <span
                className={`inline-block px-1.5 py-0.5 mx-0.5 rounded border blur-sm opacity-60 select-none ${isFundamental
                    ? 'bg-monstera-100 border-monstera-400 text-monstera-900 font-black'
                    : 'bg-gray-50 border-gray-300 text-gray-600 font-semibold'
                    }`}
                style={{ fontSize: fontSize === 'text-xs' ? '10px' : fontSize === 'text-sm' ? '11px' : '12px' }}
            >
                {chord}
            </span>
        )
    }

    // Render lyrics - show first verse fully, then block rest
    const renderBlockedLyrics = (text, lineIndex) => {
        if (!text || text.trim().startsWith('[') || text.trim() === '') {
            return <span>{text}</span>
        }

        // Show first 6 lines of lyrics completely (roughly first verse)
        if (lineIndex < 15) {
            return <span>{text}</span>
        }

        // After first verse, show first 2 words then block
        const words = text.split(' ')
        if (words.length <= 2) {
            return <span>{text}</span>
        }

        return (
            <>
                {words.slice(0, 2).join(' ')}
                {' '}
                <span className="inline-block bg-black text-black select-none rounded px-1">
                    {words.slice(2).join(' ')}
                </span>
            </>
        )
    }

    // Check if line contains chords
    const isChordLine = (line) => {
        if (line.startsWith('Title:') || line.startsWith('Key:') || line.trim().startsWith('[')) {
            return false
        }
        const tokens = line.trim().split(/\s+/)
        if (tokens.length === 0) return false

        // Simple check: if most tokens look like chords
        const chordPattern = /^[A-G](#|b)?(m|maj|min|sus|dim|aug|add|5|6|7|9|11|13)*(\/[A-G](#|b)?)?$/
        const chordCount = tokens.filter(t => chordPattern.test(t)).length
        return chordCount > 0 && chordCount / tokens.length > 0.5
    }

    // Render a single line
    const renderLine = (line, idx) => {
        // Title and Key - show normally
        if (line.startsWith('Title:')) {
            return <span className="font-bold text-monstera-900 text-lg">{line}</span>
        }
        if (line.startsWith('Key:')) {
            return <span className="font-semibold text-monstera-700">{line}</span>
        }

        // Section headers - show normally
        if (line.trim().startsWith('[')) {
            return <span className="font-bold text-monstera-900">{line}</span>
        }

        // Chord lines - blur them (except first 3)
        if (isChordLine(line)) {
            const chordRegex = /[A-G](#|b)?(m|maj|min|sus|dim|aug|add|5|6|7|9|11|13)*(\/[A-G](#|b)?)?/g
            const parts = []
            let lastIndex = 0
            let match
            let chordCount = 0

            while ((match = chordRegex.exec(line)) !== null) {
                // Add spacing before chord
                if (match.index > lastIndex) {
                    parts.push(
                        <span key={`space-${idx}-${lastIndex}`} style={{ whiteSpace: 'pre' }}>
                            {line.substring(lastIndex, match.index)}
                        </span>
                    )
                }

                // Add chord (clear or blurred based on index)
                parts.push(
                    <span key={`chord-${idx}-${match.index}`}>
                        {renderBlurredChord(match[0], chordCount)}
                    </span>
                )

                chordCount++
                lastIndex = match.index + match[0].length
            }

            // Add remaining text
            if (lastIndex < line.length) {
                parts.push(
                    <span key={`end-${idx}-${lastIndex}`} style={{ whiteSpace: 'pre' }}>
                        {line.substring(lastIndex)}
                    </span>
                )
            }

            return <>{parts}</>
        }

        // Lyrics lines - block after first verse
        return renderBlockedLyrics(line, idx)
    }

    return (
        <div className="bg-white border border-monstera-200 rounded-md overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-monstera-50 border-b border-monstera-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-monstera-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <span className="text-xs font-black text-monstera-800 uppercase tracking-widest">
                        Preview (30s)
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

            {/* Content with blur/block effects */}
            <div className="p-6 overflow-x-auto">
                <div className={`font-mono ${fontSize} leading-relaxed text-ink`}>
                    {lines.map((line, idx) => (
                        <div key={idx} className="whitespace-pre min-h-[1.5em]">
                            {renderLine(line, idx)}
                        </div>
                    ))}
                </div>
            </div>

            {/* Unlock CTA */}
            <div className="mx-6 mb-6 p-6 border-2 border-monstera-400 rounded-lg bg-gradient-to-br from-monstera-50 to-white">
                <div className="flex flex-col md:flex-row items-center gap-4">
                    {/* Lock icon */}
                    <div className="shrink-0">
                        <svg className="w-12 h-12 text-monstera-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>

                    {/* Text */}
                    <div className="flex-1 text-center md:text-left">
                        <p className="text-sm font-bold text-monstera-900 mb-1">
                            Unlock full lyrics & chords
                        </p>
                        <p className="text-3xl font-black text-monstera-900">
                            2,99 Kč
                        </p>
                    </div>

                    {/* Button */}
                    <button
                        onClick={onUnlock}
                        className="shrink-0 px-8 py-4 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white font-black text-sm uppercase tracking-wider rounded-lg shadow-lg hover:shadow-xl transition-all"
                    >
                        Pay with Stripe
                    </button>
                </div>

                {/* Benefits */}
                <div className="mt-4 pt-4 border-t border-monstera-200">
                    <p className="text-xs text-monstera-600 text-center">
                        ✓ Instant access • ✓ Secure payment • ✓ Download as PDF
                    </p>
                </div>
            </div>
        </div>
    )
}

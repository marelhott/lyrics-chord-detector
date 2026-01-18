/**
 * Demo Preview Component
 * Shows blurred/blocked preview with unlock button
 */
import { useState, useCallback } from 'react'
import { useMemo } from 'react'

// Helper to check if chord is fundamental
function isFundamentalChord(chord) {
    const fundamental = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm']
    return fundamental.includes(chord)
}

export default function DemoPreview({ result, onUnlock }) {
    const [fontSize, setFontSize] = useState('text-sm')

    const formattedOutput = result?.formatted_output || ''
    const lines = useMemo(() => (formattedOutput ? formattedOutput.split('\n') : []), [formattedOutput])

    // Render lyrics - show first verse fully, then block rest
    const renderBlockedLyrics = useCallback((text, lineIndex) => {
        if (!text || text.trim().startsWith('[') || text.trim() === '') {
            return <span key={lineIndex} className="text-neutral-200">{text}</span>
        }

        // Show first 6 lines of lyrics completely (roughly first verse)
        if (lineIndex < 15) {
            return <span key={lineIndex} className="text-neutral-200">{text}</span>
        }

        // After first verse, show first 2 words then block
        const words = text.split(' ')
        if (words.length <= 2) {
            return <span key={lineIndex} className="text-neutral-200">{text}</span>
        }

        return (
            <span key={lineIndex} className="text-neutral-200">
                {words.slice(0, 2).join(' ')}
                {' '}
                <span className="inline-block bg-neutral-900 text-neutral-900 select-none rounded px-1">
                    {words.slice(2).join(' ')}
                </span>
            </span>
        )
    }, [])

    // Check if line contains chords
    const isChordLine = useCallback((line) => {
        if (line.startsWith('Title:') || line.startsWith('Key:') || line.trim().startsWith('[')) {
            return false
        }
        const tokens = line.trim().split(/\s+/)
        if (tokens.length === 0) return false

        // Simple check: if most tokens look like chords
        const chordPattern = /^[A-G](#|b)?(m|maj|min|sus|dim|aug|add|5|6|7|9|11|13)*(\/[A-G](#|b)?)?$/
        const chordCount = tokens.filter(t => chordPattern.test(t)).length
        return chordCount > 0 && chordCount / tokens.length > 0.5
    }, [])

    const chordCountBeforeLine = useMemo(() => {
        const chordRegex = /[A-G](#|b)?(m|maj|min|sus|dim|aug|add|5|6|7|9|11|13)*(\/[A-G](#|b)?)?/g

        return lines.reduce(
            (state, line) => {
                const before = state.count
                const matches = isChordLine(line) ? line.match(chordRegex) : null
                const add = matches ? matches.length : 0
                return {
                    count: before + add,
                    arr: [...state.arr, before],
                }
            },
            { count: 0, arr: [] },
        ).arr
    }, [lines, isChordLine])

    // Render a single line with proper global chord counting
    const renderLine = useCallback((line, idx) => {
        // Title and Key - show normally
        if (line.startsWith('Title:')) {
            return <span key={idx} className="font-bold text-gradient text-xl">{line}</span>
        }
        if (line.startsWith('Key:')) {
            return <span key={idx} className="font-semibold text-accent-cyan">{line}</span>
        }

        // Section headers - show normally
        if (line.trim().startsWith('[')) {
            return <span key={idx} className="font-bold text-accent-purple">{line}</span>
        }

        // Chord lines - show first 3 chords clearly GLOBALLY
        if (isChordLine(line)) {
            const chordRegex = /[A-G](#|b)?(m|maj|min|sus|dim|aug|add|5|6|7|9|11|13)*(\/[A-G](#|b)?)?/g
            const parts = []
            let lastIndex = 0
            let match

            const baseChordIndex = chordCountBeforeLine[idx] || 0
            let localChordIndex = 0

            while ((match = chordRegex.exec(line)) !== null) {
                // Add spacing before chord
                if (match.index > lastIndex) {
                    parts.push(
                        <span key={`space-${idx}-${lastIndex}`} style={{ whiteSpace: 'pre' }}>
                            {line.substring(lastIndex, match.index)}
                        </span>
                    )
                }

                const currentChordIndex = baseChordIndex + localChordIndex
                const isFundamental = isFundamentalChord(match[0])
                const isVisible = currentChordIndex < 3

                // Render chord with appropriate styling
                parts.push(
                    <span
                        key={`chord-${idx}-${match.index}`}
                        className={`inline-block px-2 py-1 mx-0.5 rounded-lg border ${isFundamental
                            ? 'bg-gradient-to-br from-accent-purple to-accent-cyan text-white font-bold shadow-glow-sm border-accent-purple/30'
                            : 'glass border-neutral-600 text-neutral-300 font-semibold'
                            } ${!isVisible ? 'blur-sm opacity-40 select-none' : ''}`}
                        style={{ fontSize: fontSize === 'text-xs' ? '11px' : fontSize === 'text-sm' ? '12px' : '13px' }}
                    >
                        {match[0]}
                    </span>
                )

                localChordIndex++
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
    }, [chordCountBeforeLine, fontSize, isChordLine, renderBlockedLyrics])

    if (!formattedOutput) {
        return null
    }

    return (
        <div className="glass-strong rounded-2xl overflow-hidden shadow-soft-lg border border-neutral-700/50">
            {/* Header */}
            <div className="glass border-b border-neutral-700/50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-accent-purple to-accent-cyan rounded-lg flex items-center justify-center shadow-glow-sm">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                    </div>
                    <span className="text-sm font-bold text-gradient uppercase tracking-wider">
                        Preview (30s)
                    </span>
                </div>

                {/* Font size controls */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-400 uppercase tracking-wide">Size:</span>
                    <select
                        value={fontSize}
                        onChange={(e) => {
                            setFontSize(e.target.value)
                        }}
                        className="text-xs font-semibold px-3 py-1.5 glass rounded-lg text-neutral-200 cursor-pointer hover:border-accent-purple/50 transition-colors"
                    >
                        <option value="text-xs">Small</option>
                        <option value="text-sm">Medium</option>
                        <option value="text-base">Large</option>
                    </select>
                </div>
            </div>

            {/* Content with blur/block effects */}
            <div className="p-8 overflow-x-auto custom-scrollbar">
                <div className={`font-mono ${fontSize} leading-loose text-neutral-200`}>
                    {lines.map((line, idx) => (
                        <div key={idx} className="whitespace-pre min-h-[1.8em]">
                            {renderLine(line, idx)}
                        </div>
                    ))}
                </div>
            </div>

            {/* Unlock CTA */}
            <div className="mx-6 mb-6 p-6 glass-strong border border-accent-purple/30 rounded-2xl relative overflow-hidden">
                {/* Animated glow background */}
                <div className="absolute inset-0 bg-gradient-to-r from-accent-purple/10 via-accent-cyan/10 to-accent-pink/10 animate-gradient opacity-50"></div>

                <div className="relative flex flex-col md:flex-row items-center gap-6">
                    {/* Lock icon */}
                    <div className="shrink-0">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-accent-purple to-accent-cyan rounded-full blur-xl opacity-50"></div>
                            <div className="relative w-16 h-16 bg-gradient-to-br from-accent-purple to-accent-cyan rounded-2xl flex items-center justify-center shadow-glow-md">
                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Text */}
                    <div className="flex-1 text-center md:text-left">
                        <p className="text-sm font-semibold text-neutral-300 mb-2">
                            Unlock full lyrics & chords
                        </p>
                        <p className="text-4xl font-bold text-gradient">
                            2,99 Kč
                        </p>
                    </div>

                    {/* Button */}
                    <button
                        onClick={onUnlock}
                        className="relative shrink-0 group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-pink rounded-xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative px-8 py-4 bg-gradient-to-r from-accent-purple to-accent-cyan rounded-xl font-bold text-sm uppercase tracking-wider text-white shadow-soft transition-all duration-300 group-hover:scale-105 group-hover:shadow-glow-lg">
                            Pay with Stripe
                        </div>
                    </button>
                </div>

                {/* Benefits */}
                <div className="relative mt-6 pt-6 border-t border-neutral-700/50">
                    <p className="text-xs text-neutral-400 text-center flex items-center justify-center gap-6">
                        <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Instant access
                        </span>
                        <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Secure payment
                        </span>
                        <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Download as PDF
                        </span>
                    </p>
                </div>
            </div>
        </div>
    )
}

import { useState } from 'react'
import { jsPDF } from 'jspdf'
import { processAudioFile } from './audioProcessor'

function App() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]

    if (selectedFile) {
      // Kontrola typu souboru
      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3']
      if (!validTypes.includes(selectedFile.type)) {
        setError('Please upload only MP3 or WAV files')
        setFile(null)
        return
      }

      setFile(selectedFile)
      setError(null)
      setResult(null)
      setProgress('')
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setProgress('Initializing...')

    try {
      const data = await processAudioFile(file, (progressUpdate) => {
        setProgress(progressUpdate.message || '')
      })

      setResult(data)
      setProgress('Complete!')
    } catch (err) {
      console.error('Error:', err)
      setError(err.message || 'An error occurred while processing the file')
    } finally {
      setLoading(false)
    }
  }

  const generatePDF = () => {
    if (!result) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const lineHeight = 7
    let yPosition = margin

    // Hlavička
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Song Lyrics & Chords', margin, yPosition)
    yPosition += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`File: ${result.filename}`, margin, yPosition)
    yPosition += 15

    // Funkce pro přidání nové stránky pokud je potřeba
    const checkPageBreak = (neededSpace) => {
      if (yPosition + neededSpace > pageHeight - margin) {
        doc.addPage()
        yPosition = margin
      }
    }

    // Synchronizace akordů s textem
    const segments = result.segments || []
    const chords = result.chords || []

    doc.setFontSize(12)

    if (segments.length > 0) {
      // Zobrazení s časovými značkami a akordy
      segments.forEach((segment) => {
        checkPageBreak(20)

        // Najdi akordy pro tento segment
        const segmentChords = chords.filter(
          (chord) => chord.time >= segment.start && chord.time <= segment.end
        )

        // Zobraz akordy nad textem
        if (segmentChords.length > 0) {
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(0, 100, 200)
          const chordText = segmentChords.map((c) => c.chord).join('  ')
          doc.text(chordText, margin, yPosition)
          yPosition += lineHeight
        }

        // Text segmentu
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(0, 0, 0)

        const lines = doc.splitTextToSize(segment.text, pageWidth - 2 * margin)
        lines.forEach((line) => {
          checkPageBreak(lineHeight)
          doc.text(line, margin, yPosition)
          yPosition += lineHeight
        })

        yPosition += 3 // Mezera mezi segmenty
      })
    } else {
      // Fallback - zobrazení celého textu s akordy na začátku
      if (chords.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 100, 200)
        doc.text('Detected Chords:', margin, yPosition)
        yPosition += lineHeight

        const chordText = chords.map((c) => `${c.chord} (${c.time}s)`).join(', ')
        const chordLines = doc.splitTextToSize(chordText, pageWidth - 2 * margin)
        chordLines.forEach((line) => {
          checkPageBreak(lineHeight)
          doc.text(line, margin, yPosition)
          yPosition += lineHeight
        })

        yPosition += 10
      }

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)

      const textLines = doc.splitTextToSize(result.text, pageWidth - 2 * margin)
      textLines.forEach((line) => {
        checkPageBreak(lineHeight)
        doc.text(line, margin, yPosition)
        yPosition += lineHeight
      })
    }

    // Stažení PDF
    const filename = result.filename.replace(/\.(mp3|wav)$/i, '') + '_lyrics.pdf'
    doc.save(filename)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4 shadow-2xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            Lyrics & Chord Detector
          </h1>
          <p className="text-purple-200 text-lg max-w-2xl mx-auto">
            AI-powered music transcription running entirely in your browser
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
          {/* Upload Section Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white mb-2">Upload Audio</h2>
            <p className="text-purple-200">Choose an MP3 or WAV file to analyze</p>
          </div>

          {/* Upload Section */}
          <div className="mb-8">
            <div className="relative">
              <input
                type="file"
                id="audio-upload"
                accept=".mp3,.wav,audio/mpeg,audio/wav"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="audio-upload"
                className="flex flex-col items-center justify-center w-full h-48 bg-white/5 border-2 border-dashed border-purple-300/50 rounded-2xl cursor-pointer hover:bg-white/10 transition-all group"
              >
                <svg className="w-12 h-12 text-purple-300 mb-3 group-hover:text-purple-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-purple-200 font-medium mb-1">Click to upload audio file</span>
                <span className="text-purple-300/70 text-sm">MP3 or WAV (max 50MB)</span>
              </label>
            </div>

            {file && (
              <div className="mt-4 p-4 bg-green-500/20 border border-green-400/30 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-green-300/70 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="mt-6 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl
                font-semibold text-lg hover:from-purple-600 hover:to-pink-600 transition-all
                disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 shadow-lg disabled:shadow-none
                transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Audio...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Analyze Audio
                </>
              )}
            </button>

            {loading && progress && (
              <div className="mt-4 p-4 bg-blue-500/20 border border-blue-400/30 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="animate-pulse">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  </div>
                  <p className="text-blue-200 text-sm font-medium">{progress}</p>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-xl backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between pb-6 border-b border-white/20">
                <h2 className="text-3xl font-bold text-white">Results</h2>
                <button
                  onClick={generatePDF}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-6 rounded-xl
                    font-semibold hover:from-green-600 hover:to-emerald-600 transition-all
                    flex items-center gap-2 shadow-lg transform hover:scale-105"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
              </div>

              {/* Chords */}
              {result.chords && result.chords.length > 0 && (
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    Detected Chords
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {result.chords.map((chord, idx) => (
                      <div
                        key={idx}
                        className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm px-5 py-3 rounded-xl border border-purple-400/30 hover:border-purple-400/60 transition-all"
                      >
                        <span className="font-bold text-purple-200 text-lg">{chord.chord}</span>
                        <span className="text-purple-300/70 text-sm ml-2">
                          {chord.time}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lyrics */}
              <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Lyrics
                </h3>
                <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                  <p className="text-purple-100 whitespace-pre-wrap leading-relaxed">
                    {result.text}
                  </p>
                </div>
              </div>

              {/* Segments with Timeline */}
              {result.segments && result.segments.length > 0 && (
                <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Timeline
                  </h3>
                  <div className="space-y-3">
                    {result.segments.map((segment, idx) => (
                      <div
                        key={idx}
                        className="bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <span className="text-xs font-mono bg-indigo-500/20 px-3 py-1.5 rounded-lg text-indigo-200 shrink-0 border border-indigo-400/30">
                            {segment.start.toFixed(1)}s - {segment.end.toFixed(1)}s
                          </span>
                          <p className="text-purple-100">{segment.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-purple-300/60 text-sm">
            Powered by Transformers.js (Whisper AI) - Processing in your browser
          </p>
        </div>
      </div>
    </div>
  )
}

export default App

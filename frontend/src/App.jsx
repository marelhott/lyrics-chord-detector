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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Lyrics & Chord Detector
            </h1>
            <p className="text-gray-600">
              Upload an MP3 or WAV file to detect lyrics and chords
            </p>
          </div>

          {/* Upload Section */}
          <div className="mb-8">
            <label className="block mb-4">
              <span className="text-gray-700 font-medium mb-2 block">
                Select Audio File (MP3 or WAV)
              </span>
              <input
                type="file"
                accept=".mp3,.wav,audio/mpeg,audio/wav"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100
                  file:cursor-pointer cursor-pointer"
              />
            </label>

            {file && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">
                  Selected: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="mt-6 w-full bg-indigo-600 text-white py-3 px-6 rounded-lg
                font-semibold text-lg hover:bg-indigo-700 transition-colors
                disabled:bg-gray-300 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Process Audio'
              )}
            </button>

            {loading && progress && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm text-center">{progress}</p>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">Results</h2>
                <button
                  onClick={generatePDF}
                  className="bg-green-600 text-white py-2 px-6 rounded-lg
                    font-semibold hover:bg-green-700 transition-colors
                    flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
              </div>

              {/* Chords */}
              {result.chords && result.chords.length > 0 && (
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3">
                    Detected Chords
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {result.chords.map((chord, idx) => (
                      <div
                        key={idx}
                        className="bg-white px-4 py-2 rounded-lg shadow-sm border border-blue-200"
                      >
                        <span className="font-bold text-blue-700">{chord.chord}</span>
                        <span className="text-gray-500 text-sm ml-2">
                          @ {chord.time}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lyrics */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Lyrics
                </h3>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {result.text}
                  </p>
                </div>
              </div>

              {/* Segments with Timeline */}
              {result.segments && result.segments.length > 0 && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Timeline
                  </h3>
                  <div className="space-y-3">
                    {result.segments.map((segment, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                      >
                        <div className="flex items-start gap-4">
                          <span className="text-xs font-mono bg-gray-100 px-3 py-1 rounded text-gray-600 shrink-0">
                            {segment.start.toFixed(1)}s - {segment.end.toFixed(1)}s
                          </span>
                          <p className="text-gray-800">{segment.text}</p>
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
        <div className="text-center mt-8 text-gray-600 text-sm">
          <p>Powered by Transformers.js (Whisper AI) - Processing in your browser</p>
        </div>
      </div>
    </div>
  )
}

export default App

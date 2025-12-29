import { useState, useRef, useEffect } from 'react'
import { jsPDF } from 'jspdf'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const promptRef = useRef(null)

  // Auto-expand prompt textarea
  useEffect(() => {
    if (promptRef.current) {
      promptRef.current.style.height = 'auto'
      promptRef.current.style.height = `${promptRef.current.scrollHeight}px`
    }
  }, [file?.name])

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]

    if (selectedFile) {
      // Kontrola typu souboru
      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3']
      if (!validTypes.includes(selectedFile.type)) {
        setError('Prosím nahrajte pouze MP3 nebo WAV soubory')
        setFile(null)
        return
      }

      setFile(selectedFile)
      setError(null)
      setResult(null)
      setProgress('')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3']
      if (!validTypes.includes(droppedFile.type)) {
        setError('Prosím nahrajte pouze MP3 nebo WAV soubory')
        return
      }
      setFile(droppedFile)
      setError(null)
      setResult(null)
      setProgress('')
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleProcess = async () => {
    if (!file) {
      setError('Prosím nejdříve vyberte soubor')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setProgress('Nahrávám audio soubor...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      setProgress('Zpracovávám pomocí AI...')

      const response = await fetch(`${API_URL}/process-audio`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Chyba při zpracování')
      }

      const data = await response.json()
      setResult({
        ...data,
        filename: file.name
      })
      setProgress('Hotovo!')
    } catch (err) {
      console.error('Error:', err)
      setError(err.message || 'Nastala chyba při zpracování souboru')
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
    <div className="flex h-screen overflow-hidden bg-white text-ink font-sans selection:bg-monstera-200">
      {/* Sidebar */}
      <div className="hidden lg:flex shrink-0 w-80 border-r border-monstera-200 bg-paper flex-col z-20 h-full relative shadow-sm">
        {/* Header */}
        <div className="border-b border-monstera-200 px-4 py-6 bg-white">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-7 h-7 bg-monstera-400 rounded-md flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h1 className="text-sm font-black text-ink uppercase tracking-widest">Lyrics Detector</h1>
          </div>
          <p className="text-[10px] text-monstera-600 font-medium leading-relaxed">
            AI-powered music transcription & chord detection
          </p>
        </div>

        {/* Controls */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          <div className="space-y-5">
            {/* File Input Section */}
            <section className="space-y-1">
              <header className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black text-monstera-800 uppercase tracking-widest">Audio soubor</label>
              </header>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="w-full min-h-[120px] bg-white border border-monstera-200 rounded-md p-4 cursor-pointer hover:border-monstera-400 transition-all flex flex-col items-center justify-center gap-2 shadow-inner"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,audio/mpeg,audio/wav"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <svg className="w-8 h-8 text-monstera-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-[11px] font-bold text-monstera-600">
                  {file ? file.name : 'Klikněte nebo přetáhněte'}
                </span>
                <span className="text-[8px] font-bold text-monstera-400 uppercase tracking-widest">
                  MP3 nebo WAV
                </span>
              </div>
              {file && (
                <div className="mt-2 px-3 py-2 bg-monstera-50 border border-monstera-200 rounded-md">
                  <p className="text-[9px] font-bold text-monstera-600 uppercase tracking-wide">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </section>

            {/* Progress */}
            {loading && progress && (
              <div className="p-3 bg-monstera-50 border border-monstera-200 rounded-md">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse">
                    <div className="w-2 h-2 bg-monstera-400 rounded-full"></div>
                  </div>
                  <p className="text-[10px] font-bold text-monstera-800 uppercase tracking-wide">{progress}</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-[10px] font-bold text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <div className="p-4 border-t border-monstera-200 bg-paper/80 backdrop-blur-xl">
          <button
            onClick={handleProcess}
            disabled={!file || loading}
            className="w-full py-3 px-6 bg-gradient-to-br from-monstera-300 to-monstera-400 hover:from-ink hover:to-monstera-900 hover:text-white text-ink font-[900] text-[13px] uppercase tracking-[0.2em] border-2 border-ink rounded-md transition-all shadow-[5px_5px_0_rgba(13,33,23,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-20 disabled:cursor-not-allowed disabled:grayscale"
          >
            {loading ? 'Zpracovávám...' : 'Analyzovat'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto custom-scrollbar bg-white relative flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden border-b border-monstera-200 px-4 py-4 bg-white">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-6 h-6 bg-monstera-400 rounded-md flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h1 className="text-xs font-black text-ink uppercase tracking-widest">Lyrics Detector</h1>
          </div>
        </div>

        <div className="p-4 lg:px-10 lg:pt-6 lg:pb-10 space-y-6 md:space-y-8 max-w-[1800px] mx-auto w-full">
          {!result ? (
            /* Empty State */
            <div className="py-20 md:py-40 flex flex-col items-center justify-center space-y-6">
              <div className="w-16 h-16 bg-monstera-50 rounded-md flex items-center justify-center grayscale opacity-20 border border-monstera-200 shadow-inner">
                <span className="text-3xl">🎵</span>
              </div>
              <div className="text-center space-y-2">
                <span className="text-lg font-bold text-ink block">Zatím žádné výsledky</span>
                <p className="text-sm text-monstera-600 max-w-md">
                  Nahrajte MP3 nebo WAV soubor pro detekci textu a akordů
                </p>
              </div>
              {/* Mobile upload */}
              <div className="lg:hidden w-full max-w-sm space-y-4 mt-8">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="w-full min-h-[140px] bg-monstera-50 border-2 border-dashed border-monstera-300 rounded-md p-4 cursor-pointer hover:border-monstera-400 transition-all flex flex-col items-center justify-center gap-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.wav,audio/mpeg,audio/wav"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <svg className="w-10 h-10 text-monstera-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-xs font-bold text-monstera-600">
                    {file ? file.name : 'Klikněte pro nahrání'}
                  </span>
                  <span className="text-[9px] font-bold text-monstera-400 uppercase tracking-widest">
                    MP3 nebo WAV
                  </span>
                </div>

                {file && (
                  <button
                    onClick={handleProcess}
                    disabled={loading}
                    className="w-full py-3 px-6 bg-monstera-400 text-ink font-[900] text-xs uppercase tracking-[0.2em] border-2 border-ink rounded-md transition-all shadow-[4px_4px_0_rgba(13,33,23,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-20 disabled:grayscale"
                  >
                    {loading ? 'Zpracovávám...' : 'Analyzovat'}
                  </button>
                )}

                {loading && progress && (
                  <div className="p-3 bg-monstera-50 border border-monstera-200 rounded-md">
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse">
                        <div className="w-2 h-2 bg-monstera-400 rounded-full"></div>
                      </div>
                      <p className="text-[10px] font-bold text-monstera-800">{progress}</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-[10px] font-bold text-red-700">{error}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Results */
            <div className="space-y-6">
              {/* Header */}
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-ink rounded-full"></div>
                    <h2 className="text-[11px] font-[900] uppercase tracking-[0.3em] text-ink">Výsledky</h2>
                  </div>
                </div>

                <button
                  onClick={generatePDF}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-ink font-black text-[9px] uppercase tracking-widest rounded-md border border-monstera-200 hover:border-ink shadow-sm transition-all active:scale-95"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Stáhnout PDF
                </button>
              </header>

              {/* Chords */}
              {result.chords && result.chords.length > 0 && (
                <article className="bg-white border border-monstera-200 rounded-md overflow-hidden shadow-sm">
                  <div className="bg-monstera-50 border-b border-monstera-200 px-3 py-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-monstera-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <span className="text-[10px] font-black text-monstera-800 uppercase tracking-widest">Detekované akordy</span>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2">
                    {result.chords.map((chord, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 bg-monstera-50 text-monstera-800 font-bold text-xs rounded border border-monstera-200 hover:bg-monstera-100 transition-all"
                      >
                        <span className="font-black">{chord.chord}</span>
                        <span className="text-monstera-400 text-[9px] ml-1.5">{chord.time}s</span>
                      </div>
                    ))}
                  </div>
                </article>
              )}

              {/* Lyrics */}
              {result.text && (
                <article className="bg-white border border-monstera-200 rounded-md overflow-hidden shadow-sm">
                  <div className="bg-monstera-50 border-b border-monstera-200 px-3 py-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-monstera-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-[10px] font-black text-monstera-800 uppercase tracking-widest">Text skladby</span>
                  </div>
                  <div className="p-4">
                    <p className="text-[13px] font-medium text-ink leading-relaxed whitespace-pre-wrap">
                      {result.text}
                    </p>
                  </div>
                </article>
              )}

              {/* Timeline */}
              {result.segments && result.segments.length > 0 && (
                <article className="bg-white border border-monstera-200 rounded-md overflow-hidden shadow-sm">
                  <div className="bg-monstera-50 border-b border-monstera-200 px-3 py-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-monstera-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[10px] font-black text-monstera-800 uppercase tracking-widest">Časová osa</span>
                  </div>
                  <div className="p-4 space-y-2">
                    {result.segments.map((segment, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-monstera-50 rounded border border-monstera-200 hover:bg-monstera-100 transition-all"
                      >
                        <span className="text-[9px] font-mono font-bold bg-white px-2 py-1 rounded text-monstera-600 shrink-0 border border-monstera-200">
                          {segment.start?.toFixed(1) || 0}s - {segment.end?.toFixed(1) || 0}s
                        </span>
                        <p className="text-[12px] font-medium text-ink leading-relaxed">{segment.text}</p>
                      </div>
                    ))}
                  </div>
                </article>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App

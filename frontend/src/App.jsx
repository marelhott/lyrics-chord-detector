import { useState, useRef } from 'react'
import UltimateGuitarPreview from './components/UltimateGuitarPreview'
import DemoPreview from './components/DemoPreview'
import LanguageSelector from './components/LanguageSelector'
import ExportOptions from './components/ExportOptions'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState(null) // null = auto-detect
  const [chordQuality, setChordQuality] = useState('free') // 'free' or 'premium'
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]

    if (selectedFile) {
      // Validate file type
      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3']
      if (!validTypes.includes(selectedFile.type)) {
        setError('Prosím nahrajte pouze MP3 nebo WAV soubory')
        setFile(null)
        return
      }

      // Validate file size (50MB max)
      const maxSize = 50 * 1024 * 1024
      if (selectedFile.size > maxSize) {
        setError('Soubor je příliš velký. Maximum je 50MB')
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

      const maxSize = 50 * 1024 * 1024
      if (droppedFile.size > maxSize) {
        setError('Soubor je příliš velký. Maximum je 50MB')
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
      setError('Nejprve vyberte soubor')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setProgress('Nahrávám soubor...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (language) {
        formData.append('language', language)
      }
      formData.append('quality', chordQuality)

      setProgress('Zpracovávám pomocí AI (demo - 30s)...')

      const response = await fetch(`${API_URL}/process-demo`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Chyba při zpracování')
      }

      const data = await response.json()

      if (data.is_demo) {
        setResult({ ...data, isDemoMode: true })
      } else {
        setResult(data)
      }

      setProgress('')
    } catch (err) {
      console.error('Error:', err)
      setError(err.message || 'Nastala chyba při zpracování')
      setProgress('')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlock = async () => {
    if (!result || !result.audio_hash) {
      setError('Chyba: Nelze odemknout bez výsledku')
      return
    }

    // TODO: Implement Stripe checkout
    alert('Stripe integrace bude přidána v další fázi.\nPro nyní: Demo mode funguje!')
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
            {/* Language Selector */}
            <LanguageSelector value={language} onChange={setLanguage} />

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
                  MP3 nebo WAV (max 50MB)
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

            {/* Result Info */}
            {result && (
              <div className="p-3 bg-monstera-50 border border-monstera-200 rounded-md space-y-1">
                <p className="text-[9px] font-black text-monstera-800 uppercase tracking-wide">Výsledky:</p>
                <div className="text-[8px] text-monstera-600 space-y-0.5">
                  <p>🌍 Jazyk: <span className="font-bold">{result.language?.toUpperCase()}</span></p>
                  <p>📝 Segmentů: <span className="font-bold">{result.segments?.length || 0}</span></p>
                  <p>🎸 Akordů: <span className="font-bold">{result.chords?.length || 0}</span></p>
                  <p>📋 Sekcí: <span className="font-bold">{result.structure?.length || 0}</span></p>
                </div>
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
            <div className="py-20 md:py-40 flex flex-col items-center justify-center space-y-6">
              {loading ? (
                <div className="w-full max-w-md space-y-4">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-monstera-50 rounded-full flex items-center justify-center mx-auto border-4 border-monstera-100 animate-pulse">
                      <span className="text-3xl animate-bounce">🎵</span>
                    </div>
                    <h3 className="text-lg font-black text-ink uppercase tracking-widest">Analyzuji skladbu</h3>
                    <p className="text-xs font-bold text-monstera-600">{progress}</p>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="h-4 w-full bg-monstera-100 rounded-full overflow-hidden border border-monstera-200">
                    {/* Animated Progress Bar */}
                    <div
                      className="h-full bg-gradient-to-r from-monstera-400 to-monstera-600 animate-progress"
                      style={{
                        width: '100%',
                        animation: 'progress 15s ease-in-out infinite'
                      }}
                    ></div>
                  </div>
                  <style>{`
                        @keyframes progress {
                            0% { width: 0%; }
                            20% { width: 30%; }
                            50% { width: 60%; }
                            80% { width: 85%; }
                            90% { width: 95%; }
                            100% { width: 98%; }
                        }
                    `}</style>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 bg-monstera-50 rounded-md flex items-center justify-center grayscale opacity-20 border border-monstera-200 shadow-inner">
                    <span className="text-3xl">🎵</span>
                  </div>
                  <div className="text-center space-y-2">
                    <span className="text-lg font-bold text-ink block">Zatím žádné výsledky</span>
                    <p className="text-sm text-monstera-600 max-w-md">
                      Nahrajte MP3 nebo WAV soubor pro detekci textu a akordů
                    </p>
                  </div>
                </>
              )}
              {/* Mobile upload */}
              <div className="lg:hidden w-full max-w-sm space-y-4 mt-8">
                <LanguageSelector value={language} onChange={setLanguage} />

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
                    MP3 nebo WAV (max 50MB)
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
              {/* Header with Export */}
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-ink rounded-full"></div>
                    <h2 className="text-[11px] font-[900] uppercase tracking-[0.3em] text-ink">Výsledky</h2>
                  </div>
                </div>

                <ExportOptions result={result} />
              </header>

              {/* Preview - Demo or Full */}
              {result.is_demo ? (
                <DemoPreview result={result} onUnlock={handleUnlock} />
              ) : (
                <UltimateGuitarPreview result={result} />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App

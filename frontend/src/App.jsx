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
    <div className="flex h-screen overflow-hidden bg-dark-950 text-neutral-50 font-sans selection:bg-accent-purple/20 relative">
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-accent-purple/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-accent-cyan/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-1/3 bg-accent-pink/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Sidebar */}
      <div className="hidden lg:flex shrink-0 w-80 border-r border-neutral-800/50 glass-strong flex-col z-20 h-full relative">
        {/* Header */}
        <div className="border-b border-neutral-800/50 px-6 py-8 bg-dark-900/50 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-accent-purple to-accent-cyan rounded-xl flex items-center justify-center shadow-glow-sm">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gradient">Lyrics Detector</h1>
              <p className="text-xs text-neutral-400 font-medium">
                AI-powered transcription
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="space-y-6">
            {/* Language Selector */}
            <LanguageSelector value={language} onChange={setLanguage} />

            {/* File Input Section */}
            <section className="space-y-3">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Audio File</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="group relative w-full min-h-[140px] glass rounded-2xl p-6 cursor-pointer hover:border-accent-purple/50 transition-all duration-300 flex flex-col items-center justify-center gap-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,audio/mpeg,audio/wav"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-accent-purple to-accent-cyan rounded-full blur-xl opacity-0 group-hover:opacity-50 transition-opacity"></div>
                  <div className="relative w-16 h-16 glass-strong rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-neutral-200 block mb-1">
                    {file ? file.name : 'Click or drag to upload'}
                  </span>
                  <span className="text-xs text-neutral-500 font-medium">
                    MP3 or WAV (max 50MB)
                  </span>
                </div>
              </div>
              {file && (
                <div className="glass rounded-xl p-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <p className="text-xs text-neutral-300 font-medium">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </section>

            {/* Progress */}
            {loading && progress && (
              <div className="glass rounded-xl p-4 border-accent-purple/30">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-accent-purple rounded-full animate-pulse"></div>
                  <p className="text-xs font-semibold text-neutral-200">{progress}</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="glass rounded-xl p-4 border-red-500/30 bg-red-500/5">
                <p className="text-xs font-semibold text-red-400">{error}</p>
              </div>
            )}

            {/* Result Info */}
            {result && (
              <div className="glass-strong rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-neutral-200 uppercase tracking-wider">Results</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-gradient">{result.language?.toUpperCase()}</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Language</p>
                  </div>
                  <div className="glass rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-gradient">{result.chords?.length || 0}</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Chords</p>
                  </div>
                  <div className="glass rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-gradient">{result.segments?.length || 0}</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Segments</p>
                  </div>
                  <div className="glass rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-gradient">{result.structure?.length || 0}</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1">Sections</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <div className="p-6 border-t border-neutral-800/50 glass-strong backdrop-blur-xl">
          <button
            onClick={handleProcess}
            disabled={!file || loading}
            className="relative w-full group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-pink rounded-xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity group-disabled:opacity-0"></div>
            <div className="relative py-4 px-6 bg-gradient-to-r from-accent-purple to-accent-cyan rounded-xl font-bold text-sm uppercase tracking-wider text-white shadow-soft transition-all duration-300 group-hover:scale-105 group-hover:shadow-glow-lg group-disabled:opacity-30 group-disabled:cursor-not-allowed group-disabled:scale-100">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Processing...
                </span>
              ) : (
                'Analyze Track'
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto custom-scrollbar relative flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden border-b border-neutral-800/50 px-4 py-4 glass-strong backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-accent-purple to-accent-cyan rounded-lg flex items-center justify-center shadow-glow-sm">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-gradient">Lyrics Detector</h1>
          </div>
        </div>

        <div className="p-4 lg:px-12 lg:pt-8 lg:pb-12 space-y-8 max-w-[1800px] mx-auto w-full relative z-10">
          {!result ? (
            <div className="py-20 md:py-40 flex flex-col items-center justify-center space-y-8">
              {loading ? (
                <div className="w-full max-w-md space-y-6">
                  <div className="text-center space-y-4">
                    <div className="relative mx-auto w-24 h-24">
                      <div className="absolute inset-0 bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-pink rounded-full blur-2xl opacity-50 animate-pulse"></div>
                      <div className="relative glass-strong rounded-full w-full h-full flex items-center justify-center border-2 border-accent-purple/30">
                        <span className="text-4xl animate-bounce">🎵</span>
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-gradient">Analyzing Track</h3>
                    <p className="text-sm text-neutral-400 font-medium">{progress}</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-2 w-full glass rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-pink animate-gradient rounded-full"
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
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-accent-purple to-accent-cyan rounded-3xl blur-2xl opacity-20"></div>
                    <div className="relative glass-strong rounded-3xl w-24 h-24 flex items-center justify-center border border-neutral-700/50">
                      <span className="text-5xl opacity-30 grayscale">🎵</span>
                    </div>
                  </div>
                  <div className="text-center space-y-3 max-w-lg">
                    <h2 className="text-2xl font-bold text-neutral-200">No Results Yet</h2>
                    <p className="text-sm text-neutral-500 leading-relaxed">
                      Upload an MP3 or WAV file to detect lyrics and chords using AI
                    </p>
                  </div>
                </>
              )}

              {/* Mobile upload */}
              <div className="lg:hidden w-full max-w-sm space-y-5 mt-12">
                <LanguageSelector value={language} onChange={setLanguage} />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="group relative w-full min-h-[160px] glass rounded-2xl p-6 cursor-pointer hover:border-accent-purple/50 transition-all duration-300 flex flex-col items-center justify-center gap-4"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.wav,audio/mpeg,audio/wav"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-accent-purple to-accent-cyan rounded-full blur-xl opacity-0 group-hover:opacity-50 transition-opacity"></div>
                    <div className="relative w-16 h-16 glass-strong rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-semibold text-neutral-200 block mb-1">
                      {file ? file.name : 'Click to upload'}
                    </span>
                    <span className="text-xs text-neutral-500 font-medium">
                      MP3 or WAV (max 50MB)
                    </span>
                  </div>
                </div>

                {file && (
                  <button
                    onClick={handleProcess}
                    disabled={loading}
                    className="relative w-full group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-pink rounded-xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity group-disabled:opacity-0"></div>
                    <div className="relative py-4 px-6 bg-gradient-to-r from-accent-purple to-accent-cyan rounded-xl font-bold text-sm uppercase tracking-wider text-white shadow-soft transition-all duration-300 group-hover:scale-105 group-hover:shadow-glow-lg group-disabled:opacity-30 group-disabled:cursor-not-allowed group-disabled:scale-100">
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Processing...
                        </span>
                      ) : (
                        'Analyze Track'
                      )}
                    </div>
                  </button>
                )}

                {loading && progress && (
                  <div className="glass rounded-xl p-4 border-accent-purple/30">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-accent-purple rounded-full animate-pulse"></div>
                      <p className="text-xs font-semibold text-neutral-200">{progress}</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="glass rounded-xl p-4 border-red-500/30 bg-red-500/5">
                    <p className="text-xs font-semibold text-red-400">{error}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Results */
            <div className="space-y-6">
              {/* Header with Export */}
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-gradient uppercase tracking-wider">Results</h2>
                  <div className="h-1 w-20 bg-gradient-to-r from-accent-purple to-accent-cyan rounded-full"></div>
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

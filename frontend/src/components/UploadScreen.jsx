import { useState, useRef } from 'react';
import { Music2, Upload, Music } from 'lucide-react';

export function UploadScreen({ onFileSelect, onSpotifySubmit }) {
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('file'); // 'file' or 'spotify'
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const fileInputRef = useRef(null);
  const [vocalHeavy, setVocalHeavy] = useState(false);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'audio/mp3' || file.type === 'audio/wav' || file.type === 'audio/mpeg')) {
      onFileSelect(file, { vocalHeavy });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file, { vocalHeavy });
    }
  };

  const handleSpotifySubmit = (e) => {
    e.preventDefault();
    if (spotifyUrl.trim() && onSpotifySubmit) {
      onSpotifySubmit(spotifyUrl.trim(), { vocalHeavy });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Header */}
      <header className="border-b border-border px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <span className="text-foreground font-medium text-lg">Lyrics & Chord Detector</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-3xl w-full text-center">
          {/* Title Section */}
          <div className="mb-12">
            <p className="text-muted-foreground text-xs mb-4 tracking-widest uppercase">// Available for work</p>
            <h1 className="text-[3.4rem] md:text-[4.05rem] lg:text-[5.4rem] font-bold mb-6 leading-[0.95]">
              <span className="text-foreground">AI Lyrics &</span>
              <br />
              <span className="text-primary">Chord Detector.</span>
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl mb-16 max-w-2xl mx-auto">
              Upload a song or paste a Spotify link to get chords perfectly aligned with lyrics.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 justify-center">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'file'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary/40'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
                }`}
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('spotify')}
              className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'spotify'
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
                }`}
            >
              <Music className="w-4 h-4" />
              Spotify URL
            </button>

          </div>

          <div className="flex items-center justify-center gap-6 mb-10">
            <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={vocalHeavy}
                onChange={(e) => setVocalHeavy(e.target.checked)}
                className="peer sr-only"
              />
              <span className="relative h-4 w-4 rounded border border-border bg-card shadow-sm peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:bg-primary peer-checked:border-primary">
                <svg
                  viewBox="0 0 20 20"
                  className="absolute inset-0 m-auto h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 5.29a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25A1 1 0 016.204 9.29l2.543 2.543 6.543-6.543a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              Vocal-heavy
            </label>
          </div>

          {/* Upload Card - File Upload */}
          {activeTab === 'file' && (
            <>
              <div className="mx-auto w-full max-w-[38rem]">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={openFilePicker}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openFilePicker();
                    }
                  }}
                  className={`relative mb-10 bg-card border-2 ${isDragging ? 'border-primary shadow-lg shadow-primary/20' : 'border-primary/30'
                    } rounded-2xl p-8 transition-all hover:border-primary/60 group overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-transparent"></div>
                    <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
                  </div>

                  <div className="absolute top-4 left-4 w-5 h-5 border-l-2 border-t-2 border-primary/20 rounded-tl-lg"></div>
                  <div className="absolute top-4 right-4 w-5 h-5 border-r-2 border-t-2 border-primary/20 rounded-tr-lg"></div>
                  <div className="absolute bottom-4 left-4 w-5 h-5 border-l-2 border-b-2 border-primary/20 rounded-bl-lg"></div>
                  <div className="absolute bottom-4 right-4 w-5 h-5 border-r-2 border-b-2 border-primary/20 rounded-br-lg"></div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.wav"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="flex flex-col items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-muted to-card flex items-center justify-center shadow-xl group-hover:shadow-primary/10 transition-all relative">
                      <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s' }}>
                        <div className="absolute top-0 left-1/2 w-2 h-2 bg-primary rounded-full -translate-x-1/2"></div>
                      </div>
                      <div className="absolute inset-0 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
                        <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-primary/60 rounded-full -translate-x-1/2"></div>
                      </div>
                      <Music2 className="w-6 h-6 text-primary relative z-10" />
                    </div>

                    <div>
                      <p className="text-foreground text-base font-medium mb-1">Drop MP3 or WAV file here</p>
                      <p className="text-muted-foreground text-xs">Max 20 MB · MP3, WAV</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Spotify URL Input */}
          {activeTab === 'spotify' && (
            <>
              <form onSubmit={handleSpotifySubmit} className="mx-auto w-full max-w-[38rem]">
                <div className="relative bg-card border-2 border-border rounded-2xl p-8 transition-all hover:border-primary/50 group overflow-hidden">
                  {/* Animated gradient background effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-transparent"></div>
                  </div>

                  <div className="flex flex-col items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-muted to-card flex items-center justify-center shadow-xl relative">
                      <Music className="w-8 h-8 text-primary" />
                    </div>

                    <div className="w-full max-w-xl">
                      <p className="text-foreground text-base font-medium mb-3">Paste Spotify Track URL</p>
                      <input
                        type="url"
                        value={spotifyUrl}
                        onChange={(e) => setSpotifyUrl(e.target.value)}
                        placeholder="https://open.spotify.com/track/..."
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                        required
                      />
                      <p className="text-muted-foreground text-xs mt-2">Example: https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp</p>
                    </div>
                  </div>
                </div>

                {/* Download & Analyze Button */}
                <button
                  type="submit"
                  disabled={!spotifyUrl.trim()}
                  className="mt-7 px-8 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all font-semibold text-sm shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Download & Analyze
                </button>
              </form>
            </>
          )}

          <p className="text-muted-foreground text-sm mt-6">
            Processing usually takes under 1 minute
          </p>
        </div>
      </main>
    </div>
  );
}

import { useState, useRef } from 'react';
import { Music2 } from 'lucide-react';

export function UploadScreen({ onFileSelect }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

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
      onFileSelect(file);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Header */}
      <header className="border-b border-border px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary"></div>
            <span className="text-foreground font-medium text-lg">Lyrics & Chord Detector</span>
          </div>
          <button className="px-6 py-2.5 bg-card border border-primary text-primary rounded-lg hover:bg-primary hover:text-primary-foreground transition-all text-sm font-medium">
            BOOK A CALL
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-3xl w-full text-center">
          {/* Title Section */}
          <div className="mb-12">
            <p className="text-muted-foreground text-xs mb-4 tracking-widest uppercase">// Available for work</p>
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[0.95]">
              <span className="text-foreground">AI Lyrics &</span>
              <br />
              <span className="text-primary">Chord Detector.</span>
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl mb-16 max-w-2xl mx-auto">
              Upload a song and get chords perfectly aligned with lyrics.
            </p>
          </div>

          {/* Upload Card */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative mb-10 bg-card border-2 ${isDragging ? 'border-primary shadow-lg shadow-primary/20' : 'border-border'
              } rounded-2xl p-20 transition-all hover:border-primary/50 group overflow-hidden`}
          >
            {/* Animated gradient background effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-transparent"></div>
              <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
            </div>

            {/* Decorative corners */}
            <div className="absolute top-6 left-6 w-8 h-8 border-l-2 border-t-2 border-primary/20 rounded-tl-lg"></div>
            <div className="absolute top-6 right-6 w-8 h-8 border-r-2 border-t-2 border-primary/20 rounded-tr-lg"></div>
            <div className="absolute bottom-6 left-6 w-8 h-8 border-l-2 border-b-2 border-primary/20 rounded-bl-lg"></div>
            <div className="absolute bottom-6 right-6 w-8 h-8 border-r-2 border-b-2 border-primary/20 rounded-br-lg"></div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-6 relative z-10">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-muted to-card flex items-center justify-center shadow-xl group-hover:shadow-primary/10 transition-all relative">
                {/* Orbiting dots */}
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '8s' }}>
                  <div className="absolute top-0 left-1/2 w-2 h-2 bg-primary rounded-full -translate-x-1/2"></div>
                </div>
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
                  <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-primary/60 rounded-full -translate-x-1/2"></div>
                </div>
                <Music2 className="w-12 h-12 text-primary relative z-10" />
              </div>

              <div>
                <p className="text-foreground text-xl font-medium mb-2">Drop MP3 or WAV file here</p>
                <p className="text-muted-foreground text-sm">Max 20 MB · MP3, WAV</p>
              </div>
            </div>
          </div>

          {/* Analyze Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-10 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all font-semibold text-base shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transform"
          >
            Analyze song
          </button>

          <p className="text-muted-foreground text-sm mt-6">
            Processing usually takes under 1 minute
          </p>
        </div>
      </main>
    </div>
  );
}


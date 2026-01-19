import { useEffect, useState } from 'react';
import { Check, Music } from 'lucide-react';

function pseudoRandom01(seed) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

const steps = [
  'Extracting vocals',
  'Detecting lyrics',
  'Detecting chords',
  'Aligning song structure'
];

export function ProcessingScreen({ trackInfo }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Variable delay: 5s for first 3 steps, fast for others
    const delay = currentStep < 3 ? 5000 : 700;

    const timeout = setTimeout(() => {
      setCurrentStep(prev => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, delay);

    return () => clearTimeout(timeout);
  }, [currentStep]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-background">
      {/* Waveform Background */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <svg
          className="w-full h-64 opacity-40"
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
        >
          {/* Animated waveform bars */}
          {Array.from({ length: 80 }).map((_, i) => {
            const height = pseudoRandom01(i + 1) * 150 + 20;
            const delay = pseudoRandom01(i + 101) * 2;
            const opacity = 0.3 + pseudoRandom01(i + 1001) * 0.4;
            return (
              <rect
                key={i}
                x={i * 15}
                y={100 - height / 2}
                width="3"
                height={height}
                fill="hsl(var(--primary))" // Using CSS var inside SVG fill
                className="animate-pulse"
                style={{
                  animationDelay: `${delay}s`,
                  animationDuration: '1.5s',
                  opacity
                }}
              />
            );
          })}
        </svg>
      </div>

      <div className="max-w-md w-full text-center relative z-10">
        {/* Circular Microphone Loader */}
        <div className="mb-12 flex justify-center">
          <div className="relative">
            {/* Outer glow rings */}
            <div className="absolute inset-0 rounded-full border-2 border-primary opacity-10 animate-ping" style={{ animationDuration: '2s' }}></div>
            <div className="absolute -inset-8 rounded-full border border-primary opacity-5"></div>
            <div className="absolute -inset-16 rounded-full border border-primary opacity-5"></div>

            {/* Main circle */}
            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-muted to-card flex items-center justify-center relative shadow-2xl shadow-primary/20">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/10 to-transparent"></div>
              <Music className="w-20 h-20 text-primary relative z-10 animate-pulse" style={{ animationDuration: '2s' }} />
            </div>
          </div>
        </div>

        {/* Status Text */}
        {trackInfo ? (
          <>
            <h2 className="text-xl font-medium text-muted-foreground mb-4">Generating:</h2>
            <p className="text-2xl font-bold text-foreground mb-2">{trackInfo.artistName}</p>
            <p className="text-3xl font-bold text-primary mb-12">{trackInfo.trackName}</p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold text-foreground mb-3">Analyzing track…</h2>
            <p className="text-muted-foreground mb-12">This usually takes under a minute</p>
          </>
        )}

        {/* Progress Steps */}
        <div className="bg-card border border-border rounded-xl p-8">
          <div className="space-y-5">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${index < currentStep
                    ? 'bg-primary'
                    : index === currentStep
                      ? 'bg-muted border-2 border-primary'
                      : 'bg-muted/50'
                    }`}
                >
                  {index < currentStep ? (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  ) : index === currentStep ? (
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  ) : (
                    <span className="text-muted-foreground text-sm">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-left transition-colors ${index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


import { useEffect, useState } from 'react';
import { Check, Mic } from 'lucide-react';

const steps = [
  'Extracting vocals',
  'Detecting lyrics',
  'Detecting chords',
  'Aligning song structure'
];

export function ProcessingScreen() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // We increment step every 700ms to mock progress visual
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 700);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[#0a0f0d]">
      {/* Waveform Background */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <svg
          className="w-full h-64 opacity-40"
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
        >
          {/* Animated waveform bars */}
          {Array.from({ length: 80 }).map((_, i) => {
            const height = Math.random() * 150 + 20;
            const delay = Math.random() * 2;
            return (
              <rect
                key={i}
                x={i * 15}
                y={100 - height / 2}
                width="3"
                height={height}
                fill="#a4e887"
                className="animate-pulse"
                style={{
                  animationDelay: `${delay}s`,
                  animationDuration: '1.5s',
                  opacity: 0.3 + Math.random() * 0.4
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
            <div className="absolute inset-0 rounded-full border-2 border-[#a4e887] opacity-10 animate-ping" style={{ animationDuration: '2s' }}></div>
            <div className="absolute -inset-8 rounded-full border border-[#a4e887] opacity-5"></div>
            <div className="absolute -inset-16 rounded-full border border-[#a4e887] opacity-5"></div>

            {/* Main circle */}
            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-[#1a2520] to-[#0f1612] flex items-center justify-center relative shadow-2xl shadow-[#a4e887]/20">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#a4e887]/10 to-transparent"></div>
              <Mic className="w-20 h-20 text-[#a4e887] relative z-10 animate-pulse" style={{ animationDuration: '2s' }} />
            </div>
          </div>
        </div>

        {/* Status Text */}
        <h2 className="text-3xl font-bold text-white mb-3">Analyzing audio…</h2>
        <p className="text-gray-400 mb-12">This usually takes under a minute</p>

        {/* Progress Steps */}
        <div className="bg-[#0f1612] border border-[#1a2520] rounded-xl p-8">
          <div className="space-y-5">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center gap-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${index < currentStep
                      ? 'bg-[#a4e887]'
                      : index === currentStep
                        ? 'bg-[#2a3530] border-2 border-[#a4e887]'
                        : 'bg-[#1a2520]'
                    }`}
                >
                  {index < currentStep ? (
                    <Check className="w-4 h-4 text-[#0a0f0d]" />
                  ) : index === currentStep ? (
                    <div className="w-2 h-2 rounded-full bg-[#a4e887] animate-pulse"></div>
                  ) : (
                    <span className="text-gray-600 text-sm">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-left transition-colors ${index <= currentStep ? 'text-white' : 'text-gray-600'
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

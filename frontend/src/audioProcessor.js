import { pipeline, env } from '@xenova/transformers'
import Meyda from 'meyda'

// Konfigurace pro Transformers.js
env.allowLocalModels = false // Vždy stahuj z HuggingFace
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@latest/dist/'

// Singleton pro Whisper model
let whisperPipeline = null

/**
 * Načte Whisper model (jen jednou)
 */
async function loadWhisperModel() {
  if (!whisperPipeline) {
    console.log('Loading Whisper model...')
    whisperPipeline = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      {
        quantized: true,
        progress_callback: (progress) => {
          if (progress.status === 'progress') {
            console.log(`Downloading model: ${Math.round(progress.progress)}%`)
          }
        }
      }
    )
    console.log('Whisper model loaded!')
  }
  return whisperPipeline
}

/**
 * Přepis audio na text pomocí Whisper
 */
export async function transcribeAudio(audioFile, onProgress) {
  try {
    onProgress?.({ status: 'loading', message: 'Loading Whisper model...' })
    const transcriber = await loadWhisperModel()

    onProgress?.({ status: 'processing', message: 'Transcribing audio...' })

    // Převod File na URL
    const audioUrl = URL.createObjectURL(audioFile)

    // Přepis
    const result = await transcriber(audioUrl, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    })

    // Cleanup
    URL.revokeObjectURL(audioUrl)

    return {
      text: result.text,
      chunks: result.chunks || [],
    }
  } catch (error) {
    console.error('Transcription error:', error)
    throw new Error(`Transcription failed: ${error.message}`)
  }
}

/**
 * Detekce akordů z audio souboru
 */
export async function detectChords(audioFile, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      onProgress?.({ status: 'processing', message: 'Analyzing chords...' })

      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const reader = new FileReader()

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

          // Převod na mono a resample
          const channelData = audioBuffer.getChannelData(0)
          const sampleRate = audioBuffer.sampleRate

          // Analýza chromagram pro detekci akordů
          const chords = analyzeChords(channelData, sampleRate)

          resolve(chords)
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => reject(new Error('Failed to read audio file'))
      reader.readAsArrayBuffer(audioFile)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Analýza akordů pomocí chromagram
 */
function analyzeChords(audioData, sampleRate) {
  const chords = []
  const hopSize = 2048
  const frameSize = 4096

  // Chord templates (zjednodušená verze)
  const chordTemplates = {
    'C': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    'C#': [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    'D': [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    'D#': [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
    'E': [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    'F': [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    'F#': [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    'G': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    'G#': [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    'A': [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    'A#': [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    'B': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
    'Cm': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
    'Dm': [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    'Em': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
    'Fm': [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    'Gm': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
    'Am': [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  }

  // Zpracování po segmentech (každých ~2 sekundy)
  const segmentLength = Math.floor(sampleRate * 2) // 2 sekundy

  for (let i = 0; i < audioData.length - segmentLength; i += segmentLength) {
    const segment = audioData.slice(i, i + segmentLength)

    // Výpočet chromagram pomocí Meyda
    const chromaFeatures = []

    for (let j = 0; j < segment.length - frameSize; j += hopSize) {
      const frame = Array.from(segment.slice(j, j + frameSize))

      const features = Meyda.extract('chroma', frame)
      if (features) {
        chromaFeatures.push(features)
      }
    }

    if (chromaFeatures.length > 0) {
      // Průměrná chroma pro tento segment
      const avgChroma = new Array(12).fill(0)
      chromaFeatures.forEach(chroma => {
        chroma.forEach((val, idx) => {
          avgChroma[idx] += val
        })
      })
      avgChroma.forEach((val, idx) => {
        avgChroma[idx] /= chromaFeatures.length
      })

      // Normalizace
      const maxVal = Math.max(...avgChroma)
      if (maxVal > 0) {
        avgChroma.forEach((val, idx) => {
          avgChroma[idx] /= maxVal
        })
      }

      // Najdi nejlepší shodu s akordem
      let bestChord = null
      let bestScore = 0

      for (const [chordName, template] of Object.entries(chordTemplates)) {
        // Kosinová podobnost
        let dotProduct = 0
        let normA = 0
        let normB = 0

        for (let k = 0; k < 12; k++) {
          dotProduct += avgChroma[k] * template[k]
          normA += avgChroma[k] * avgChroma[k]
          normB += template[k] * template[k]
        }

        const score = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10)

        if (score > bestScore) {
          bestScore = score
          bestChord = chordName
        }
      }

      // Přidej akord pokud je dostatečná jistota
      if (bestScore > 0.4 && bestChord) {
        const time = i / sampleRate

        // Kontrola, zda už není stejný akord
        const lastChord = chords[chords.length - 1]
        if (!lastChord || lastChord.chord !== bestChord) {
          chords.push({
            chord: bestChord,
            time: Math.round(time * 10) / 10,
            confidence: Math.round(bestScore * 100) / 100,
          })
        }
      }
    }
  }

  return chords
}

/**
 * Zpracování celého audio souboru
 */
export async function processAudioFile(audioFile, onProgress) {
  try {
    onProgress?.({ status: 'start', message: 'Starting audio processing...' })

    // Paralelní zpracování
    const [transcription, chords] = await Promise.all([
      transcribeAudio(audioFile, onProgress),
      detectChords(audioFile, onProgress),
    ])

    onProgress?.({ status: 'complete', message: 'Processing complete!' })

    // Synchronizace segmentů s akordy
    const segments = transcription.chunks.map(chunk => ({
      text: chunk.text,
      start: chunk.timestamp[0] || 0,
      end: chunk.timestamp[1] || 0,
    }))

    return {
      text: transcription.text,
      segments,
      chords,
      filename: audioFile.name,
    }
  } catch (error) {
    console.error('Processing error:', error)
    throw error
  }
}

import gradio as gr
import whisper
import librosa
import numpy as np
from typing import List, Dict
import tempfile
import os

# Načtení Whisper modelu
print("Loading Whisper model (tiny)...")
whisper_model = whisper.load_model("tiny")
print("Whisper model loaded!")


def detect_chords(audio_path: str) -> List[Dict]:
    """Detekce akordů z audio souboru."""
    try:
        y, sr = librosa.load(audio_path, sr=22050)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)

        hop_length = 512
        frame_duration = hop_length / sr

        chord_templates = {
            'C': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
            'Dm': [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'Em': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
            'F': [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            'G': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            'Am': [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        }

        chords = []
        for i in range(0, chroma.shape[1], 20):
            if i + 20 > chroma.shape[1]:
                break

            avg_chroma = np.mean(chroma[:, i:i+20], axis=1)
            best_match = None
            best_score = -1

            for chord_name, template in chord_templates.items():
                score = np.dot(avg_chroma, template) / (
                    np.linalg.norm(avg_chroma) * np.linalg.norm(template) + 1e-10
                )
                if score > best_score:
                    best_score = score
                    best_match = chord_name

            if best_score > 0.5:
                time = i * frame_duration
                chords.append({
                    "chord": best_match,
                    "time": round(time, 2),
                })

        # Sloučení duplicitních akordů
        merged_chords = []
        if chords:
            current = chords[0]
            for next_chord in chords[1:]:
                if next_chord["chord"] == current["chord"]:
                    continue
                else:
                    merged_chords.append(current)
                    current = next_chord
            merged_chords.append(current)

        return merged_chords
    except Exception as e:
        print(f"Error in chord detection: {str(e)}")
        return []


def process_audio(audio_file):
    """Zpracování audio souboru - přepis textu a detekce akordů."""
    if audio_file is None:
        return "Prosím nahraj audio soubor.", "", ""

    try:
        # Přepis textu
        result = whisper_model.transcribe(audio_file, language="en")
        text = result["text"].strip()

        # Detekce akordů
        chords = detect_chords(audio_file)

        # Formátování akordů
        if chords:
            chord_text = "Detekované akordy:\n\n"
            for chord in chords:
                chord_text += f"{chord['chord']} ({chord['time']}s)\n"
        else:
            chord_text = "Žádné akordy nebyly detekovány."

        # Timeline
        timeline = "Timeline:\n\n"
        for segment in result["segments"]:
            timeline += f"[{segment['start']:.1f}s - {segment['end']:.1f}s] {segment['text'].strip()}\n"

        return text, chord_text, timeline

    except Exception as e:
        return f"Chyba: {str(e)}", "", ""


# Gradio interface
with gr.Blocks(theme=gr.themes.Soft()) as demo:
    gr.Markdown(
        """
        # 🎵 Lyrics & Chord Detector

        Nahraj MP3 nebo WAV soubor a AI automaticky detekuje text i akordy.
        """
    )

    with gr.Row():
        with gr.Column():
            audio_input = gr.Audio(
                sources=["upload"],
                type="filepath",
                label="Nahraj audio soubor (MP3/WAV)"
            )
            process_btn = gr.Button("🎯 Analyzovat", variant="primary")

        with gr.Column():
            text_output = gr.Textbox(
                label="📝 Detekovaný text",
                lines=10,
                placeholder="Text se zobrazí zde..."
            )

    with gr.Row():
        chords_output = gr.Textbox(
            label="🎸 Detekované akordy",
            lines=8,
            placeholder="Akordy se zobrazí zde..."
        )
        timeline_output = gr.Textbox(
            label="⏱️ Timeline",
            lines=8,
            placeholder="Timeline se zobrazí zde..."
        )

    process_btn.click(
        fn=process_audio,
        inputs=[audio_input],
        outputs=[text_output, chords_output, timeline_output]
    )

    gr.Markdown(
        """
        ---
        Made with ❤️ using Whisper AI & Librosa
        """
    )

if __name__ == "__main__":
    demo.launch(share=False)

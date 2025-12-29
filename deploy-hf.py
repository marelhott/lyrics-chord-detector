#!/usr/bin/env python3
"""Deploy Lyrics & Chord Detector to Hugging Face Spaces"""

from huggingface_hub import HfApi, create_repo
import os
import shutil

# Configuration
import os
HF_TOKEN = os.getenv("HF_TOKEN", "")  # Set via environment variable
SPACE_NAME = "lyrics-chord-detector"
USERNAME = None  # Will be auto-detected

print("🚀 Deploying to Hugging Face Spaces...")
print("=" * 50)

# Initialize API
api = HfApi(token=HF_TOKEN)

# Get username
try:
    user_info = api.whoami()
    USERNAME = user_info['name']
    print(f"✓ Logged in as: {USERNAME}")
except Exception as e:
    print(f"✗ Error getting user info: {e}")
    exit(1)

# Create Space
repo_id = f"{USERNAME}/{SPACE_NAME}"
print(f"\n📦 Creating Space: {repo_id}")

try:
    create_repo(
        repo_id=repo_id,
        token=HF_TOKEN,
        repo_type="space",
        space_sdk="gradio",
        exist_ok=True
    )
    print(f"✓ Space created/exists: {repo_id}")
except Exception as e:
    print(f"✗ Error creating space: {e}")
    exit(1)

# Prepare files
print("\n📄 Preparing files...")

# Create temp directory
temp_dir = "/tmp/hf-space-deploy"
os.makedirs(temp_dir, exist_ok=True)

# Copy app.py
shutil.copy("app.py", os.path.join(temp_dir, "app.py"))
print("✓ Copied app.py")

# Copy and rename requirements
shutil.copy("requirements-hf.txt", os.path.join(temp_dir, "requirements.txt"))
print("✓ Copied requirements.txt")

# Create README
readme_content = f"""---
title: Lyrics & Chord Detector
emoji: 🎵
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
---

# Lyrics & Chord Detector

AI-powered music transcription app that detects lyrics and chords from audio files.

## Features
- 🎵 Upload MP3/WAV files
- 📝 Automatic lyrics transcription using Whisper AI
- 🎸 Chord detection using librosa
- ⏱️ Timeline with timestamps

## How to use
1. Upload an MP3 or WAV file
2. Click "Analyzovat"
3. Get lyrics, chords, and timeline!

Made with ❤️ using Whisper AI & Librosa
"""

with open(os.path.join(temp_dir, "README.md"), "w") as f:
    f.write(readme_content)
print("✓ Created README.md")

# Upload to HF
print(f"\n⬆️  Uploading to Hugging Face...")

try:
    api.upload_folder(
        folder_path=temp_dir,
        repo_id=repo_id,
        repo_type="space",
        token=HF_TOKEN,
        commit_message="Initial deployment 🚀"
    )
    print("✓ Upload complete!")
except Exception as e:
    print(f"✗ Error uploading: {e}")
    exit(1)

# Clean up
shutil.rmtree(temp_dir)

print("\n" + "=" * 50)
print("🎉 DEPLOYMENT SUCCESSFUL!")
print("=" * 50)
print(f"\n🌐 Your Space URL:")
print(f"   https://huggingface.co/spaces/{repo_id}")
print(f"\n⏳ Building... (takes ~5 minutes)")
print(f"\n📱 Once live, use this URL in Netlify:")
print(f"   VITE_API_URL=https://{USERNAME}-{SPACE_NAME}.hf.space")
print("\n✨ Done!")

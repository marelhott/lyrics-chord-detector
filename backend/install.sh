#!/bin/bash
set -e

echo "Installing CPU-only PyTorch..."
pip install torch==2.4.0+cpu torchaudio==2.4.0+cpu --extra-index-url https://download.pytorch.org/whl/cpu

echo "Installing other requirements..."
pip install -r requirements.txt

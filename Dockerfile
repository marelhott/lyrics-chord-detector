FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim-bookworm
ENV PYTHONUNBUFFERED=1 OMP_NUM_THREADS=4 MKL_NUM_THREADS=4 DATA_DIR=/data HF_HOME=/data/models COOKIE_SECURE=1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node
RUN pip install --no-cache-dir torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.studio.txt ./
RUN pip install --no-cache-dir -r requirements.studio.txt
RUN node --version
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs_6s')"
COPY backend/ ./backend/
COPY --from=frontend /app/frontend/dist ./frontend/dist
CMD ["sh", "-c", "cd backend && exec uvicorn studio:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]

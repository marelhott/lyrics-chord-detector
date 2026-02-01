import { useState } from 'react';
import { UploadScreen } from './components/UploadScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { ResultsScreen } from './components/ResultScreen'; // Note: filename is ResultScreen.jsx but exported as ResultsScreen
import { ExportModal } from './components/ExportModal';
import { transformSongData } from './lib/songUtils';

function normalizeApiUrl(value) {
  const trimmed = String(value ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return '/api';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [songData, setSongData] = useState(null);
  const [rawResult, setRawResult] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('txt');
  const [trackInfo, setTrackInfo] = useState(null); // { trackName, artistName }
  const [job, setJob] = useState(null);

  const handleFileSelect = async (selectedFile, options) => {
    const baseName = selectedFile.name.replace(/\.(mp3|wav)$/i, '')
    setFileName(baseName)
    if (baseName.includes(' - ')) {
      const [trackNameRaw, artistNameRaw] = baseName.split(' - ', 2)
      const trackName = (trackNameRaw || '').trim() || 'Unknown Track'
      const artistName = (artistNameRaw || '').trim() || 'Unknown Artist'
      setTrackInfo({ trackName, artistName })
    } else {
      setTrackInfo(null)
    }
    setCurrentScreen('processing');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('vocal_heavy', String(Boolean(options?.vocalHeavy)));
    if (options?.language && options.language !== 'auto') {
      formData.append('language', options.language);
    }

    try {
      const response = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Processing failed');
        } else {
          const text = await response.text();
          console.error("Non-JSON error response:", text);
          throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
        }
      }

      const { job_id } = await response.json();
      setJob({ id: job_id, status: 'queued', progress: 0, step: 'queued' });

      while (true) {
        await sleep(900);
        const jobResponse = await fetch(`${API_URL}/jobs/${job_id}`);
        if (!jobResponse.ok) {
          throw new Error('Failed to poll job status');
        }
        const jobData = await jobResponse.json();
        setJob(jobData.job);

        if (jobData.job.status === 'failed') {
          throw new Error(jobData.job.error || 'Processing failed');
        }

        if (jobData.job.status === 'succeeded') {
          const resultResponse = await fetch(`${API_URL}/jobs/${job_id}/result`);
          if (!resultResponse.ok) {
            throw new Error('Failed to fetch job result');
          }
          const backendData = await resultResponse.json();
          const resultTitle = backendData.title || baseName || 'Untitled song'
          const resultArtist = backendData.artist || ''
          setFileName(resultArtist ? `${resultTitle} - ${resultArtist}` : resultTitle)
          if (backendData.title) {
            setTrackInfo({
              trackName: resultTitle,
              artistName: resultArtist || 'Unknown Artist',
            })
          }
          setRawResult(backendData);
          const transformedData = transformSongData(backendData);
          setSongData(transformedData);
          setCurrentScreen('result');
          setJob(null);
          break;
        }
      }

    } catch (err) {
      console.error('Error processing file:', err);
      alert(`Error: ${err.message}`);
      setCurrentScreen('upload');
      setJob(null);
    }
  };

  const handleSpotifySubmit = async (spotifyUrl, options) => {
    // Extract track info from URL for display
    try {
      const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
      const data = await response.json();
      const title = data.title || '';

      let trackName = 'Unknown Track';
      let artistName = 'Unknown Artist';

      if (title.includes('·')) {
        const parts = title.split('·');
        trackName = parts[0].trim();
        artistName = parts[1]?.trim() || 'Unknown Artist';
      } else if (title.includes(' - ')) {
        const parts = title.split(' - ');
        trackName = parts[0].trim();
        artistName = parts[1]?.trim() || 'Unknown Artist';
      }

      setTrackInfo({ trackName, artistName });
      setFileName(`${trackName} - ${artistName}`);
    } catch (err) {
      console.error('Failed to extract track info:', err);
      setTrackInfo({ trackName: 'Spotify Track', artistName: '' });
      setFileName('Spotify Track');
    }

    setCurrentScreen('processing');

    const formData = new FormData();
    formData.append('spotify_url', spotifyUrl);
    formData.append('vocal_heavy', String(Boolean(options?.vocalHeavy)));
    if (options?.language && options.language !== 'auto') {
      formData.append('language', options.language);
    }

    try {
      const response = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Download failed');
        } else {
          const text = await response.text();
          console.error("Non-JSON error response:", text);
          throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
        }
      }

      const { job_id } = await response.json();
      setJob({ id: job_id, status: 'queued', progress: 0, step: 'queued' });

      while (true) {
        await sleep(900);
        const jobResponse = await fetch(`${API_URL}/jobs/${job_id}`);
        if (!jobResponse.ok) {
          throw new Error('Failed to poll job status');
        }
        const jobData = await jobResponse.json();
        setJob(jobData.job);

        if (jobData.job.status === 'failed') {
          throw new Error(jobData.job.error || 'Download failed');
        }

        if (jobData.job.status === 'succeeded') {
          const resultResponse = await fetch(`${API_URL}/jobs/${job_id}/result`);
          if (!resultResponse.ok) {
            throw new Error('Failed to fetch job result');
          }
          const backendData = await resultResponse.json();
          const resultTitle = backendData.title || trackInfo?.trackName || 'Spotify Track'
          const resultArtist = backendData.artist || trackInfo?.artistName || ''
          setFileName(resultArtist ? `${resultTitle} - ${resultArtist}` : resultTitle);
          setTrackInfo({
            trackName: resultTitle,
            artistName: resultArtist || 'Unknown Artist',
          })
          setRawResult(backendData);
          const transformedData = transformSongData(backendData);
          setSongData(transformedData);
          setCurrentScreen('result');
          setJob(null);
          break;
        }
      }

    } catch (err) {
      console.error('Error downloading from Spotify:', err);
      alert(`Error: ${err.message}`);
      setCurrentScreen('upload');
      setJob(null);
    }
  };

  const handleNewAnalysis = () => {
    setFileName('');
    setSongData(null);
    setRawResult(null);
    setCurrentScreen('upload');
    setJob(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {currentScreen === 'upload' && (
        <UploadScreen onFileSelect={handleFileSelect} onSpotifySubmit={handleSpotifySubmit} />
      )}

      {currentScreen === 'processing' && (
        <ProcessingScreen trackInfo={trackInfo} job={job} />
      )}

      {currentScreen === 'result' && songData && (
        <ResultsScreen
          fileName={fileName}
          songData={songData}
          rawResult={rawResult}
          onExport={(format) => {
            setExportFormat(format);
            setShowExportModal(true);
          }}
          onNewAnalysis={handleNewAnalysis}
        />
      )}

      {showExportModal && (
        <ExportModal
          key={exportFormat}
          result={rawResult}
          defaultFormat={exportFormat}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}

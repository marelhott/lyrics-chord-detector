import { useState } from 'react';
import { UploadScreen } from './components/UploadScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { ResultsScreen } from './components/ResultScreen'; // Note: filename is ResultScreen.jsx but exported as ResultsScreen
import { ExportModal } from './components/ExportModal';
import { transformSongData } from './lib/songUtils';

// Backend URL - set VITE_API_URL in Railway frontend service to backend URL (e.g. https://xyz.railway.app/api)
// For local dev, defaults to localhost:8000/api
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [songData, setSongData] = useState(null);
  const [rawResult, setRawResult] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('txt');
  const [trackInfo, setTrackInfo] = useState(null); // { trackName, artistName }

  const handleFileSelect = async (selectedFile) => {
    const cleanFileName = selectedFile.name.replace(/\.(mp3|wav)$/i, '');
    setFileName(cleanFileName);

    // Try to extract artist and track from filename
    // Common formats: "Artist - Track", "Artist-Track", "Track"
    let trackName = cleanFileName;
    let artistName = '';

    if (cleanFileName.includes(' - ')) {
      const parts = cleanFileName.split(' - ');
      artistName = parts[0].trim();
      trackName = parts[1]?.trim() || cleanFileName;
    } else if (cleanFileName.includes('-')) {
      const parts = cleanFileName.split('-');
      artistName = parts[0].trim();
      trackName = parts[1]?.trim() || cleanFileName;
    }

    setTrackInfo({ trackName, artistName });
    setCurrentScreen('processing');

    const formData = new FormData();
    formData.append('file', selectedFile);
    // Optional: Add quality parameter if we want to expose it later
    // formData.append('quality', 'premium'); 

    try {
      const response = await fetch(`${API_URL}/process-audio`, {
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

      const backendData = await response.json();
      console.log('Backend Data:', backendData);

      setRawResult(backendData);

      const transformedData = transformSongData(backendData);
      console.log('Transformed Data:', transformedData);

      setSongData(transformedData);
      setCurrentScreen('result');

    } catch (err) {
      console.error('Error processing file:', err);
      alert(`Error: ${err.message}`);
      setCurrentScreen('upload');
    }
  };

  const handleSpotifySubmit = async (spotifyUrl) => {
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

    try {
      const response = await fetch(`${API_URL}/download-spotify`, {
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

      const backendData = await response.json();
      console.log('Backend Data:', backendData);

      setFileName(backendData.title || 'Spotify Track');
      setRawResult(backendData);

      const transformedData = transformSongData(backendData);
      console.log('Transformed Data:', transformedData);

      setSongData(transformedData);
      setCurrentScreen('result');

    } catch (err) {
      console.error('Error downloading from Spotify:', err);
      alert(`Error: ${err.message}`);
      setCurrentScreen('upload');
    }
  };

  const handleNewAnalysis = () => {
    setFileName('');
    setSongData(null);
    setRawResult(null);
    setCurrentScreen('upload');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {currentScreen === 'upload' && (
        <UploadScreen onFileSelect={handleFileSelect} onSpotifySubmit={handleSpotifySubmit} />
      )}

      {currentScreen === 'processing' && (
        <ProcessingScreen trackInfo={trackInfo} />
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

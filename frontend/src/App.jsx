import { useState } from 'react';
import { UploadScreen } from './components/UploadScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { ResultsScreen } from './components/ResultScreen'; // Note: filename is ResultScreen.jsx but exported as ResultsScreen
import { ExportModal } from './components/ExportModal';
import { transformSongData } from './lib/songUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [songData, setSongData] = useState(null);
  const [rawResult, setRawResult] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('txt');

  const handleFileSelect = async (selectedFile) => {
    setFileName(selectedFile.name.replace(/\.(mp3|wav)$/i, ''));
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
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Processing failed');
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

  const handleNewAnalysis = () => {
    setFileName('');
    setSongData(null);
    setRawResult(null);
    setCurrentScreen('upload');
  };

  return (
    <div className="min-h-screen bg-[#0a0f0d]">
      {currentScreen === 'upload' && (
        <UploadScreen onFileSelect={handleFileSelect} />
      )}

      {currentScreen === 'processing' && (
        <ProcessingScreen />
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

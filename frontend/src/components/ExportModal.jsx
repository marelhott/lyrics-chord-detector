import { X, FileText, FileDown, FileJson, Download } from 'lucide-react';
import { useState } from 'react';

export function ExportModal({ onClose }) {
  const [selectedFormat, setSelectedFormat] = useState('txt');

  const handleExport = () => {
    // Simulate export - in real app this would trigger download
    alert(`Exporting as ${selectedFormat.toUpperCase()}...`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#0f1612] border border-[#1a2520] rounded-2xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1a2520]">
          <h2 className="text-xl font-semibold text-white">Export song</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[#1a2520] transition-colors flex items-center justify-center text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-400 text-sm mb-6">
            Choose your preferred export format
          </p>

          <div className="space-y-3 mb-8">
            {/* TXT Option */}
            <button
              onClick={() => setSelectedFormat('txt')}
              className={`w-full p-4 rounded-xl border transition-all flex items-start gap-4 ${selectedFormat === 'txt'
                  ? 'border-[#a4e887] bg-[#1a2520]'
                  : 'border-[#1a2520] bg-[#0a0f0d] hover:border-[#2a3530]'
                }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedFormat === 'txt' ? 'bg-[#a4e887]' : 'bg-[#1a2520]'
                }`}>
                <FileText className={`w-5 h-5 ${selectedFormat === 'txt' ? 'text-[#0a0f0d]' : 'text-gray-400'
                  }`} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-medium mb-1">TXT</div>
                <div className="text-gray-400 text-sm">Plain text format</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 mt-1 ${selectedFormat === 'txt'
                  ? 'border-[#a4e887] bg-[#a4e887]'
                  : 'border-[#2a3530]'
                }`}>
                {selectedFormat === 'txt' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#0a0f0d]"></div>
                  </div>
                )}
              </div>
            </button>

            {/* PDF Option */}
            <button
              onClick={() => setSelectedFormat('pdf')}
              className={`w-full p-4 rounded-xl border transition-all flex items-start gap-4 ${selectedFormat === 'pdf'
                  ? 'border-[#a4e887] bg-[#1a2520]'
                  : 'border-[#1a2520] bg-[#0a0f0d] hover:border-[#2a3530]'
                }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedFormat === 'pdf' ? 'bg-[#a4e887]' : 'bg-[#1a2520]'
                }`}>
                <FileDown className={`w-5 h-5 ${selectedFormat === 'pdf' ? 'text-[#0a0f0d]' : 'text-gray-400'
                  }`} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-medium mb-1">PDF</div>
                <div className="text-gray-400 text-sm">Printable chord sheet</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 mt-1 ${selectedFormat === 'pdf'
                  ? 'border-[#a4e887] bg-[#a4e887]'
                  : 'border-[#2a3530]'
                }`}>
                {selectedFormat === 'pdf' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#0a0f0d]"></div>
                  </div>
                )}
              </div>
            </button>

            {/* JSON Option */}
            <button
              onClick={() => setSelectedFormat('json')}
              className={`w-full p-4 rounded-xl border transition-all flex items-start gap-4 ${selectedFormat === 'json'
                  ? 'border-[#a4e887] bg-[#1a2520]'
                  : 'border-[#1a2520] bg-[#0a0f0d] hover:border-[#2a3530]'
                }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedFormat === 'json' ? 'bg-[#a4e887]' : 'bg-[#1a2520]'
                }`}>
                <FileJson className={`w-5 h-5 ${selectedFormat === 'json' ? 'text-[#0a0f0d]' : 'text-gray-400'
                  }`} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-medium mb-1">JSON</div>
                <div className="text-gray-400 text-sm">Structured data format</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 mt-1 ${selectedFormat === 'json'
                  ? 'border-[#a4e887] bg-[#a4e887]'
                  : 'border-[#2a3530]'
                }`}>
                {selectedFormat === 'json' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#0a0f0d]"></div>
                  </div>
                )}
              </div>
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-[#0a0f0d] border border-[#1a2520] text-gray-300 rounded-lg hover:border-[#2a3530] transition-all font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              className="flex-1 px-4 py-3 bg-[#a4e887] text-[#0a0f0d] rounded-lg hover:bg-[#b5f497] transition-all font-medium flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

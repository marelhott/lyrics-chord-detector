import { X, FileText, FileDown, FileJson, Download } from 'lucide-react';
import { useState } from 'react';
import { jsPDF } from 'jspdf'

export function ExportModal({ result, defaultFormat, onClose }) {
  const [selectedFormat, setSelectedFormat] = useState(defaultFormat || 'txt');

  const filenameBase = (result?.filename || 'song').replace(/\.(mp3|wav)$/i, '')

  const exportAsTXT = () => {
    const formattedOutput = result?.formatted_output || ''
    const blob = new Blob([formattedOutput], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filenameBase}_chords.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportAsJSON = () => {
    const { filename: _filename, ...data } = result || {}
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filenameBase}_data.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportAsPDF = () => {
    const formattedOutput = result?.formatted_output || ''
    const doc = new jsPDF()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const lineHeight = 6
    let yPosition = margin

    doc.setFontSize(16)
    doc.setFont('courier', 'bold')
    doc.text('Song Chords & Lyrics', margin, yPosition)
    yPosition += 10

    doc.setFontSize(9)
    doc.setFont('courier', 'normal')
    doc.text(`File: ${result?.filename || 'song'}`, margin, yPosition)
    yPosition += 10

    doc.setFontSize(10)
    doc.setFont('courier', 'normal')

    const lines = formattedOutput.split('\n')
    for (const line of lines) {
      if (yPosition + lineHeight > pageHeight - margin) {
        doc.addPage()
        yPosition = margin
      }

      if (line.trim().startsWith('[')) {
        doc.setFont('courier', 'bold')
        doc.text(line, margin, yPosition)
        doc.setFont('courier', 'normal')
      } else {
        doc.text(line, margin, yPosition)
      }

      yPosition += lineHeight
    }

    doc.save(`${filenameBase}_chords.pdf`)
  }

  const handleExport = () => {
    if (!result) {
      return
    }

    if (selectedFormat === 'txt') exportAsTXT()
    if (selectedFormat === 'pdf') exportAsPDF()
    if (selectedFormat === 'json') exportAsJSON()

    onClose()
  }

  const canExportText = Boolean(result?.formatted_output)
  const canExport = Boolean(result) && (selectedFormat === 'json' || canExportText)

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Export song</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-muted transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-muted-foreground text-sm mb-6">
            Choose your preferred export format
          </p>

          <div className="space-y-3 mb-8">
            {/* TXT Option */}
            <button
              onClick={() => setSelectedFormat('txt')}
              className={`w-full p-4 rounded-xl border transition-all flex items-start gap-4 ${selectedFormat === 'txt'
                ? 'border-primary bg-muted'
                : 'border-border bg-background hover:border-primary/50'
                }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedFormat === 'txt' ? 'bg-primary' : 'bg-muted'
                }`}>
                <FileText className={`w-5 h-5 ${selectedFormat === 'txt' ? 'text-primary-foreground' : 'text-muted-foreground'
                  }`} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-foreground font-medium mb-1">TXT</div>
                <div className="text-muted-foreground text-sm">Plain text format</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 mt-1 ${selectedFormat === 'txt'
                ? 'border-primary bg-primary'
                : 'border-muted-foreground/30'
                }`}>
                {selectedFormat === 'txt' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary-foreground"></div>
                  </div>
                )}
              </div>
            </button>

            {/* PDF Option */}
            <button
              onClick={() => setSelectedFormat('pdf')}
              className={`w-full p-4 rounded-xl border transition-all flex items-start gap-4 ${selectedFormat === 'pdf'
                ? 'border-primary bg-muted'
                : 'border-border bg-background hover:border-primary/50'
                }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedFormat === 'pdf' ? 'bg-primary' : 'bg-muted'
                }`}>
                <FileDown className={`w-5 h-5 ${selectedFormat === 'pdf' ? 'text-primary-foreground' : 'text-muted-foreground'
                  }`} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-foreground font-medium mb-1">PDF</div>
                <div className="text-muted-foreground text-sm">Printable chord sheet</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 mt-1 ${selectedFormat === 'pdf'
                ? 'border-primary bg-primary'
                : 'border-muted-foreground/30'
                }`}>
                {selectedFormat === 'pdf' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary-foreground"></div>
                  </div>
                )}
              </div>
            </button>

            {/* JSON Option */}
            <button
              onClick={() => setSelectedFormat('json')}
              className={`w-full p-4 rounded-xl border transition-all flex items-start gap-4 ${selectedFormat === 'json'
                ? 'border-primary bg-muted'
                : 'border-border bg-background hover:border-primary/50'
                }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedFormat === 'json' ? 'bg-primary' : 'bg-muted'
                }`}>
                <FileJson className={`w-5 h-5 ${selectedFormat === 'json' ? 'text-primary-foreground' : 'text-muted-foreground'
                  }`} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-foreground font-medium mb-1">JSON</div>
                <div className="text-muted-foreground text-sm">Structured data format</div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 mt-1 ${selectedFormat === 'json'
                ? 'border-primary bg-primary'
                : 'border-muted-foreground/30'
                }`}>
                {selectedFormat === 'json' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary-foreground"></div>
                  </div>
                )}
              </div>
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-background border border-border text-muted-foreground rounded-lg hover:border-muted-foreground/50 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={!canExport}
              className={`flex-1 px-4 py-3 rounded-lg transition-all font-medium flex items-center justify-center gap-2 ${canExport
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
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


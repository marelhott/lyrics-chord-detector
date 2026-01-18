/**
 * Export options component
 * Allows user to export results in different formats
 */
import { jsPDF } from 'jspdf'

export default function ExportOptions({ result }) {
    if (!result) return null

    const exportAsTXT = () => {
        const { formatted_output, filename } = result

        const blob = new Blob([formatted_output], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename.replace(/\.(mp3|wav)$/i, '') + '_chords.txt'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const exportAsPDF = () => {
        const { formatted_output, filename } = result

        const doc = new jsPDF()
        const pageHeight = doc.internal.pageSize.getHeight()
        const margin = 20
        const lineHeight = 6
        let yPosition = margin

        // Header
        doc.setFontSize(16)
        doc.setFont('courier', 'bold')
        doc.text('Song Chords & Lyrics', margin, yPosition)
        yPosition += 10

        doc.setFontSize(9)
        doc.setFont('courier', 'normal')
        doc.text(`File: ${filename}`, margin, yPosition)
        yPosition += 10

        // Content
        doc.setFontSize(10)
        doc.setFont('courier', 'normal')

        const lines = formatted_output.split('\n')

        for (const line of lines) {
            // Check if we need a new page
            if (yPosition + lineHeight > pageHeight - margin) {
                doc.addPage()
                yPosition = margin
            }

            // Check if line starts with [ (section header)
            if (line.trim().startsWith('[')) {
                doc.setFont('courier', 'bold')
                doc.text(line, margin, yPosition)
                doc.setFont('courier', 'normal')
            } else {
                doc.text(line, margin, yPosition)
            }

            yPosition += lineHeight
        }

        // Download
        const pdfFilename = filename.replace(/\.(mp3|wav)$/i, '') + '_chords.pdf'
        doc.save(pdfFilename)
    }

    const exportAsJSON = () => {
        const { filename, ...data } = result

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename.replace(/\.(mp3|wav)$/i, '') + '_data.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="flex flex-wrap gap-3">
            <button
                onClick={exportAsTXT}
                className="group flex items-center gap-2 px-4 py-2.5 glass rounded-xl font-semibold text-xs uppercase tracking-wider text-neutral-300 hover:border-accent-cyan/50 hover:text-accent-cyan transition-all active:scale-95"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                TXT
            </button>

            <button
                onClick={exportAsPDF}
                className="group flex items-center gap-2 px-4 py-2.5 glass rounded-xl font-semibold text-xs uppercase tracking-wider text-neutral-300 hover:border-accent-pink/50 hover:text-accent-pink transition-all active:scale-95"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF
            </button>

            <button
                onClick={exportAsJSON}
                className="group flex items-center gap-2 px-4 py-2.5 glass rounded-xl font-semibold text-xs uppercase tracking-wider text-neutral-300 hover:border-accent-purple/50 hover:text-accent-purple transition-all active:scale-95"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                JSON
            </button>
        </div>
    )
}

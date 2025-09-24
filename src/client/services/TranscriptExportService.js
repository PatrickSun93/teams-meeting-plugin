/**
 * TranscriptExportService - Handles transcript export to various formats
 * Supports PDF, Word (DOCX), and plain text exports
 */

class TranscriptExportService {
  constructor() {
    this.supportedFormats = ['pdf', 'docx', 'txt', 'json'];
  }

  /**
   * Export transcript to specified format
   */
  async exportTranscript(transcript, format, options = {}) {
    if (!this.supportedFormats.includes(format)) {
      throw new Error(`Unsupported export format: ${format}`);
    }

    const exportData = this._prepareExportData(transcript, options);

    switch (format) {
      case 'pdf':
        return await this._exportToPDF(exportData, options);
      case 'docx':
        return await this._exportToWord(exportData, options);
      case 'txt':
        return this._exportToText(exportData, options);
      case 'json':
        return this._exportToJSON(exportData, options);
      default:
        throw new Error(`Export format ${format} not implemented`);
    }
  }

  /**
   * Export multiple transcripts as a batch
   */
  async exportBatch(transcripts, format, options = {}) {
    const exports = [];
    
    for (const transcript of transcripts) {
      try {
        const exported = await this.exportTranscript(transcript, format, {
          ...options,
          filename: `${transcript.title}_${transcript.id}.${format}`
        });
        exports.push({ transcript: transcript.id, success: true, data: exported });
      } catch (error) {
        exports.push({ transcript: transcript.id, success: false, error: error.message });
      }
    }

    return exports;
  }

  /**
   * Prepare transcript data for export
   */
  _prepareExportData(transcript, options = {}) {
    const data = {
      title: transcript.title || 'Meeting Transcript',
      meetingId: transcript.meetingId,
      platform: transcript.platform,
      date: new Date(transcript.createdAt).toLocaleString(),
      duration: this._calculateDuration(transcript.content),
      participants: this._extractParticipants(transcript.content),
      segments: transcript.content.segments || [],
      metadata: transcript.metadata || {},
      exportedAt: new Date().toLocaleString(),
      exportOptions: options
    };

    // Apply filters if specified
    if (options.speakerFilter && options.speakerFilter.length > 0) {
      data.segments = data.segments.filter(s => 
        options.speakerFilter.includes(s.speakerId)
      );
    }

    if (options.timeRange) {
      data.segments = data.segments.filter(s => 
        s.startTime >= options.timeRange.start && 
        s.endTime <= options.timeRange.end
      );
    }

    return data;
  }

  /**
   * Export to PDF format
   */
  async _exportToPDF(data, options = {}) {
    // For browser environment, we'll create a printable HTML version
    // In a real implementation, you'd use a library like jsPDF or Puppeteer
    
    const htmlContent = this._generateHTML(data, options);
    
    if (options.returnHTML) {
      return htmlContent;
    }

    // Create a blob for download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    
    return {
      blob: blob,
      filename: options.filename || `${data.title.replace(/[^a-z0-9]/gi, '_')}.html`,
      mimeType: 'text/html',
      instructions: 'Open this HTML file in a browser and use Print > Save as PDF'
    };
  }

  /**
   * Export to Word format (simplified DOCX)
   */
  async _exportToWord(data, options = {}) {
    // For a full implementation, you'd use a library like docx or mammoth
    // Here we'll create a simple RTF format that Word can open
    
    const rtfContent = this._generateRTF(data, options);
    const blob = new Blob([rtfContent], { type: 'application/rtf' });
    
    return {
      blob: blob,
      filename: options.filename || `${data.title.replace(/[^a-z0-9]/gi, '_')}.rtf`,
      mimeType: 'application/rtf'
    };
  }

  /**
   * Export to plain text format
   */
  _exportToText(data, options = {}) {
    let content = '';
    
    // Header
    content += `${data.title}\n`;
    content += `${'='.repeat(data.title.length)}\n\n`;
    content += `Meeting ID: ${data.meetingId}\n`;
    content += `Platform: ${data.platform}\n`;
    content += `Date: ${data.date}\n`;
    content += `Duration: ${data.duration}\n`;
    content += `Participants: ${data.participants.join(', ')}\n\n`;

    // Transcript content
    if (options.includeTimestamps) {
      data.segments.forEach(segment => {
        const timestamp = this._formatTimestamp(segment.startTime);
        const speaker = segment.speakerName || segment.speakerId || 'Unknown';
        content += `[${timestamp}] ${speaker}: ${segment.text}\n`;
      });
    } else {
      let currentSpeaker = null;
      data.segments.forEach(segment => {
        const speaker = segment.speakerName || segment.speakerId || 'Unknown';
        if (speaker !== currentSpeaker) {
          content += `\n${speaker}:\n`;
          currentSpeaker = speaker;
        }
        content += `${segment.text} `;
      });
    }

    // Footer
    content += `\n\n---\nExported on ${data.exportedAt}\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    
    return {
      blob: blob,
      filename: options.filename || `${data.title.replace(/[^a-z0-9]/gi, '_')}.txt`,
      mimeType: 'text/plain'
    };
  }

  /**
   * Export to JSON format
   */
  _exportToJSON(data, options = {}) {
    const jsonData = {
      ...data,
      exportFormat: 'json',
      version: '1.0'
    };

    const content = JSON.stringify(jsonData, null, options.pretty ? 2 : 0);
    const blob = new Blob([content], { type: 'application/json' });
    
    return {
      blob: blob,
      filename: options.filename || `${data.title.replace(/[^a-z0-9]/gi, '_')}.json`,
      mimeType: 'application/json'
    };
  }

  /**
   * Generate HTML content for PDF export
   */
  _generateHTML(data, options = {}) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${data.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .metadata { color: #666; font-size: 14px; }
        .participants { margin: 20px 0; }
        .transcript { margin-top: 30px; }
        .segment { margin-bottom: 15px; }
        .speaker { font-weight: bold; color: #2c5aa0; }
        .timestamp { color: #888; font-size: 12px; }
        .text { margin-left: 20px; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 12px; color: #666; }
        @media print {
            body { margin: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${data.title}</div>
        <div class="metadata">
            <div>Meeting ID: ${data.meetingId}</div>
            <div>Platform: ${data.platform}</div>
            <div>Date: ${data.date}</div>
            <div>Duration: ${data.duration}</div>
        </div>
        <div class="participants">
            <strong>Participants:</strong> ${data.participants.join(', ')}
        </div>
    </div>

    <div class="transcript">
        ${data.segments.map(segment => `
            <div class="segment">
                <div class="speaker">
                    ${segment.speakerName || segment.speakerId || 'Unknown Speaker'}
                    ${options.includeTimestamps ? `<span class="timestamp">[${this._formatTimestamp(segment.startTime)}]</span>` : ''}
                </div>
                <div class="text">${segment.text}</div>
            </div>
        `).join('')}
    </div>

    <div class="footer">
        Exported on ${data.exportedAt}
    </div>
</body>
</html>`;
  }

  /**
   * Generate RTF content for Word export
   */
  _generateRTF(data, options = {}) {
    let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}';
    
    // Title
    rtf += `\\f0\\fs28\\b ${data.title}\\b0\\fs20\\par\\par`;
    
    // Metadata
    rtf += `Meeting ID: ${data.meetingId}\\par`;
    rtf += `Platform: ${data.platform}\\par`;
    rtf += `Date: ${data.date}\\par`;
    rtf += `Duration: ${data.duration}\\par`;
    rtf += `Participants: ${data.participants.join(', ')}\\par\\par`;
    
    // Transcript
    data.segments.forEach(segment => {
      const speaker = segment.speakerName || segment.speakerId || 'Unknown Speaker';
      const timestamp = options.includeTimestamps ? ` [${this._formatTimestamp(segment.startTime)}]` : '';
      
      rtf += `\\b ${speaker}${timestamp}:\\b0\\par`;
      rtf += `${segment.text}\\par\\par`;
    });
    
    // Footer
    rtf += `\\par Exported on ${data.exportedAt}`;
    rtf += '}';
    
    return rtf;
  }

  /**
   * Download exported file
   */
  downloadFile(exportResult) {
    const url = URL.createObjectURL(exportResult.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get export preview
   */
  getExportPreview(transcript, format, options = {}) {
    const data = this._prepareExportData(transcript, options);
    
    switch (format) {
      case 'txt':
        return this._exportToText(data, { ...options, preview: true });
      case 'json':
        return this._exportToJSON(data, { ...options, pretty: true, preview: true });
      case 'pdf':
        return this._exportToPDF(data, { ...options, returnHTML: true });
      default:
        return { error: `Preview not available for ${format}` };
    }
  }

  // Helper methods
  _calculateDuration(content) {
    if (!content.segments || content.segments.length === 0) return 'Unknown';
    
    const lastSegment = content.segments[content.segments.length - 1];
    const totalSeconds = lastSegment.endTime || lastSegment.startTime || 0;
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  _extractParticipants(content) {
    if (!content.segments) return [];
    
    const speakers = new Set();
    content.segments.forEach(segment => {
      const speaker = segment.speakerName || segment.speakerId;
      if (speaker && speaker !== 'Unknown') {
        speakers.add(speaker);
      }
    });
    
    return Array.from(speakers);
  }

  _formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }
}

export default TranscriptExportService;
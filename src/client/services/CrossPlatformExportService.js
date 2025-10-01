/**
 * CrossPlatformExportService - Handles platform-specific export formats and delivery methods
 * Provides unified export capabilities across Teams, Zoom, Google Meet, and generic platforms
 */

class CrossPlatformExportService {
  constructor(transcriptStorageService, securityManager) {
    this.transcriptStorage = transcriptStorageService;
    this.securityManager = securityManager;
    this.exporters = new Map();
    this._initializeExporters();
  }

  /**
   * Initialize platform-specific exporters
   */
  _initializeExporters() {
    this.exporters.set('teams', new TeamsExporter());
    this.exporters.set('zoom', new ZoomExporter());
    this.exporters.set('meet', new MeetExporter());
    this.exporters.set('generic', new GenericExporter());
  }

  /**
   * Export transcript in platform-specific format
   */
  async exportTranscript(transcriptId, format, options = {}) {
    try {
      const exportData = await this.transcriptStorage.getPlatformExportData(transcriptId, format);
      const exporter = this.exporters.get(exportData.transcript.platform);
      
      if (!exporter) {
        throw new Error(`No exporter available for platform: ${exportData.transcript.platform}`);
      }

      // Check security permissions
      await this.securityManager.checkExportPermissions(exportData.transcript, format, options);

      const result = await exporter.export(exportData, format, options);
      
      // Log export activity
      await this._logExportActivity(transcriptId, format, options, result);
      
      return result;
    } catch (error) {
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Get available export formats for transcript
   */
  async getAvailableFormats(transcriptId) {
    const transcript = await this.transcriptStorage.getTranscript(transcriptId);
    if (!transcript) {
      throw new Error('Transcript not found');
    }

    const exporter = this.exporters.get(transcript.platform);
    return exporter ? exporter.getSupportedFormats() : ['json', 'txt'];
  }

  /**
   * Get platform-specific delivery methods
   */
  async getDeliveryMethods(transcriptId) {
    const transcript = await this.transcriptStorage.getTranscript(transcriptId);
    if (!transcript) {
      throw new Error('Transcript not found');
    }

    const exporter = this.exporters.get(transcript.platform);
    return exporter ? exporter.getDeliveryMethods() : ['download'];
  }

  /**
   * Deliver exported transcript using platform-specific method
   */
  async deliverExport(transcriptId, format, deliveryMethod, options = {}) {
    try {
      const exportResult = await this.exportTranscript(transcriptId, format, options);
      const transcript = await this.transcriptStorage.getTranscript(transcriptId);
      const exporter = this.exporters.get(transcript.platform);

      if (!exporter) {
        throw new Error(`No exporter available for platform: ${transcript.platform}`);
      }

      const deliveryResult = await exporter.deliver(exportResult, deliveryMethod, options);
      
      // Log delivery activity
      await this._logDeliveryActivity(transcriptId, format, deliveryMethod, deliveryResult);
      
      return deliveryResult;
    } catch (error) {
      throw new Error(`Delivery failed: ${error.message}`);
    }
  }

  /**
   * Batch export multiple transcripts
   */
  async batchExport(transcriptIds, format, options = {}) {
    const results = [];
    const errors = [];

    for (const transcriptId of transcriptIds) {
      try {
        const result = await this.exportTranscript(transcriptId, format, options);
        results.push({ transcriptId, success: true, result });
      } catch (error) {
        errors.push({ transcriptId, success: false, error: error.message });
      }
    }

    return { results, errors, summary: { total: transcriptIds.length, successful: results.length, failed: errors.length } };
  }

  /**
   * Create cross-platform archive
   */
  async createCrossPlatformArchive(transcriptIds, options = {}) {
    try {
      const transcripts = [];
      const metadata = {
        createdAt: new Date(),
        version: '1.0',
        platforms: new Set(),
        totalTranscripts: transcriptIds.length
      };

      for (const transcriptId of transcriptIds) {
        const transcript = await this.transcriptStorage.getTranscript(transcriptId);
        if (transcript) {
          transcripts.push(transcript);
          metadata.platforms.add(transcript.platform);
        }
      }

      metadata.platforms = Array.from(metadata.platforms);

      const archive = {
        metadata,
        transcripts,
        format: 'cross-platform-archive',
        compression: options.compression || 'gzip'
      };

      if (options.includeAnalytics) {
        archive.analytics = await this._generateArchiveAnalytics(transcripts);
      }

      return this._compressArchive(archive, options);
    } catch (error) {
      throw new Error(`Archive creation failed: ${error.message}`);
    }
  }

  /**
   * Log export activity for audit purposes
   */
  async _logExportActivity(transcriptId, format, options, result) {
    const logEntry = {
      type: 'export',
      transcriptId,
      format,
      timestamp: new Date(),
      options: this._sanitizeOptions(options),
      success: !!result,
      size: result?.size || 0,
      userId: options.userId
    };

    // Use security manager's audit logging if available
    if (this.securityManager && this.securityManager.logActivity) {
      await this.securityManager.logActivity(logEntry);
    }
  }

  /**
   * Log delivery activity for audit purposes
   */
  async _logDeliveryActivity(transcriptId, format, deliveryMethod, result) {
    const logEntry = {
      type: 'delivery',
      transcriptId,
      format,
      deliveryMethod,
      timestamp: new Date(),
      success: !!result,
      deliveryId: result?.deliveryId
    };

    if (this.securityManager && this.securityManager.logActivity) {
      await this.securityManager.logActivity(logEntry);
    }
  }

  /**
   * Generate analytics for archive
   */
  async _generateArchiveAnalytics(transcripts) {
    const analytics = {
      platformDistribution: {},
      totalDuration: 0,
      totalParticipants: 0,
      averageMeetingLength: 0,
      dateRange: { start: null, end: null },
      topKeywords: [],
      meetingTypes: {}
    };

    transcripts.forEach(transcript => {
      // Platform distribution
      const platform = transcript.platform;
      analytics.platformDistribution[platform] = (analytics.platformDistribution[platform] || 0) + 1;

      // Duration and participants
      if (transcript.platformMetadata?.duration) {
        analytics.totalDuration += transcript.platformMetadata.duration;
      }
      if (transcript.platformMetadata?.participantCount) {
        analytics.totalParticipants += transcript.platformMetadata.participantCount;
      }

      // Date range
      const date = new Date(transcript.createdAt);
      if (!analytics.dateRange.start || date < analytics.dateRange.start) {
        analytics.dateRange.start = date;
      }
      if (!analytics.dateRange.end || date > analytics.dateRange.end) {
        analytics.dateRange.end = date;
      }

      // Meeting types
      const meetingType = transcript.platformMetadata?.meetingType || 'unknown';
      analytics.meetingTypes[meetingType] = (analytics.meetingTypes[meetingType] || 0) + 1;
    });

    analytics.averageMeetingLength = analytics.totalDuration / transcripts.length || 0;

    return analytics;
  }

  /**
   * Compress archive data
   */
  async _compressArchive(archive, options) {
    const jsonData = JSON.stringify(archive);
    
    if (options.compression === 'gzip' && typeof window !== 'undefined' && 'CompressionStream' in window) {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(new TextEncoder().encode(jsonData));
      writer.close();
      
      const chunks = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      return new Blob(chunks, { type: 'application/gzip' });
    }
    
    // Fallback to uncompressed
    return new Blob([jsonData], { type: 'application/json' });
  }

  /**
   * Sanitize options for logging
   */
  _sanitizeOptions(options) {
    const sanitized = { ...options };
    delete sanitized.apiKey;
    delete sanitized.accessToken;
    delete sanitized.password;
    return sanitized;
  }
}

/**
 * Base exporter class for platform-specific implementations
 */
class BaseExporter {
  getSupportedFormats() {
    return ['json', 'txt', 'pdf'];
  }

  getDeliveryMethods() {
    return ['download'];
  }

  async export(exportData, format, options) {
    switch (format) {
      case 'json':
        return this._exportJSON(exportData, options);
      case 'txt':
        return this._exportText(exportData, options);
      case 'pdf':
        return this._exportPDF(exportData, options);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  async deliver(exportResult, deliveryMethod, options) {
    switch (deliveryMethod) {
      case 'download':
        return this._deliverDownload(exportResult, options);
      default:
        throw new Error(`Unsupported delivery method: ${deliveryMethod}`);
    }
  }

  _exportJSON(exportData, options) {
    const data = {
      transcript: exportData.transcript,
      exportedAt: new Date(),
      format: 'json',
      platform: exportData.transcript.platform,
      platformSpecific: exportData.platformSpecific
    };

    return {
      data: JSON.stringify(data, null, 2),
      mimeType: 'application/json',
      filename: `transcript-${exportData.transcript.id}.json`,
      size: new Blob([JSON.stringify(data)]).size
    };
  }

  _exportText(exportData, options) {
    const transcript = exportData.transcript;
    let text = `Meeting Transcript\n`;
    text += `Title: ${transcript.title}\n`;
    text += `Platform: ${transcript.platform}\n`;
    text += `Date: ${new Date(transcript.createdAt).toLocaleString()}\n`;
    text += `Duration: ${transcript.platformMetadata?.duration || 'Unknown'}\n\n`;

    if (transcript.content && transcript.content.segments) {
      transcript.content.segments.forEach(segment => {
        const speaker = segment.speakerId || 'Unknown Speaker';
        text += `[${speaker}]: ${segment.text}\n`;
      });
    }

    return {
      data: text,
      mimeType: 'text/plain',
      filename: `transcript-${transcript.id}.txt`,
      size: new Blob([text]).size
    };
  }

  async _exportPDF(exportData, options) {
    // This would require a PDF library like jsPDF
    // For now, return a placeholder
    const text = this._exportText(exportData, options).data;
    
    return {
      data: text, // Would be PDF binary data
      mimeType: 'application/pdf',
      filename: `transcript-${exportData.transcript.id}.pdf`,
      size: new Blob([text]).size
    };
  }

  _deliverDownload(exportResult, options) {
    if (typeof document !== 'undefined') {
      const blob = new Blob([exportResult.data], { type: exportResult.mimeType });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = exportResult.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    return {
      success: true,
      deliveryId: `download-${Date.now()}`,
      method: 'download',
      filename: exportResult.filename
    };
  }
}

/**
 * Teams-specific exporter
 */
class TeamsExporter extends BaseExporter {
  getSupportedFormats() {
    return [...super.getSupportedFormats(), 'docx', 'teams-chat', 'onenote'];
  }

  getDeliveryMethods() {
    return [...super.getDeliveryMethods(), 'teams-chat', 'email', 'sharepoint', 'onenote'];
  }

  async export(exportData, format, options) {
    if (['docx', 'teams-chat', 'onenote'].includes(format)) {
      return this._exportTeamsSpecific(exportData, format, options);
    }
    return super.export(exportData, format, options);
  }

  async deliver(exportResult, deliveryMethod, options) {
    if (['teams-chat', 'sharepoint', 'onenote'].includes(deliveryMethod)) {
      return this._deliverTeamsSpecific(exportResult, deliveryMethod, options);
    }
    return super.deliver(exportResult, deliveryMethod, options);
  }

  async _exportTeamsSpecific(exportData, format, options) {
    const transcript = exportData.transcript;
    
    switch (format) {
      case 'teams-chat':
        return this._formatForTeamsChat(transcript, options);
      case 'docx':
        return this._formatForWord(transcript, options);
      case 'onenote':
        return this._formatForOneNote(transcript, options);
      default:
        throw new Error(`Unsupported Teams format: ${format}`);
    }
  }

  _formatForTeamsChat(transcript, options) {
    let message = `📝 **Meeting Transcript: ${transcript.title}**\n\n`;
    
    if (transcript.content && transcript.content.segments) {
      const maxLength = options.maxChatLength || 4000;
      let currentLength = message.length;
      
      for (const segment of transcript.content.segments) {
        const line = `**${segment.speakerId || 'Speaker'}:** ${segment.text}\n`;
        if (currentLength + line.length > maxLength) {
          message += '\n*[Transcript truncated - full version available as attachment]*';
          break;
        }
        message += line;
        currentLength += line.length;
      }
    }

    return {
      data: message,
      mimeType: 'text/markdown',
      filename: `teams-chat-${transcript.id}.md`,
      size: new Blob([message]).size,
      chatThreadId: transcript.platformMetadata?.chatThreadId
    };
  }

  _formatForWord(transcript, options) {
    // Would integrate with Office.js or generate DOCX format
    const content = this._exportText({ transcript }, options).data;
    
    return {
      data: content, // Would be DOCX binary data
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filename: `transcript-${transcript.id}.docx`,
      size: new Blob([content]).size
    };
  }

  _formatForOneNote(transcript, options) {
    const html = this._convertToOneNoteHTML(transcript);
    
    return {
      data: html,
      mimeType: 'text/html',
      filename: `onenote-${transcript.id}.html`,
      size: new Blob([html]).size
    };
  }

  _convertToOneNoteHTML(transcript) {
    let html = `<html><body>`;
    html += `<h1>${transcript.title}</h1>`;
    html += `<p><strong>Date:</strong> ${new Date(transcript.createdAt).toLocaleString()}</p>`;
    html += `<p><strong>Platform:</strong> ${transcript.platform}</p>`;
    
    if (transcript.content && transcript.content.segments) {
      html += `<div>`;
      transcript.content.segments.forEach(segment => {
        html += `<p><strong>${segment.speakerId || 'Speaker'}:</strong> ${segment.text}</p>`;
      });
      html += `</div>`;
    }
    
    html += `</body></html>`;
    return html;
  }

  async _deliverTeamsSpecific(exportResult, deliveryMethod, options) {
    switch (deliveryMethod) {
      case 'teams-chat':
        return this._postToTeamsChat(exportResult, options);
      case 'sharepoint':
        return this._uploadToSharePoint(exportResult, options);
      case 'onenote':
        return this._saveToOneNote(exportResult, options);
      default:
        throw new Error(`Unsupported Teams delivery method: ${deliveryMethod}`);
    }
  }

  async _postToTeamsChat(exportResult, options) {
    // Would use Microsoft Graph API to post to Teams chat
    return {
      success: true,
      deliveryId: `teams-chat-${Date.now()}`,
      method: 'teams-chat',
      chatThreadId: exportResult.chatThreadId,
      messageId: `msg-${Date.now()}`
    };
  }

  async _uploadToSharePoint(exportResult, options) {
    // Would use Microsoft Graph API to upload to SharePoint
    return {
      success: true,
      deliveryId: `sharepoint-${Date.now()}`,
      method: 'sharepoint',
      sharePointUrl: options.sharePointUrl,
      fileId: `file-${Date.now()}`
    };
  }

  async _saveToOneNote(exportResult, options) {
    // Would use Microsoft Graph API to save to OneNote
    return {
      success: true,
      deliveryId: `onenote-${Date.now()}`,
      method: 'onenote',
      notebookId: options.notebookId,
      pageId: `page-${Date.now()}`
    };
  }
}

/**
 * Zoom-specific exporter
 */
class ZoomExporter extends BaseExporter {
  getSupportedFormats() {
    return [...super.getSupportedFormats(), 'vtt', 'zoom-chat'];
  }

  getDeliveryMethods() {
    return [...super.getDeliveryMethods(), 'zoom-chat', 'email', 'cloud-recording'];
  }

  async export(exportData, format, options) {
    if (['vtt', 'zoom-chat'].includes(format)) {
      return this._exportZoomSpecific(exportData, format, options);
    }
    return super.export(exportData, format, options);
  }

  _exportZoomSpecific(exportData, format, options) {
    const transcript = exportData.transcript;
    
    switch (format) {
      case 'vtt':
        return this._formatAsVTT(transcript, options);
      case 'zoom-chat':
        return this._formatForZoomChat(transcript, options);
      default:
        throw new Error(`Unsupported Zoom format: ${format}`);
    }
  }

  _formatAsVTT(transcript, options) {
    let vtt = 'WEBVTT\n\n';
    
    if (transcript.content && transcript.content.segments) {
      transcript.content.segments.forEach((segment, index) => {
        const startTime = this._formatVTTTime(segment.startTime || index * 5);
        const endTime = this._formatVTTTime(segment.endTime || (index + 1) * 5);
        
        vtt += `${index + 1}\n`;
        vtt += `${startTime} --> ${endTime}\n`;
        vtt += `${segment.speakerId || 'Speaker'}: ${segment.text}\n\n`;
      });
    }

    return {
      data: vtt,
      mimeType: 'text/vtt',
      filename: `transcript-${transcript.id}.vtt`,
      size: new Blob([vtt]).size
    };
  }

  _formatVTTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  _formatForZoomChat(transcript, options) {
    let message = `Meeting Transcript: ${transcript.title}\n`;
    message += `Date: ${new Date(transcript.createdAt).toLocaleString()}\n\n`;
    
    if (transcript.content && transcript.content.segments) {
      transcript.content.segments.forEach(segment => {
        message += `${segment.speakerId || 'Speaker'}: ${segment.text}\n`;
      });
    }

    return {
      data: message,
      mimeType: 'text/plain',
      filename: `zoom-chat-${transcript.id}.txt`,
      size: new Blob([message]).size,
      zoomMeetingId: transcript.platformMetadata?.zoomMeetingId
    };
  }
}

/**
 * Google Meet-specific exporter
 */
class MeetExporter extends BaseExporter {
  getSupportedFormats() {
    return [...super.getSupportedFormats(), 'google-docs', 'drive-upload'];
  }

  getDeliveryMethods() {
    return [...super.getDeliveryMethods(), 'google-drive', 'gmail', 'calendar-attachment'];
  }

  async export(exportData, format, options) {
    if (['google-docs', 'drive-upload'].includes(format)) {
      return this._exportMeetSpecific(exportData, format, options);
    }
    return super.export(exportData, format, options);
  }

  _exportMeetSpecific(exportData, format, options) {
    const transcript = exportData.transcript;
    
    switch (format) {
      case 'google-docs':
        return this._formatForGoogleDocs(transcript, options);
      case 'drive-upload':
        return this._formatForDriveUpload(transcript, options);
      default:
        throw new Error(`Unsupported Meet format: ${format}`);
    }
  }

  _formatForGoogleDocs(transcript, options) {
    const html = this._convertToGoogleDocsHTML(transcript);
    
    return {
      data: html,
      mimeType: 'text/html',
      filename: `google-docs-${transcript.id}.html`,
      size: new Blob([html]).size,
      calendarEventId: transcript.platformMetadata?.calendarEventId
    };
  }

  _formatForDriveUpload(transcript, options) {
    const content = this._exportText({ transcript }, options).data;
    
    return {
      data: content,
      mimeType: 'text/plain',
      filename: `meet-transcript-${transcript.id}.txt`,
      size: new Blob([content]).size,
      driveFolder: options.driveFolder || 'Meeting Transcripts'
    };
  }

  _convertToGoogleDocsHTML(transcript) {
    let html = `<!DOCTYPE html><html><head><title>${transcript.title}</title></head><body>`;
    html += `<h1>${transcript.title}</h1>`;
    html += `<p><b>Date:</b> ${new Date(transcript.createdAt).toLocaleString()}</p>`;
    html += `<p><b>Platform:</b> Google Meet</p>`;
    
    if (transcript.content && transcript.content.segments) {
      html += `<div>`;
      transcript.content.segments.forEach(segment => {
        html += `<p><b>${segment.speakerId || 'Speaker'}:</b> ${segment.text}</p>`;
      });
      html += `</div>`;
    }
    
    html += `</body></html>`;
    return html;
  }
}

/**
 * Generic exporter for unsupported platforms
 */
class GenericExporter extends BaseExporter {
  getSupportedFormats() {
    return ['json', 'txt', 'csv'];
  }

  getDeliveryMethods() {
    return ['download', 'email'];
  }

  async export(exportData, format, options) {
    if (format === 'csv') {
      return this._exportCSV(exportData, options);
    }
    return super.export(exportData, format, options);
  }

  _exportCSV(exportData, options) {
    const transcript = exportData.transcript;
    let csv = 'Timestamp,Speaker,Text\n';
    
    if (transcript.content && transcript.content.segments) {
      transcript.content.segments.forEach(segment => {
        const timestamp = new Date(segment.startTime || 0).toISOString();
        const speaker = (segment.speakerId || 'Unknown Speaker').replace(/"/g, '""');
        const text = (segment.text || '').replace(/"/g, '""');
        csv += `"${timestamp}","${speaker}","${text}"\n`;
      });
    }

    return {
      data: csv,
      mimeType: 'text/csv',
      filename: `transcript-${transcript.id}.csv`,
      size: new Blob([csv]).size
    };
  }
}

export default CrossPlatformExportService;
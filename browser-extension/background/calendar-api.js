/**
 * Google Calendar API Service
 * Handles authentication and calendar data retrieval
 */

export class CalendarAPIService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.driveAPI = new GoogleDriveAPI(this);
  }

  async authenticate() {
    try {
      // Use Chrome identity API for OAuth
      const token = await chrome.identity.getAuthToken({ interactive: true });
      this.accessToken = token;
      this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hour
      return token;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw new Error('Failed to authenticate with Google Calendar');
    }
  }

  async ensureAuthenticated() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  async getMeetingAgenda(meetingId) {
    await this.ensureAuthenticated();

    try {
      // First, try to find the calendar event by meeting ID or URL
      const events = await this.searchCalendarEvents(meetingId);
      
      if (events.length === 0) {
        console.log('No calendar event found for meeting ID:', meetingId);
        return null;
      }

      const event = events[0];
      return this.parseEventAgenda(event);
    } catch (error) {
      console.error('Failed to get meeting agenda:', error);
      throw error;
    }
  }

  async searchCalendarEvents(meetingId) {
    const now = new Date();
    const timeMin = new Date(now.getTime() - (2 * 60 * 60 * 1000)).toISOString(); // 2 hours ago
    const timeMax = new Date(now.getTime() + (2 * 60 * 60 * 1000)).toISOString(); // 2 hours from now

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      q: meetingId // Search for meeting ID in event details
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  }

  parseEventAgenda(event) {
    const agenda = {
      meetingTitle: event.summary || 'Google Meet',
      description: event.description || '',
      startTime: event.start?.dateTime || event.start?.date,
      endTime: event.end?.dateTime || event.end?.date,
      attendees: event.attendees?.map(attendee => ({
        email: attendee.email,
        name: attendee.displayName,
        status: attendee.responseStatus
      })) || [],
      items: []
    };

    // Parse agenda items from description
    if (event.description) {
      agenda.items = this.extractAgendaItems(event.description);
    }

    return agenda;
  }

  extractAgendaItems(description) {
    const items = [];
    const lines = description.split('\n');
    
    // Look for common agenda patterns
    const agendaPatterns = [
      /^\d+\.\s*(.+)$/,           // 1. Item
      /^-\s*(.+)$/,               // - Item
      /^\*\s*(.+)$/,              // * Item
      /^•\s*(.+)$/,               // • Item
      /^agenda:?\s*(.+)$/i,       // Agenda: Item
      /^topics?:?\s*(.+)$/i       // Topic: Item
    ];

    let inAgendaSection = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) continue;
      
      // Check if we're entering an agenda section
      if (/^(agenda|topics?|discussion|items?):/i.test(trimmedLine)) {
        inAgendaSection = true;
        continue;
      }
      
      // Try to match agenda item patterns
      for (const pattern of agendaPatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          items.push({
            title: match[1].trim(),
            description: '',
            estimatedDuration: null
          });
          inAgendaSection = true;
          break;
        }
      }
      
      // If we're in an agenda section and no pattern matched, 
      // treat as a simple agenda item
      if (inAgendaSection && trimmedLine.length > 3) {
        items.push({
          title: trimmedLine,
          description: '',
          estimatedDuration: null
        });
      }
    }

    return items;
  }

  async getUpcomingMeetings(maxResults = 10) {
    await this.ensureAuthenticated();

    const now = new Date().toISOString();
    const params = new URLSearchParams({
      timeMin: now,
      maxResults: maxResults.toString(),
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  }

  async revokeToken() {
    if (this.accessToken) {
      try {
        await chrome.identity.removeCachedAuthToken({ token: this.accessToken });
        this.accessToken = null;
        this.tokenExpiry = null;
      } catch (error) {
        console.error('Failed to revoke token:', error);
      }
    }
  }

  /**
   * Get Google Drive API instance
   */
  getDriveAPI() {
    return this.driveAPI;
  }
}

/**
 * Google Drive API Service
 * Handles file operations with Google Drive
 */
class GoogleDriveAPI {
  constructor(calendarAPI) {
    this.calendarAPI = calendarAPI;
  }

  async ensureAuthenticated() {
    await this.calendarAPI.ensureAuthenticated();
  }

  /**
   * Save transcript to Google Drive
   */
  async saveTranscript(transcript, format = 'txt') {
    await this.ensureAuthenticated();

    try {
      const content = this.formatTranscript(transcript, format);
      const filename = this.generateFilename(transcript, format);
      const mimeType = this.getMimeType(format);

      // Create file metadata
      const metadata = {
        name: filename,
        parents: await this.getOrCreateTranscriptFolder()
      };

      // Upload file to Google Drive
      const fileId = await this.uploadFile(metadata, content, mimeType);
      
      console.log('Transcript saved to Google Drive:', fileId);
      return { success: true, fileId, filename };
    } catch (error) {
      console.error('Failed to save transcript to Google Drive:', error);
      throw error;
    }
  }

  /**
   * Get or create transcript folder in Google Drive
   */
  async getOrCreateTranscriptFolder() {
    const folderName = 'Meeting Transcripts';
    
    // Search for existing folder
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
      {
        headers: {
          'Authorization': `Bearer ${this.calendarAPI.accessToken}`
        }
      }
    );

    const searchData = await searchResponse.json();
    
    if (searchData.files && searchData.files.length > 0) {
      return [searchData.files[0].id];
    }

    // Create new folder
    const createResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.calendarAPI.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        })
      }
    );

    const createData = await createResponse.json();
    return [createData.id];
  }

  /**
   * Upload file to Google Drive
   */
  async uploadFile(metadata, content, mimeType) {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const requestBody = 
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n` +
      content +
      close_delim;

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.calendarAPI.accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`
        },
        body: requestBody
      }
    );

    if (!response.ok) {
      throw new Error(`Drive API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Format transcript for different file types
   */
  formatTranscript(transcript, format) {
    switch (format) {
      case 'txt':
        return this.formatAsText(transcript);
      case 'json':
        return JSON.stringify(transcript, null, 2);
      case 'csv':
        return this.formatAsCSV(transcript);
      default:
        return this.formatAsText(transcript);
    }
  }

  /**
   * Format transcript as plain text
   */
  formatAsText(transcript) {
    const lines = [];
    
    if (transcript.meetingInfo) {
      lines.push(`Meeting: ${transcript.meetingInfo.title || 'Google Meet'}`);
      lines.push(`Date: ${new Date(transcript.meetingInfo.startTime).toLocaleString()}`);
      lines.push(`Platform: Google Meet`);
      if (transcript.meetingInfo.meetingUrl) {
        lines.push(`URL: ${transcript.meetingInfo.meetingUrl}`);
      }
      lines.push('');
    }
    
    if (transcript.agenda && transcript.agenda.items && transcript.agenda.items.length > 0) {
      lines.push('Agenda:');
      transcript.agenda.items.forEach((item, index) => {
        lines.push(`${index + 1}. ${item.title}`);
        if (item.description) {
          lines.push(`   ${item.description}`);
        }
      });
      lines.push('');
    }
    
    if (transcript.segments && transcript.segments.length > 0) {
      lines.push('Transcript:');
      lines.push('----------');
      
      transcript.segments.forEach(segment => {
        const timestamp = new Date(segment.startTime).toLocaleTimeString();
        const speaker = segment.speakerId || 'Unknown Speaker';
        const confidence = segment.confidence ? ` (${Math.round(segment.confidence * 100)}%)` : '';
        lines.push(`[${timestamp}] ${speaker}${confidence}: ${segment.text}`);
      });
    }

    if (transcript.summary) {
      lines.push('');
      lines.push('Meeting Summary:');
      lines.push('---------------');
      lines.push(transcript.summary);
    }
    
    return lines.join('\n');
  }

  /**
   * Format transcript as CSV
   */
  formatAsCSV(transcript) {
    const lines = [];
    lines.push('Timestamp,Speaker,Text,Confidence');
    
    if (transcript.segments && transcript.segments.length > 0) {
      transcript.segments.forEach(segment => {
        const timestamp = new Date(segment.startTime).toISOString();
        const speaker = (segment.speakerId || 'Unknown Speaker').replace(/"/g, '""');
        const text = (segment.text || '').replace(/"/g, '""');
        const confidence = segment.confidence || '';
        
        lines.push(`"${timestamp}","${speaker}","${text}","${confidence}"`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Generate filename for transcript
   */
  generateFilename(transcript, format) {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    
    const meetingId = transcript.meetingInfo?.id || 'meeting';
    const title = transcript.meetingInfo?.title || 'Google Meet';
    
    // Sanitize title for filename
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');
    
    return `transcript-${sanitizedTitle}-${dateStr}-${timeStr}.${format}`;
  }

  /**
   * Get MIME type for format
   */
  getMimeType(format) {
    const mimeTypes = {
      'txt': 'text/plain',
      'json': 'application/json',
      'csv': 'text/csv'
    };
    
    return mimeTypes[format] || 'text/plain';
  }
}
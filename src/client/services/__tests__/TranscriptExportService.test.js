/**
 * Tests for TranscriptExportService
 */

import TranscriptExportService from '../TranscriptExportService';

// Mock Blob constructor
global.Blob = jest.fn((content, options) => ({
  content,
  options,
  size: content[0].length
}));

// Mock URL methods
global.URL = {
  createObjectURL: jest.fn(() => 'mock-url'),
  revokeObjectURL: jest.fn()
};

// Mock document methods
global.document = {
  createElement: jest.fn(() => ({
    href: '',
    download: '',
    click: jest.fn(),
    style: {}
  })),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
};

describe('TranscriptExportService', () => {
  let service;
  let mockTranscript;

  beforeEach(() => {
    service = new TranscriptExportService();
    
    mockTranscript = {
      id: 'test-transcript-1',
      meetingId: 'meeting-123',
      title: 'Weekly Team Meeting',
      platform: 'teams',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      content: {
        segments: [
          {
            id: 'seg1',
            speakerId: 'speaker1',
            speakerName: 'John Doe',
            text: 'Hello everyone, welcome to our weekly team meeting.',
            startTime: 0,
            endTime: 4,
            confidence: 0.95
          },
          {
            id: 'seg2',
            speakerId: 'speaker2',
            speakerName: 'Jane Smith',
            text: 'Thank you John. Let\'s start with the project updates.',
            startTime: 4,
            endTime: 8,
            confidence: 0.92
          },
          {
            id: 'seg3',
            speakerId: 'speaker1',
            speakerName: 'John Doe',
            text: 'Great idea. The backend API is now complete.',
            startTime: 8,
            endTime: 12,
            confidence: 0.88
          }
        ]
      },
      metadata: {
        duration: 12,
        participantCount: 2
      },
      tags: ['weekly', 'team-meeting']
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with supported formats', () => {
      expect(service.supportedFormats).toEqual(['pdf', 'docx', 'txt', 'json']);
    });
  });

  describe('export functionality', () => {
    it('should export transcript to text format', async () => {
      const result = await service.exportTranscript(mockTranscript, 'txt');
      
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('mimeType', 'text/plain');
      expect(result.filename).toMatch(/Weekly_Team_Meeting\.txt$/);
    });

    it('should export transcript to JSON format', async () => {
      const result = await service.exportTranscript(mockTranscript, 'json');
      
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('mimeType', 'application/json');
      expect(result.filename).toMatch(/Weekly_Team_Meeting\.json$/);
    });

    it('should export transcript to PDF (HTML) format', async () => {
      const result = await service.exportTranscript(mockTranscript, 'pdf');
      
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('mimeType', 'text/html');
      expect(result).toHaveProperty('instructions');
    });

    it('should export transcript to Word (RTF) format', async () => {
      const result = await service.exportTranscript(mockTranscript, 'docx');
      
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('mimeType', 'application/rtf');
      expect(result.filename).toMatch(/Weekly_Team_Meeting\.rtf$/);
    });

    it('should throw error for unsupported format', async () => {
      await expect(service.exportTranscript(mockTranscript, 'unsupported'))
        .rejects.toThrow('Unsupported export format: unsupported');
    });

    it('should use custom filename when provided', async () => {
      const options = { filename: 'custom-name.txt' };
      const result = await service.exportTranscript(mockTranscript, 'txt', options);
      
      expect(result.filename).toBe('custom-name.txt');
    });
  });

  describe('batch export', () => {
    it('should export multiple transcripts', async () => {
      const transcript2 = {
        ...mockTranscript,
        id: 'test-transcript-2',
        title: 'Daily Standup'
      };
      
      const transcripts = [mockTranscript, transcript2];
      const results = await service.exportBatch(transcripts, 'txt');
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('success', true);
      expect(results[1]).toHaveProperty('success', true);
    });

    it('should handle batch export errors gracefully', async () => {
      const invalidTranscript = { ...mockTranscript, content: null };
      const transcripts = [mockTranscript, invalidTranscript];
      
      const results = await service.exportBatch(transcripts, 'txt');
      
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('success', true);
      expect(results[1]).toHaveProperty('success', false);
      expect(results[1]).toHaveProperty('error');
    });
  });

  describe('data preparation', () => {
    it('should prepare export data correctly', () => {
      const data = service._prepareExportData(mockTranscript);
      
      expect(data).toHaveProperty('title', 'Weekly Team Meeting');
      expect(data).toHaveProperty('meetingId', 'meeting-123');
      expect(data).toHaveProperty('platform', 'teams');
      expect(data).toHaveProperty('participants');
      expect(data).toHaveProperty('segments');
      expect(data).toHaveProperty('exportedAt');
      
      expect(data.participants).toEqual(['John Doe', 'Jane Smith']);
      expect(data.segments).toHaveLength(3);
    });

    it('should apply speaker filter', () => {
      const options = { speakerFilter: ['speaker1'] };
      const data = service._prepareExportData(mockTranscript, options);
      
      expect(data.segments).toHaveLength(2);
      expect(data.segments.every(s => s.speakerId === 'speaker1')).toBe(true);
    });

    it('should apply time range filter', () => {
      const options = { timeRange: { start: 2, end: 10 } };
      const data = service._prepareExportData(mockTranscript, options);
      
      expect(data.segments).toHaveLength(1);
      expect(data.segments[0].startTime).toBeGreaterThanOrEqual(2);
      expect(data.segments[0].endTime).toBeLessThanOrEqual(10);
    });
  });

  describe('text export', () => {
    it('should generate text with timestamps', () => {
      const data = service._prepareExportData(mockTranscript);
      const result = service._exportToText(data, { includeTimestamps: true });
      
      expect(result.blob.content[0]).toContain('[00:00]');
      expect(result.blob.content[0]).toContain('John Doe:');
      expect(result.blob.content[0]).toContain('Hello everyone');
    });

    it('should generate text without timestamps', () => {
      const data = service._prepareExportData(mockTranscript);
      const result = service._exportToText(data, { includeTimestamps: false });
      
      expect(result.blob.content[0]).not.toContain('[00:00]');
      expect(result.blob.content[0]).toContain('John Doe:');
      expect(result.blob.content[0]).toContain('Hello everyone');
    });

    it('should group consecutive segments by speaker', () => {
      const data = service._prepareExportData(mockTranscript);
      const result = service._exportToText(data, { includeTimestamps: false });
      
      const content = result.blob.content[0];
      const johnSections = content.split('John Doe:').length - 1;
      expect(johnSections).toBe(2); // Two separate sections for John
    });
  });

  describe('JSON export', () => {
    it('should generate formatted JSON', () => {
      const data = service._prepareExportData(mockTranscript);
      const result = service._exportToJSON(data, { pretty: true });
      
      expect(result.blob.options.type).toBe('application/json');
      
      // Parse the JSON to verify structure
      const jsonContent = JSON.parse(result.blob.content[0]);
      expect(jsonContent).toHaveProperty('title');
      expect(jsonContent).toHaveProperty('segments');
      expect(jsonContent).toHaveProperty('exportFormat', 'json');
      expect(jsonContent).toHaveProperty('version', '1.0');
    });

    it('should generate compact JSON', () => {
      const data = service._prepareExportData(mockTranscript);
      const result = service._exportToJSON(data, { pretty: false });
      
      const content = result.blob.content[0];
      expect(content).not.toContain('\n  '); // No indentation
    });
  });

  describe('HTML export', () => {
    it('should generate HTML with proper structure', () => {
      const data = service._prepareExportData(mockTranscript);
      const html = service._generateHTML(data, { includeTimestamps: true });
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Weekly Team Meeting</title>');
      expect(html).toContain('John Doe');
      expect(html).toContain('Hello everyone');
      expect(html).toContain('[00:00]');
    });

    it('should generate HTML without timestamps', () => {
      const data = service._prepareExportData(mockTranscript);
      const html = service._generateHTML(data, { includeTimestamps: false });
      
      expect(html).toContain('John Doe');
      expect(html).not.toContain('[00:00]');
    });
  });

  describe('RTF export', () => {
    it('should generate RTF with proper formatting', () => {
      const data = service._prepareExportData(mockTranscript);
      const rtf = service._generateRTF(data, { includeTimestamps: true });
      
      expect(rtf).toMatch(/^{\\rtf1/);
      expect(rtf).toContain('Weekly Team Meeting');
      expect(rtf).toContain('John Doe');
      expect(rtf).toContain('[00:00]');
      expect(rtf).toMatch(/}$/);
    });

    it('should generate RTF without timestamps', () => {
      const data = service._prepareExportData(mockTranscript);
      const rtf = service._generateRTF(data, { includeTimestamps: false });
      
      expect(rtf).toContain('John Doe');
      expect(rtf).not.toContain('[00:00]');
    });
  });

  describe('file download', () => {
    it('should trigger file download', () => {
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn()
      };
      
      document.createElement = jest.fn(() => mockLink);
      
      const exportResult = {
        blob: new Blob(['test content']),
        filename: 'test.txt'
      };
      
      service.downloadFile(exportResult);
      
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.href).toBe('mock-url');
      expect(mockLink.download).toBe('test.txt');
      expect(mockLink.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
    });
  });

  describe('export preview', () => {
    it('should generate text preview', () => {
      const preview = service.getExportPreview(mockTranscript, 'txt');
      
      expect(preview).toHaveProperty('blob');
      expect(preview).toHaveProperty('filename');
    });

    it('should generate JSON preview', () => {
      const preview = service.getExportPreview(mockTranscript, 'json');
      
      expect(preview).toHaveProperty('blob');
      expect(preview.blob.content[0]).toContain('"title"');
    });

    it('should generate HTML preview', () => {
      const preview = service.getExportPreview(mockTranscript, 'pdf');
      
      expect(typeof preview).toBe('string');
      expect(preview).toContain('<!DOCTYPE html>');
    });

    it('should return error for unsupported preview format', () => {
      const preview = service.getExportPreview(mockTranscript, 'unsupported');
      
      expect(preview).toHaveProperty('error');
    });
  });

  describe('helper methods', () => {
    it('should calculate duration correctly', () => {
      const content = {
        segments: [
          { startTime: 0, endTime: 30 },
          { startTime: 30, endTime: 90 },
          { startTime: 90, endTime: 150 }
        ]
      };
      
      const duration = service._calculateDuration(content);
      expect(duration).toBe('2m 30s');
    });

    it('should handle duration with hours', () => {
      const content = {
        segments: [
          { startTime: 0, endTime: 3665 } // 1h 1m 5s
        ]
      };
      
      const duration = service._calculateDuration(content);
      expect(duration).toBe('1h 1m 5s');
    });

    it('should extract participants correctly', () => {
      const participants = service._extractParticipants(mockTranscript.content);
      
      expect(participants).toEqual(['John Doe', 'Jane Smith']);
    });

    it('should format timestamps correctly', () => {
      expect(service._formatTimestamp(65)).toBe('01:05');
      expect(service._formatTimestamp(3665)).toBe('01:01:05');
      expect(service._formatTimestamp(30)).toBe('00:30');
    });

    it('should handle empty content gracefully', () => {
      const emptyContent = { segments: [] };
      
      expect(service._calculateDuration(emptyContent)).toBe('Unknown');
      expect(service._extractParticipants(emptyContent)).toEqual([]);
    });
  });
});
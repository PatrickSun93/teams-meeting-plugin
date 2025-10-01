/**
 * Tests for CrossPlatformExportService
 */

import CrossPlatformExportService from '../CrossPlatformExportService.js';

// Mock dependencies
const mockTranscriptStorage = {
  getPlatformExportData: jest.fn(),
  getTranscript: jest.fn()
};

const mockSecurityManager = {
  checkExportPermissions: jest.fn(),
  logActivity: jest.fn()
};

describe('CrossPlatformExportService', () => {
  let exportService;

  beforeEach(() => {
    exportService = new CrossPlatformExportService(mockTranscriptStorage, mockSecurityManager);
    jest.clearAllMocks();
  });

  describe('exportTranscript', () => {
    it('should export transcript in specified format', async () => {
      const mockExportData = {
        transcript: {
          id: 'test-transcript',
          platform: 'teams',
          title: 'Test Meeting',
          content: {
            segments: [
              { speakerId: 'user1', text: 'Hello everyone' },
              { speakerId: 'user2', text: 'Good morning' }
            ]
          }
        },
        platformSpecific: {
          chatThreadId: 'thread-123'
        }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      const result = await exportService.exportTranscript('test-transcript', 'json');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('mimeType', 'application/json');
      expect(result).toHaveProperty('filename');
      expect(mockSecurityManager.checkExportPermissions).toHaveBeenCalled();
    });

    it('should handle Teams-specific export formats', async () => {
      const mockExportData = {
        transcript: {
          id: 'teams-transcript',
          platform: 'teams',
          title: 'Teams Meeting',
          content: { segments: [] },
          platformMetadata: { chatThreadId: 'thread-123' }
        },
        platformSpecific: { chatThreadId: 'thread-123' }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      const result = await exportService.exportTranscript('teams-transcript', 'teams-chat');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('mimeType', 'text/markdown');
      expect(result.data).toContain('Meeting Transcript: Teams Meeting');
    });

    it('should handle Zoom VTT export format', async () => {
      const mockExportData = {
        transcript: {
          id: 'zoom-transcript',
          platform: 'zoom',
          title: 'Zoom Meeting',
          content: {
            segments: [
              { speakerId: 'user1', text: 'Hello', startTime: 0, endTime: 2 },
              { speakerId: 'user2', text: 'Hi there', startTime: 3, endTime: 5 }
            ]
          }
        },
        platformSpecific: { zoomMeetingId: 'zoom-123' }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      const result = await exportService.exportTranscript('zoom-transcript', 'vtt');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('mimeType', 'text/vtt');
      expect(result.data).toContain('WEBVTT');
      expect(result.data).toContain('00:00:00.000 --> 00:00:02.000');
    });

    it('should throw error for unsupported platform', async () => {
      const mockExportData = {
        transcript: {
          id: 'unknown-transcript',
          platform: 'unknown-platform',
          title: 'Unknown Meeting'
        }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);

      await expect(
        exportService.exportTranscript('unknown-transcript', 'json')
      ).rejects.toThrow('No exporter available for platform: unknown-platform');
    });

    it('should handle security permission denial', async () => {
      const mockExportData = {
        transcript: { id: 'test-transcript', platform: 'teams' }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);
      mockSecurityManager.checkExportPermissions.mockRejectedValue(new Error('Permission denied'));

      await expect(
        exportService.exportTranscript('test-transcript', 'json')
      ).rejects.toThrow('Export failed: Permission denied');
    });
  });

  describe('getAvailableFormats', () => {
    it('should return platform-specific formats for Teams', async () => {
      mockTranscriptStorage.getTranscript.mockResolvedValue({
        id: 'teams-transcript',
        platform: 'teams'
      });

      const formats = await exportService.getAvailableFormats('teams-transcript');

      expect(formats).toContain('json');
      expect(formats).toContain('txt');
      expect(formats).toContain('pdf');
      expect(formats).toContain('docx');
      expect(formats).toContain('teams-chat');
      expect(formats).toContain('onenote');
    });

    it('should return platform-specific formats for Zoom', async () => {
      mockTranscriptStorage.getTranscript.mockResolvedValue({
        id: 'zoom-transcript',
        platform: 'zoom'
      });

      const formats = await exportService.getAvailableFormats('zoom-transcript');

      expect(formats).toContain('json');
      expect(formats).toContain('vtt');
      expect(formats).toContain('zoom-chat');
    });

    it('should return basic formats for unknown platform', async () => {
      mockTranscriptStorage.getTranscript.mockResolvedValue({
        id: 'unknown-transcript',
        platform: 'unknown'
      });

      const formats = await exportService.getAvailableFormats('unknown-transcript');

      expect(formats).toEqual(['json', 'txt']);
    });
  });

  describe('deliverExport', () => {
    it('should deliver export using platform-specific method', async () => {
      const mockExportData = {
        transcript: {
          id: 'test-transcript',
          platform: 'teams',
          title: 'Test Meeting',
          content: { segments: [] }
        }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);
      mockTranscriptStorage.getTranscript.mockResolvedValue(mockExportData.transcript);
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      const result = await exportService.deliverExport('test-transcript', 'json', 'download');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('deliveryId');
      expect(result).toHaveProperty('method', 'download');
    });

    it('should handle Teams chat delivery', async () => {
      const mockExportData = {
        transcript: {
          id: 'teams-transcript',
          platform: 'teams',
          title: 'Teams Meeting',
          content: { segments: [] },
          platformMetadata: { chatThreadId: 'thread-123' }
        }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);
      mockTranscriptStorage.getTranscript.mockResolvedValue(mockExportData.transcript);
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      const result = await exportService.deliverExport('teams-transcript', 'teams-chat', 'teams-chat');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('method', 'teams-chat');
      expect(result).toHaveProperty('chatThreadId', 'thread-123');
    });
  });

  describe('batchExport', () => {
    it('should export multiple transcripts', async () => {
      const transcriptIds = ['transcript1', 'transcript2', 'transcript3'];
      
      mockTranscriptStorage.getPlatformExportData.mockImplementation((id) => 
        Promise.resolve({
          transcript: {
            id,
            platform: 'teams',
            title: `Meeting ${id}`,
            content: { segments: [] }
          }
        })
      );
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      const result = await exportService.batchExport(transcriptIds, 'json');

      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial failures in batch export', async () => {
      const transcriptIds = ['transcript1', 'transcript2', 'transcript3'];
      
      mockTranscriptStorage.getPlatformExportData.mockImplementation((id) => {
        if (id === 'transcript2') {
          return Promise.reject(new Error('Export failed'));
        }
        return Promise.resolve({
          transcript: {
            id,
            platform: 'teams',
            title: `Meeting ${id}`,
            content: { segments: [] }
          }
        });
      });
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      const result = await exportService.batchExport(transcriptIds, 'json');

      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].transcriptId).toBe('transcript2');
    });
  });

  describe('createCrossPlatformArchive', () => {
    it('should create archive with multiple platform transcripts', async () => {
      const transcriptIds = ['teams-1', 'zoom-1', 'meet-1'];
      
      mockTranscriptStorage.getTranscript.mockImplementation((id) => {
        const platform = id.split('-')[0];
        return Promise.resolve({
          id,
          platform,
          title: `${platform} Meeting`,
          content: { segments: [] },
          createdAt: new Date(),
          platformMetadata: { duration: 3600 }
        });
      });

      const result = await exportService.createCrossPlatformArchive(transcriptIds, {
        includeAnalytics: true
      });

      expect(result).toHaveProperty('metadata');
      expect(result.metadata.totalTranscripts).toBe(3);
      expect(result.metadata.platforms).toEqual(['teams', 'zoom', 'meet']);
      expect(result).toHaveProperty('transcripts');
      expect(result.transcripts).toHaveLength(3);
      expect(result).toHaveProperty('analytics');
      expect(result.analytics.platformDistribution).toEqual({
        teams: 1,
        zoom: 1,
        meet: 1
      });
    });

    it('should handle compression options', async () => {
      const transcriptIds = ['test-1'];
      
      mockTranscriptStorage.getTranscript.mockResolvedValue({
        id: 'test-1',
        platform: 'teams',
        title: 'Test Meeting',
        content: { segments: [] },
        createdAt: new Date()
      });

      const result = await exportService.createCrossPlatformArchive(transcriptIds, {
        compression: 'gzip'
      });

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('Platform-specific exporters', () => {
    describe('TeamsExporter', () => {
      it('should format content for Teams chat with proper markdown', () => {
        const transcript = {
          id: 'teams-test',
          title: 'Teams Meeting',
          content: {
            segments: [
              { speakerId: 'John', text: 'Hello everyone' },
              { speakerId: 'Jane', text: 'Good morning' }
            ]
          }
        };

        const exporter = exportService.exporters.get('teams');
        const result = exporter._formatForTeamsChat(transcript, {});

        expect(result.data).toContain('📝 **Meeting Transcript: Teams Meeting**');
        expect(result.data).toContain('**John:** Hello everyone');
        expect(result.data).toContain('**Jane:** Good morning');
      });

      it('should truncate long messages for Teams chat', () => {
        const longSegments = Array.from({ length: 100 }, (_, i) => ({
          speakerId: `User${i}`,
          text: 'This is a very long message that will contribute to exceeding the chat length limit'
        }));

        const transcript = {
          id: 'teams-long',
          title: 'Long Meeting',
          content: { segments: longSegments }
        };

        const exporter = exportService.exporters.get('teams');
        const result = exporter._formatForTeamsChat(transcript, { maxChatLength: 500 });

        expect(result.data.length).toBeLessThanOrEqual(600); // Some buffer for truncation message
        expect(result.data).toContain('[Transcript truncated');
      });
    });

    describe('ZoomExporter', () => {
      it('should format VTT with proper timestamps', () => {
        const transcript = {
          id: 'zoom-test',
          content: {
            segments: [
              { speakerId: 'User1', text: 'First message', startTime: 0, endTime: 5 },
              { speakerId: 'User2', text: 'Second message', startTime: 10, endTime: 15 }
            ]
          }
        };

        const exporter = exportService.exporters.get('zoom');
        const result = exporter._formatAsVTT(transcript, {});

        expect(result.data).toContain('WEBVTT');
        expect(result.data).toContain('00:00:00.000 --> 00:00:05.000');
        expect(result.data).toContain('00:00:10.000 --> 00:00:15.000');
        expect(result.data).toContain('User1: First message');
        expect(result.data).toContain('User2: Second message');
      });

      it('should handle missing timestamps in VTT format', () => {
        const transcript = {
          id: 'zoom-no-timestamps',
          content: {
            segments: [
              { speakerId: 'User1', text: 'Message without timestamps' },
              { speakerId: 'User2', text: 'Another message' }
            ]
          }
        };

        const exporter = exportService.exporters.get('zoom');
        const result = exporter._formatAsVTT(transcript, {});

        expect(result.data).toContain('WEBVTT');
        expect(result.data).toContain('00:00:00.000 --> 00:00:05.000');
        expect(result.data).toContain('00:00:05.000 --> 00:00:10.000');
      });
    });

    describe('MeetExporter', () => {
      it('should format content for Google Docs HTML', () => {
        const transcript = {
          id: 'meet-test',
          title: 'Google Meet Session',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          content: {
            segments: [
              { speakerId: 'Alice', text: 'Welcome to the meeting' },
              { speakerId: 'Bob', text: 'Thank you for joining' }
            ]
          }
        };

        const exporter = exportService.exporters.get('meet');
        const result = exporter._convertToGoogleDocsHTML(transcript);

        expect(result).toContain('<!DOCTYPE html>');
        expect(result).toContain('<h1>Google Meet Session</h1>');
        expect(result).toContain('<b>Alice:</b> Welcome to the meeting');
        expect(result).toContain('<b>Bob:</b> Thank you for joining');
        expect(result).toContain('<b>Platform:</b> Google Meet');
      });
    });

    describe('GenericExporter', () => {
      it('should export CSV format with proper escaping', () => {
        const transcript = {
          id: 'generic-test',
          content: {
            segments: [
              { 
                speakerId: 'User "Quote" Test', 
                text: 'Message with "quotes" and, commas',
                startTime: 1640995200000 // 2022-01-01T00:00:00Z
              }
            ]
          }
        };

        const exporter = exportService.exporters.get('generic');
        const result = exporter._exportCSV({ transcript }, {});

        expect(result.data).toContain('Timestamp,Speaker,Text');
        expect(result.data).toContain('"User ""Quote"" Test"');
        expect(result.data).toContain('"Message with ""quotes"" and, commas"');
        expect(result.mimeType).toBe('text/csv');
      });
    });
  });

  describe('Error handling', () => {
    it('should handle transcript not found', async () => {
      mockTranscriptStorage.getPlatformExportData.mockRejectedValue(new Error('Transcript not found'));

      await expect(
        exportService.exportTranscript('nonexistent', 'json')
      ).rejects.toThrow('Export failed: Transcript not found');
    });

    it('should handle unsupported export format', async () => {
      const mockExportData = {
        transcript: { id: 'test', platform: 'teams' }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      await expect(
        exportService.exportTranscript('test', 'unsupported-format')
      ).rejects.toThrow('Unsupported format: unsupported-format');
    });

    it('should handle delivery method not supported by platform', async () => {
      const mockExportData = {
        transcript: { id: 'test', platform: 'meet' }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);
      mockTranscriptStorage.getTranscript.mockResolvedValue(mockExportData.transcript);
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      await expect(
        exportService.deliverExport('test', 'json', 'teams-chat')
      ).rejects.toThrow('Unsupported delivery method: teams-chat');
    });
  });

  describe('Logging and audit', () => {
    it('should log export activities', async () => {
      const mockExportData = {
        transcript: {
          id: 'test-transcript',
          platform: 'teams',
          content: { segments: [] }
        }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      await exportService.exportTranscript('test-transcript', 'json', { userId: 'user123' });

      expect(mockSecurityManager.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'export',
          transcriptId: 'test-transcript',
          format: 'json',
          userId: 'user123'
        })
      );
    });

    it('should log delivery activities', async () => {
      const mockExportData = {
        transcript: {
          id: 'test-transcript',
          platform: 'teams',
          content: { segments: [] }
        }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);
      mockTranscriptStorage.getTranscript.mockResolvedValue(mockExportData.transcript);
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      await exportService.deliverExport('test-transcript', 'json', 'download');

      expect(mockSecurityManager.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'delivery',
          transcriptId: 'test-transcript',
          format: 'json',
          deliveryMethod: 'download'
        })
      );
    });

    it('should sanitize sensitive options in logs', async () => {
      const mockExportData = {
        transcript: {
          id: 'test-transcript',
          platform: 'teams',
          content: { segments: [] }
        }
      };

      mockTranscriptStorage.getPlatformExportData.mockResolvedValue(mockExportData);
      mockSecurityManager.checkExportPermissions.mockResolvedValue(true);

      await exportService.exportTranscript('test-transcript', 'json', {
        userId: 'user123',
        apiKey: 'secret-key',
        accessToken: 'secret-token'
      });

      const logCall = mockSecurityManager.logActivity.mock.calls[0][0];
      expect(logCall.options).not.toHaveProperty('apiKey');
      expect(logCall.options).not.toHaveProperty('accessToken');
      expect(logCall.options).toHaveProperty('userId', 'user123');
    });
  });
});
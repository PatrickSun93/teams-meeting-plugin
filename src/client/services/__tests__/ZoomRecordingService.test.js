/**
 * Tests for ZoomRecordingService
 */

import ZoomRecordingService from '../ZoomRecordingService';

// Mock ZoomOAuthService
const mockOAuthService = {
  makeAuthenticatedRequest: jest.fn(),
  getValidAccessToken: jest.fn()
};

// Mock fetch
global.fetch = jest.fn();

// Mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  decodeAudioData: jest.fn()
}));

describe('ZoomRecordingService', () => {
  let service;
  
  beforeEach(() => {
    jest.clearAllMocks();
    service = new ZoomRecordingService(mockOAuthService);
  });

  describe('constructor', () => {
    it('should initialize with OAuth service', () => {
      expect(service.oauthService).toBe(mockOAuthService);
      expect(service.processingQueue).toBeInstanceOf(Map);
      expect(service.downloadCache).toBeInstanceOf(Map);
    });
  });

  describe('getMeetingRecordings', () => {
    it('should fetch and process meeting recordings', async () => {
      const mockResponse = {
        id: '123456789',
        recording_files: [
          {
            id: 'file1',
            file_name: 'audio_only.m4a',
            file_type: 'M4A',
            file_size: 1024000,
            download_url: 'https://zoom.us/rec/download/file1',
            play_url: 'https://zoom.us/rec/play/file1',
            recording_type: 'audio_only',
            recording_start: '2023-01-01T10:00:00Z',
            recording_end: '2023-01-01T11:00:00Z',
            play_time: '3600',
            status: 'completed'
          }
        ]
      };

      mockOAuthService.makeAuthenticatedRequest.mockResolvedValue(mockResponse);

      const result = await service.getMeetingRecordings('123456789');

      expect(mockOAuthService.makeAuthenticatedRequest).toHaveBeenCalledWith(
        '/meetings/123456789/recordings'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'file1',
        meetingId: '123456789',
        fileName: 'audio_only.m4a',
        fileType: 'M4A',
        recordingType: 'audio_only'
      });
    });

    it('should handle empty recordings response', async () => {
      mockOAuthService.makeAuthenticatedRequest.mockResolvedValue({
        id: '123456789'
      });

      const result = await service.getMeetingRecordings('123456789');

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockOAuthService.makeAuthenticatedRequest.mockRejectedValue(error);

      await expect(service.getMeetingRecordings('123456789'))
        .rejects.toThrow('API Error');
    });
  });

  describe('getUserRecordings', () => {
    it('should fetch user recordings with date range', async () => {
      const mockResponse = {
        meetings: [
          {
            id: '123456789',
            uuid: 'uuid123',
            topic: 'Test Meeting',
            start_time: '2023-01-01T10:00:00Z',
            recording_files: [
              {
                id: 'file1',
                file_name: 'recording.mp4',
                file_type: 'MP4',
                file_size: 2048000,
                download_url: 'https://zoom.us/rec/download/file1',
                recording_type: 'shared_screen_with_speaker_view',
                recording_start: '2023-01-01T10:00:00Z',
                recording_end: '2023-01-01T11:00:00Z',
                play_time: '3600',
                status: 'completed'
              }
            ]
          }
        ]
      };

      mockOAuthService.makeAuthenticatedRequest.mockResolvedValue(mockResponse);

      const from = new Date('2023-01-01');
      const to = new Date('2023-01-31');
      const result = await service.getUserRecordings('me', from, to);

      expect(mockOAuthService.makeAuthenticatedRequest).toHaveBeenCalledWith(
        expect.stringContaining('/users/me/recordings?from=2023-01-01&to=2023-01-31')
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        meetingId: '123456789',
        meetingTopic: 'Test Meeting',
        fileName: 'recording.mp4'
      });
    });

    it('should use default user ID if not provided', async () => {
      mockOAuthService.makeAuthenticatedRequest.mockResolvedValue({ meetings: [] });

      const from = new Date('2023-01-01');
      const to = new Date('2023-01-31');
      await service.getUserRecordings(undefined, from, to);

      expect(mockOAuthService.makeAuthenticatedRequest).toHaveBeenCalledWith(
        expect.stringContaining('/users/me/recordings')
      );
    });
  });

  describe('downloadRecordingFile', () => {
    it('should download and cache recording file', async () => {
      const recordingFile = {
        id: 'file1',
        file_size: 1024000,
        download_url: 'https://zoom.us/rec/download/file1'
      };

      const mockArrayBuffer = new ArrayBuffer(1024);
      mockOAuthService.getValidAccessToken.mockResolvedValue('test_token');
      fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const result = await service.downloadRecordingFile(recordingFile);

      expect(fetch).toHaveBeenCalledWith(
        recordingFile.download_url,
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test_token'
          }
        })
      );

      expect(result).toBe(mockArrayBuffer);
      
      // Should be cached
      const cacheKey = `${recordingFile.id}_${recordingFile.file_size}`;
      expect(service.downloadCache.has(cacheKey)).toBe(true);
    });

    it('should return cached file if available', async () => {
      const recordingFile = {
        id: 'file1',
        file_size: 1024000,
        download_url: 'https://zoom.us/rec/download/file1'
      };

      const cachedData = new ArrayBuffer(1024);
      const cacheKey = `${recordingFile.id}_${recordingFile.file_size}`;
      service.downloadCache.set(cacheKey, cachedData);

      const result = await service.downloadRecordingFile(recordingFile);

      expect(fetch).not.toHaveBeenCalled();
      expect(result).toBe(cachedData);
    });

    it('should handle download failures', async () => {
      const recordingFile = {
        id: 'file1',
        file_size: 1024000,
        download_url: 'https://zoom.us/rec/download/file1'
      };

      mockOAuthService.getValidAccessToken.mockResolvedValue('test_token');
      fetch.mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(service.downloadRecordingFile(recordingFile))
        .rejects.toThrow('Download failed: 404');
    });

    it('should not cache large files', async () => {
      const recordingFile = {
        id: 'file1',
        file_size: 200 * 1024 * 1024, // 200MB
        download_url: 'https://zoom.us/rec/download/file1'
      };

      const mockArrayBuffer = new ArrayBuffer(200 * 1024 * 1024);
      mockOAuthService.getValidAccessToken.mockResolvedValue('test_token');
      fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      await service.downloadRecordingFile(recordingFile);

      const cacheKey = `${recordingFile.id}_${recordingFile.file_size}`;
      expect(service.downloadCache.has(cacheKey)).toBe(false);
    });
  });

  describe('processRecordingForTranscription', () => {
    let mockTranscriptionEngine;

    beforeEach(() => {
      mockTranscriptionEngine = {
        transcribeAudioBuffer: jest.fn()
      };
    });

    it('should process recording and generate enhanced transcript', async () => {
      const meetingId = '123456789';
      
      // Mock recording files
      const mockRecordings = [
        {
          id: 'file1',
          fileType: 'M4A',
          recordingType: 'audio_only',
          fileSize: 1024000
        }
      ];

      // Mock enhanced transcript
      const mockTranscript = {
        segments: [
          { speaker: 'Speaker 1', text: 'Hello everyone', confidence: 0.95 }
        ]
      };

      jest.spyOn(service, 'getMeetingRecordings').mockResolvedValue(mockRecordings);
      jest.spyOn(service, 'downloadRecordingFile').mockResolvedValue(new ArrayBuffer(1024));
      jest.spyOn(service, '_convertToAudioBuffer').mockResolvedValue({});
      mockTranscriptionEngine.transcribeAudioBuffer.mockResolvedValue(mockTranscript);

      const result = await service.processRecordingForTranscription(meetingId, mockTranscriptionEngine);

      expect(service.getMeetingRecordings).toHaveBeenCalledWith(meetingId);
      expect(mockTranscriptionEngine.transcribeAudioBuffer).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          enableSpeakerDiarization: true,
          enablePunctuation: true,
          model: 'whisper-large-v2'
        })
      );

      expect(result.metadata).toMatchObject({
        source: 'zoom_recording',
        meetingId: meetingId,
        recordingId: 'file1'
      });
    });

    it('should prevent duplicate processing', async () => {
      const meetingId = '123456789';
      
      // Start first processing
      const promise1 = service.processRecordingForTranscription(meetingId, mockTranscriptionEngine);
      
      // Start second processing (should return same promise)
      const promise2 = service.processRecordingForTranscription(meetingId, mockTranscriptionEngine);
      
      expect(promise1).toBe(promise2);
    });

    it('should handle no recordings found', async () => {
      const meetingId = '123456789';
      
      jest.spyOn(service, 'getMeetingRecordings').mockResolvedValue([]);

      await expect(service.processRecordingForTranscription(meetingId, mockTranscriptionEngine))
        .rejects.toThrow('No recordings found for meeting');
    });

    it('should handle no audio files found', async () => {
      const meetingId = '123456789';
      
      const mockRecordings = [
        {
          id: 'file1',
          fileType: 'TXT', // Not an audio file
          recordingType: 'chat_file'
        }
      ];

      jest.spyOn(service, 'getMeetingRecordings').mockResolvedValue(mockRecordings);

      await expect(service.processRecordingForTranscription(meetingId, mockTranscriptionEngine))
        .rejects.toThrow('No audio files found in recording');
    });
  });

  describe('_selectBestAudioFile', () => {
    it('should prioritize audio_only recordings', () => {
      const audioFiles = [
        { recording_type: 'shared_screen_with_speaker_view', file_size: 2000000 },
        { recording_type: 'audio_only', file_size: 1000000 },
        { recording_type: 'active_speaker', file_size: 1500000 }
      ];

      const result = service._selectBestAudioFile(audioFiles);

      expect(result.recording_type).toBe('audio_only');
    });

    it('should prefer larger files when same recording type', () => {
      const audioFiles = [
        { recording_type: 'audio_only', file_size: 1000000 },
        { recording_type: 'audio_only', file_size: 2000000 }
      ];

      const result = service._selectBestAudioFile(audioFiles);

      expect(result.file_size).toBe(2000000);
    });
  });

  describe('isRecordingAvailable', () => {
    it('should return true when recordings exist', async () => {
      jest.spyOn(service, 'getMeetingRecordings').mockResolvedValue([{ id: 'file1' }]);

      const result = await service.isRecordingAvailable('123456789');

      expect(result).toBe(true);
    });

    it('should return false when no recordings exist', async () => {
      jest.spyOn(service, 'getMeetingRecordings').mockResolvedValue([]);

      const result = await service.isRecordingAvailable('123456789');

      expect(result).toBe(false);
    });

    it('should return false on 404 error', async () => {
      const error = new Error('404');
      jest.spyOn(service, 'getMeetingRecordings').mockRejectedValue(error);

      const result = await service.isRecordingAvailable('123456789');

      expect(result).toBe(false);
    });

    it('should throw on other errors', async () => {
      const error = new Error('500 Server Error');
      jest.spyOn(service, 'getMeetingRecordings').mockRejectedValue(error);

      await expect(service.isRecordingAvailable('123456789'))
        .rejects.toThrow('500 Server Error');
    });
  });

  describe('getProcessingStatus', () => {
    it('should return processing when meeting is in queue', () => {
      service.processingQueue.set('123456789', Promise.resolve());

      const status = service.getProcessingStatus('123456789');

      expect(status).toBe('processing');
    });

    it('should return idle when meeting is not in queue', () => {
      const status = service.getProcessingStatus('123456789');

      expect(status).toBe('idle');
    });
  });

  describe('deleteRecording', () => {
    it('should delete specific recording file', async () => {
      mockOAuthService.makeAuthenticatedRequest.mockResolvedValue({});

      await service.deleteRecording('123456789', 'file1');

      expect(mockOAuthService.makeAuthenticatedRequest).toHaveBeenCalledWith(
        '/meetings/123456789/recordings/file1',
        { method: 'DELETE' }
      );
    });

    it('should delete all recordings if no file ID specified', async () => {
      mockOAuthService.makeAuthenticatedRequest.mockResolvedValue({});

      await service.deleteRecording('123456789');

      expect(mockOAuthService.makeAuthenticatedRequest).toHaveBeenCalledWith(
        '/meetings/123456789/recordings',
        { method: 'DELETE' }
      );
    });
  });

  describe('clearCache', () => {
    it('should clear download cache', () => {
      service.downloadCache.set('test', 'data');
      
      service.clearCache();
      
      expect(service.downloadCache.size).toBe(0);
    });
  });
});
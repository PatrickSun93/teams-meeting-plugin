/**
 * Zoom Recording Service
 * Handles integration with Zoom cloud recordings for enhanced transcription
 */

class ZoomRecordingService {
  constructor(zoomOAuthService) {
    this.oauthService = zoomOAuthService;
    this.processingQueue = new Map();
    this.downloadCache = new Map();
  }

  /**
   * Get recordings for a specific meeting
   * @param {string} meetingId - Zoom meeting ID
   * @returns {Promise<Array>} List of recording files
   */
  async getMeetingRecordings(meetingId) {
    try {
      const response = await this.oauthService.makeAuthenticatedRequest(
        `/meetings/${meetingId}/recordings`
      );

      return this._processRecordingResponse(response);
    } catch (error) {
      console.error('Failed to get meeting recordings:', error);
      throw error;
    }
  }

  /**
   * Get recordings for a user within date range
   * @param {string} userId - Zoom user ID (default: 'me')
   * @param {Date} from - Start date
   * @param {Date} to - End date
   * @returns {Promise<Array>} List of recordings
   */
  async getUserRecordings(userId = 'me', from, to) {
    try {
      const params = new URLSearchParams({
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
        page_size: 300
      });

      const response = await this.oauthService.makeAuthenticatedRequest(
        `/users/${userId}/recordings?${params.toString()}`
      );

      return this._processRecordingsListResponse(response);
    } catch (error) {
      console.error('Failed to get user recordings:', error);
      throw error;
    }
  }

  /**
   * Download recording file
   * @param {Object} recordingFile - Recording file object
   * @returns {Promise<ArrayBuffer>} Downloaded file data
   */
  async downloadRecordingFile(recordingFile) {
    const cacheKey = `${recordingFile.id}_${recordingFile.file_size}`;
    
    // Check cache first
    if (this.downloadCache.has(cacheKey)) {
      return this.downloadCache.get(cacheKey);
    }

    try {
      const token = await this.oauthService.getValidAccessToken();
      
      const response = await fetch(recordingFile.download_url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Cache the downloaded file (with size limit)
      if (arrayBuffer.byteLength < 100 * 1024 * 1024) { // 100MB limit
        this.downloadCache.set(cacheKey, arrayBuffer);
        
        // Clean cache if it gets too large
        if (this.downloadCache.size > 10) {
          const firstKey = this.downloadCache.keys().next().value;
          this.downloadCache.delete(firstKey);
        }
      }

      return arrayBuffer;
    } catch (error) {
      console.error('Failed to download recording file:', error);
      throw error;
    }
  }

  /**
   * Process recording for enhanced transcription
   * @param {string} meetingId - Meeting ID
   * @param {Object} transcriptionEngine - Transcription engine instance
   * @returns {Promise<Object>} Enhanced transcript
   */
  async processRecordingForTranscription(meetingId, transcriptionEngine) {
    if (this.processingQueue.has(meetingId)) {
      return this.processingQueue.get(meetingId);
    }

    const processingPromise = this._processRecordingInternal(meetingId, transcriptionEngine);
    this.processingQueue.set(meetingId, processingPromise);

    try {
      const result = await processingPromise;
      return result;
    } finally {
      this.processingQueue.delete(meetingId);
    }
  }

  /**
   * Internal recording processing logic
   * @private
   */
  async _processRecordingInternal(meetingId, transcriptionEngine) {
    try {
      console.log(`Processing recording for meeting ${meetingId}`);

      // Get recording files
      const recordings = await this.getMeetingRecordings(meetingId);
      
      if (!recordings || recordings.length === 0) {
        throw new Error('No recordings found for meeting');
      }

      // Find audio files
      const audioFiles = recordings.filter(file => 
        file.file_type === 'M4A' || 
        file.file_type === 'MP4' ||
        file.recording_type === 'audio_only'
      );

      if (audioFiles.length === 0) {
        throw new Error('No audio files found in recording');
      }

      // Process the best quality audio file
      const bestAudioFile = this._selectBestAudioFile(audioFiles);
      console.log(`Processing audio file: ${bestAudioFile.file_name}`);

      // Download audio file
      const audioData = await this.downloadRecordingFile(bestAudioFile);

      // Convert to audio buffer for transcription
      const audioBuffer = await this._convertToAudioBuffer(audioData);

      // Generate enhanced transcript
      const enhancedTranscript = await transcriptionEngine.transcribeAudioBuffer(
        audioBuffer,
        {
          enableSpeakerDiarization: true,
          enablePunctuation: true,
          model: 'whisper-large-v2' // Use best model for recorded audio
        }
      );

      // Add metadata
      enhancedTranscript.metadata = {
        source: 'zoom_recording',
        meetingId: meetingId,
        recordingId: bestAudioFile.id,
        processedAt: new Date().toISOString(),
        fileSize: bestAudioFile.file_size,
        duration: bestAudioFile.play_time
      };

      console.log(`Enhanced transcript generated for meeting ${meetingId}`);
      return enhancedTranscript;

    } catch (error) {
      console.error(`Failed to process recording for meeting ${meetingId}:`, error);
      throw error;
    }
  }

  /**
   * Get recording download URL with authentication
   * @param {string} recordingId - Recording file ID
   * @returns {Promise<string>} Authenticated download URL
   */
  async getAuthenticatedDownloadUrl(recordingId) {
    try {
      const token = await this.oauthService.getValidAccessToken();
      
      // Zoom recordings require the token in the URL for direct access
      return `https://api.zoom.us/v2/recordings/${recordingId}?access_token=${token}`;
    } catch (error) {
      console.error('Failed to get authenticated download URL:', error);
      throw error;
    }
  }

  /**
   * Delete recording (if user has permission)
   * @param {string} meetingId - Meeting ID
   * @param {string} recordingId - Recording ID (optional, deletes all if not specified)
   * @returns {Promise<void>}
   */
  async deleteRecording(meetingId, recordingId = null) {
    try {
      let endpoint = `/meetings/${meetingId}/recordings`;
      if (recordingId) {
        endpoint += `/${recordingId}`;
      }

      await this.oauthService.makeAuthenticatedRequest(endpoint, {
        method: 'DELETE'
      });

      console.log(`Recording deleted: ${meetingId}${recordingId ? `/${recordingId}` : ''}`);
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  }

  /**
   * Get recording settings for a user
   * @param {string} userId - User ID (default: 'me')
   * @returns {Promise<Object>} Recording settings
   */
  async getRecordingSettings(userId = 'me') {
    try {
      const response = await this.oauthService.makeAuthenticatedRequest(
        `/users/${userId}/settings?option=recording`
      );

      return response.recording;
    } catch (error) {
      console.error('Failed to get recording settings:', error);
      throw error;
    }
  }

  /**
   * Process recording response from Zoom API
   * @private
   */
  _processRecordingResponse(response) {
    if (!response.recording_files) {
      return [];
    }

    return response.recording_files.map(file => ({
      id: file.id,
      meetingId: response.id,
      fileName: file.file_name,
      fileType: file.file_type,
      fileSize: file.file_size,
      downloadUrl: file.download_url,
      playUrl: file.play_url,
      recordingType: file.recording_type,
      recordingStart: new Date(file.recording_start),
      recordingEnd: new Date(file.recording_end),
      playTime: file.play_time,
      status: file.status
    }));
  }

  /**
   * Process recordings list response from Zoom API
   * @private
   */
  _processRecordingsListResponse(response) {
    if (!response.meetings) {
      return [];
    }

    const allRecordings = [];
    
    response.meetings.forEach(meeting => {
      if (meeting.recording_files) {
        const recordings = meeting.recording_files.map(file => ({
          id: file.id,
          meetingId: meeting.id,
          meetingUuid: meeting.uuid,
          meetingTopic: meeting.topic,
          meetingStartTime: new Date(meeting.start_time),
          fileName: file.file_name,
          fileType: file.file_type,
          fileSize: file.file_size,
          downloadUrl: file.download_url,
          playUrl: file.play_url,
          recordingType: file.recording_type,
          recordingStart: new Date(file.recording_start),
          recordingEnd: new Date(file.recording_end),
          playTime: file.play_time,
          status: file.status
        }));
        
        allRecordings.push(...recordings);
      }
    });

    return allRecordings;
  }

  /**
   * Select the best audio file for transcription
   * @private
   */
  _selectBestAudioFile(audioFiles) {
    // Prioritize by recording type and file size
    const priorities = {
      'audio_only': 3,
      'shared_screen_with_speaker_view': 2,
      'active_speaker': 1
    };

    return audioFiles.sort((a, b) => {
      const aPriority = priorities[a.recording_type] || 0;
      const bPriority = priorities[b.recording_type] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // If same priority, prefer larger file (better quality)
      return b.file_size - a.file_size;
    })[0];
  }

  /**
   * Convert downloaded data to AudioBuffer
   * @private
   */
  async _convertToAudioBuffer(arrayBuffer) {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      return audioBuffer;
    } catch (error) {
      console.error('Failed to convert to audio buffer:', error);
      throw new Error('Failed to process audio file: ' + error.message);
    }
  }

  /**
   * Check if recording is available for processing
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<boolean>} Recording availability
   */
  async isRecordingAvailable(meetingId) {
    try {
      const recordings = await this.getMeetingRecordings(meetingId);
      return recordings && recordings.length > 0;
    } catch (error) {
      // If we get a 404, recording doesn't exist
      if (error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get recording processing status
   * @param {string} meetingId - Meeting ID
   * @returns {string} Processing status
   */
  getProcessingStatus(meetingId) {
    if (this.processingQueue.has(meetingId)) {
      return 'processing';
    }
    return 'idle';
  }

  /**
   * Clear download cache
   */
  clearCache() {
    this.downloadCache.clear();
  }
}

export default ZoomRecordingService;
/**
 * Zoom Webhook Handler
 * Processes webhook events from Zoom for meeting lifecycle management
 */

const crypto = require('crypto');

class ZoomWebhookHandler {
  constructor() {
    this.webhookSecret = process.env.ZOOM_WEBHOOK_SECRET;
    this.eventHandlers = new Map();
    this._setupEventHandlers();
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Zoom signature header
   * @returns {boolean} Signature validity
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.webhookSecret) {
      console.warn('Zoom webhook secret not configured');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Process incoming webhook
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleWebhook(req, res) {
    try {
      const signature = req.headers['x-zm-signature'];
      const payload = JSON.stringify(req.body);

      // Verify signature
      if (!this.verifyWebhookSignature(payload, signature)) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const event = req.body;
      
      // Handle URL verification challenge
      if (event.event === 'endpoint.url_validation') {
        return res.status(200).json({
          plainToken: event.payload.plainToken,
          encryptedToken: this._encryptToken(event.payload.plainToken)
        });
      }

      // Process the event
      await this._processEvent(event);

      res.status(200).json({ status: 'success' });

    } catch (error) {
      console.error('Error processing Zoom webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Setup event handlers for different Zoom events
   * @private
   */
  _setupEventHandlers() {
    this.eventHandlers.set('meeting.started', this._handleMeetingStarted.bind(this));
    this.eventHandlers.set('meeting.ended', this._handleMeetingEnded.bind(this));
    this.eventHandlers.set('meeting.participant_joined', this._handleParticipantJoined.bind(this));
    this.eventHandlers.set('meeting.participant_left', this._handleParticipantLeft.bind(this));
    this.eventHandlers.set('meeting.sharing_started', this._handleSharingStarted.bind(this));
    this.eventHandlers.set('meeting.sharing_ended', this._handleSharingEnded.bind(this));
    this.eventHandlers.set('recording.completed', this._handleRecordingCompleted.bind(this));
  }

  /**
   * Process webhook event
   * @param {Object} event - Webhook event data
   * @private
   */
  async _processEvent(event) {
    const eventType = event.event;
    const handler = this.eventHandlers.get(eventType);

    if (handler) {
      console.log(`Processing Zoom event: ${eventType}`);
      await handler(event.payload);
    } else {
      console.log(`Unhandled Zoom event: ${eventType}`);
    }
  }

  /**
   * Handle meeting started event
   * @param {Object} payload - Event payload
   * @private
   */
  async _handleMeetingStarted(payload) {
    const meetingData = {
      meetingId: payload.object.id,
      uuid: payload.object.uuid,
      hostId: payload.object.host_id,
      topic: payload.object.topic,
      startTime: new Date(payload.object.start_time),
      timezone: payload.object.timezone,
      duration: payload.object.duration,
      type: payload.object.type
    };

    console.log('Meeting started:', meetingData);

    // Notify connected clients about meeting start
    this._notifyClients('meeting_started', meetingData);

    // Initialize transcription session if auto-start is enabled
    await this._initializeTranscriptionSession(meetingData);
  }

  /**
   * Handle meeting ended event
   * @param {Object} payload - Event payload
   * @private
   */
  async _handleMeetingEnded(payload) {
    const meetingData = {
      meetingId: payload.object.id,
      uuid: payload.object.uuid,
      hostId: payload.object.host_id,
      topic: payload.object.topic,
      startTime: new Date(payload.object.start_time),
      endTime: new Date(payload.object.end_time),
      duration: payload.object.duration
    };

    console.log('Meeting ended:', meetingData);

    // Notify connected clients about meeting end
    this._notifyClients('meeting_ended', meetingData);

    // Finalize transcription and generate summary
    await this._finalizeTranscriptionSession(meetingData);
  }

  /**
   * Handle participant joined event
   * @param {Object} payload - Event payload
   * @private
   */
  async _handleParticipantJoined(payload) {
    const participantData = {
      meetingId: payload.object.id,
      participantId: payload.object.participant.id,
      userId: payload.object.participant.user_id,
      userName: payload.object.participant.user_name,
      email: payload.object.participant.email,
      joinTime: new Date(payload.object.participant.join_time),
      role: payload.object.participant.role
    };

    console.log('Participant joined:', participantData);

    // Notify connected clients about new participant
    this._notifyClients('participant_joined', participantData);

    // Update speaker identification system
    await this._updateSpeakerProfiles(participantData);
  }

  /**
   * Handle participant left event
   * @param {Object} payload - Event payload
   * @private
   */
  async _handleParticipantLeft(payload) {
    const participantData = {
      meetingId: payload.object.id,
      participantId: payload.object.participant.id,
      userId: payload.object.participant.user_id,
      userName: payload.object.participant.user_name,
      leaveTime: new Date(payload.object.participant.leave_time),
      duration: payload.object.participant.duration
    };

    console.log('Participant left:', participantData);

    // Notify connected clients about participant leaving
    this._notifyClients('participant_left', participantData);
  }

  /**
   * Handle screen sharing started event
   * @param {Object} payload - Event payload
   * @private
   */
  async _handleSharingStarted(payload) {
    const sharingData = {
      meetingId: payload.object.id,
      participantId: payload.object.participant.id,
      userName: payload.object.participant.user_name,
      sharingDetails: payload.object.participant.sharing_details
    };

    console.log('Screen sharing started:', sharingData);

    // Notify connected clients about screen sharing
    this._notifyClients('sharing_started', sharingData);
  }

  /**
   * Handle screen sharing ended event
   * @param {Object} payload - Event payload
   * @private
   */
  async _handleSharingEnded(payload) {
    const sharingData = {
      meetingId: payload.object.id,
      participantId: payload.object.participant.id,
      userName: payload.object.participant.user_name
    };

    console.log('Screen sharing ended:', sharingData);

    // Notify connected clients about screen sharing end
    this._notifyClients('sharing_ended', sharingData);
  }

  /**
   * Handle recording completed event
   * @param {Object} payload - Event payload
   * @private
   */
  async _handleRecordingCompleted(payload) {
    const recordingData = {
      meetingId: payload.object.id,
      uuid: payload.object.uuid,
      hostId: payload.object.host_id,
      topic: payload.object.topic,
      startTime: new Date(payload.object.start_time),
      timezone: payload.object.timezone,
      duration: payload.object.duration,
      totalSize: payload.object.total_size,
      recordingCount: payload.object.recording_count,
      recordingFiles: payload.object.recording_files
    };

    console.log('Recording completed:', recordingData);

    // Notify connected clients about recording completion
    this._notifyClients('recording_completed', recordingData);

    // Process recording for enhanced transcription
    await this._processRecordingFiles(recordingData);
  }

  /**
   * Encrypt token for URL validation
   * @param {string} plainToken - Plain token from Zoom
   * @returns {string} Encrypted token
   * @private
   */
  _encryptToken(plainToken) {
    if (!this.webhookSecret) {
      return plainToken;
    }

    const cipher = crypto.createCipher('aes-256-cbc', this.webhookSecret);
    let encrypted = cipher.update(plainToken, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Notify connected clients via WebSocket or Server-Sent Events
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @private
   */
  _notifyClients(eventType, data) {
    // Implementation would depend on your WebSocket/SSE setup
    console.log(`Notifying clients: ${eventType}`, data);
    
    // Example: Broadcast to all connected WebSocket clients
    // this.websocketServer.broadcast(JSON.stringify({ type: eventType, data }));
  }

  /**
   * Initialize transcription session for meeting
   * @param {Object} meetingData - Meeting information
   * @private
   */
  async _initializeTranscriptionSession(meetingData) {
    try {
      // Check if auto-transcription is enabled for this meeting/host
      const shouldAutoStart = await this._shouldAutoStartTranscription(meetingData);
      
      if (shouldAutoStart) {
        console.log(`Auto-starting transcription for meeting ${meetingData.meetingId}`);
        // Initialize transcription session
        // This would integrate with your existing transcription engine
      }
    } catch (error) {
      console.error('Error initializing transcription session:', error);
    }
  }

  /**
   * Finalize transcription session and generate summary
   * @param {Object} meetingData - Meeting information
   * @private
   */
  async _finalizeTranscriptionSession(meetingData) {
    try {
      console.log(`Finalizing transcription for meeting ${meetingData.meetingId}`);
      
      // Generate final transcript and summary
      // Send to Zoom chat if configured
      // Store transcript for later access
      
    } catch (error) {
      console.error('Error finalizing transcription session:', error);
    }
  }

  /**
   * Update speaker identification profiles
   * @param {Object} participantData - Participant information
   * @private
   */
  async _updateSpeakerProfiles(participantData) {
    try {
      // Update speaker identification system with new participant
      console.log(`Updating speaker profile for ${participantData.userName}`);
      
    } catch (error) {
      console.error('Error updating speaker profiles:', error);
    }
  }

  /**
   * Process recording files for enhanced transcription
   * @param {Object} recordingData - Recording information
   * @private
   */
  async _processRecordingFiles(recordingData) {
    try {
      console.log(`Processing recording files for meeting ${recordingData.meetingId}`);
      
      // Download and process audio files from recording
      // Generate enhanced transcript using recorded audio
      // Update existing transcript with improved accuracy
      
    } catch (error) {
      console.error('Error processing recording files:', error);
    }
  }

  /**
   * Check if auto-transcription should start for meeting
   * @param {Object} meetingData - Meeting information
   * @returns {Promise<boolean>} Should auto-start
   * @private
   */
  async _shouldAutoStartTranscription(meetingData) {
    // Check user preferences, meeting settings, etc.
    return false; // Default to manual start
  }
}

module.exports = ZoomWebhookHandler;
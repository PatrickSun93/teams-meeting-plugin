/**
 * TranscriptStorageService - Manages local transcript storage using IndexedDB
 * Provides encryption, search, and export capabilities for meeting transcripts
 */

class TranscriptStorageService {
  constructor() {
    this.dbName = 'UniversalTranscriptionDB'; // Updated for cross-platform
    this.dbVersion = 2; // Increased for platform metadata
    this.db = null;
    this.encryptionKey = null;
  }

  /**
   * Initialize the IndexedDB database
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // Transcripts store
        if (!db.objectStoreNames.contains('transcripts')) {
          const transcriptStore = db.createObjectStore('transcripts', { keyPath: 'id' });
          transcriptStore.createIndex('meetingId', 'meetingId', { unique: false });
          transcriptStore.createIndex('date', 'createdAt', { unique: false });
          transcriptStore.createIndex('title', 'title', { unique: false });
          transcriptStore.createIndex('platform', 'platform', { unique: false });
          transcriptStore.createIndex('platformVersion', 'platformMetadata.version', { unique: false });
          transcriptStore.createIndex('meetingType', 'platformMetadata.meetingType', { unique: false });
          transcriptStore.createIndex('organizationId', 'platformMetadata.organizationId', { unique: false });
        } else if (oldVersion < 2) {
          // Upgrade existing store for platform metadata
          const transcriptStore = event.target.transaction.objectStore('transcripts');
          if (!transcriptStore.indexNames.contains('platformVersion')) {
            transcriptStore.createIndex('platformVersion', 'platformMetadata.version', { unique: false });
          }
          if (!transcriptStore.indexNames.contains('meetingType')) {
            transcriptStore.createIndex('meetingType', 'platformMetadata.meetingType', { unique: false });
          }
          if (!transcriptStore.indexNames.contains('organizationId')) {
            transcriptStore.createIndex('organizationId', 'platformMetadata.organizationId', { unique: false });
          }
        }

        // Encryption keys store
        if (!db.objectStoreNames.contains('encryption')) {
          db.createObjectStore('encryption', { keyPath: 'id' });
        }

        // Search index store
        if (!db.objectStoreNames.contains('searchIndex')) {
          const searchStore = db.createObjectStore('searchIndex', { keyPath: 'transcriptId' });
          searchStore.createIndex('keywords', 'keywords', { unique: false, multiEntry: true });
          searchStore.createIndex('platform', 'platform', { unique: false });
        } else if (oldVersion < 2) {
          // Add platform index to search store
          const searchStore = event.target.transaction.objectStore('searchIndex');
          if (!searchStore.indexNames.contains('platform')) {
            searchStore.createIndex('platform', 'platform', { unique: false });
          }
        }

        // Platform-specific metadata store
        if (!db.objectStoreNames.contains('platformMetadata')) {
          const metadataStore = db.createObjectStore('platformMetadata', { keyPath: 'transcriptId' });
          metadataStore.createIndex('platform', 'platform', { unique: false });
          metadataStore.createIndex('exportFormat', 'supportedExports', { unique: false, multiEntry: true });
        }

        // Cross-platform sharing store
        if (!db.objectStoreNames.contains('sharingLinks')) {
          const sharingStore = db.createObjectStore('sharingLinks', { keyPath: 'id' });
          sharingStore.createIndex('transcriptId', 'transcriptId', { unique: false });
          sharingStore.createIndex('platform', 'targetPlatform', { unique: false });
          sharingStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }

  /**
   * Generate or retrieve encryption key for sensitive content
   */
  async getEncryptionKey() {
    if (this.encryptionKey) return this.encryptionKey;

    const transaction = this.db.transaction(['encryption'], 'readwrite');
    const store = transaction.objectStore('encryption');
    
    try {
      const existing = await this._promisifyRequest(store.get('masterKey'));
      
      if (existing) {
        this.encryptionKey = await crypto.subtle.importKey(
          'raw',
          existing.keyData,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
      } else {
        // Generate new key
        this.encryptionKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        
        const keyData = await crypto.subtle.exportKey('raw', this.encryptionKey);
        await this._promisifyRequest(store.put({
          id: 'masterKey',
          keyData: keyData,
          createdAt: new Date()
        }));
      }
      
      return this.encryptionKey;
    } catch (error) {
      throw new Error(`Encryption key error: ${error.message}`);
    }
  }

  /**
   * Encrypt sensitive transcript content
   */
  async encryptContent(content) {
    const key = await this.getEncryptionKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(content));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    return {
      encrypted: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv)
    };
  }

  /**
   * Decrypt sensitive transcript content
   */
  async decryptContent(encryptedData) {
    const key = await this.getEncryptionKey();
    const encrypted = new Uint8Array(encryptedData.encrypted);
    const iv = new Uint8Array(encryptedData.iv);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }

  /**
   * Store a transcript with optional encryption and platform metadata
   */
  async storeTranscript(transcript, encrypt = false) {
    if (!this.db) await this.initialize();

    const platformMetadata = this._buildPlatformMetadata(transcript);
    
    const transcriptData = {
      id: transcript.id || this._generateId(),
      meetingId: transcript.meetingId,
      title: transcript.title || 'Untitled Meeting',
      platform: transcript.platform || 'teams',
      createdAt: transcript.createdAt || new Date(),
      updatedAt: new Date(),
      encrypted: encrypt,
      content: encrypt ? await this.encryptContent(transcript.content) : transcript.content,
      metadata: transcript.metadata || {},
      platformMetadata: platformMetadata,
      tags: transcript.tags || [],
      size: this._calculateSize(transcript.content),
      exportFormats: this._getSupportedExportFormats(transcript.platform),
      sharingCapabilities: this._getPlatformSharingCapabilities(transcript.platform)
    };

    const transaction = this.db.transaction(['transcripts', 'searchIndex', 'platformMetadata'], 'readwrite');
    const transcriptStore = transaction.objectStore('transcripts');
    const searchStore = transaction.objectStore('searchIndex');
    const metadataStore = transaction.objectStore('platformMetadata');

    try {
      await this._promisifyRequest(transcriptStore.put(transcriptData));
      
      // Store platform-specific metadata
      await this._promisifyRequest(metadataStore.put({
        transcriptId: transcriptData.id,
        platform: transcriptData.platform,
        supportedExports: transcriptData.exportFormats,
        sharingMethods: transcriptData.sharingCapabilities,
        platformSpecificData: platformMetadata,
        createdAt: new Date()
      }));
      
      // Build enhanced search index
      const keywords = this._extractKeywords(transcript.content);
      await this._promisifyRequest(searchStore.put({
        transcriptId: transcriptData.id,
        platform: transcriptData.platform,
        keywords: keywords,
        title: transcriptData.title.toLowerCase(),
        content: encrypt ? [] : this._extractSearchableText(transcript.content),
        platformKeywords: this._extractPlatformKeywords(platformMetadata)
      }));

      return transcriptData.id;
    } catch (error) {
      throw new Error(`Failed to store transcript: ${error.message}`);
    }
  }

  /**
   * Retrieve a transcript by ID
   */
  async getTranscript(id) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['transcripts'], 'readonly');
    const store = transaction.objectStore('transcripts');
    
    try {
      const transcript = await this._promisifyRequest(store.get(id));
      
      if (!transcript) return null;

      if (transcript.encrypted) {
        transcript.content = await this.decryptContent(transcript.content);
      }

      return transcript;
    } catch (error) {
      throw new Error(`Failed to retrieve transcript: ${error.message}`);
    }
  }

  /**
   * Get all transcripts with optional filtering
   */
  async getAllTranscripts(filters = {}) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['transcripts'], 'readonly');
    const store = transaction.objectStore('transcripts');
    
    try {
      let request;
      
      if (filters.meetingId) {
        const index = store.index('meetingId');
        request = index.getAll(filters.meetingId);
      } else if (filters.platform) {
        const index = store.index('platform');
        request = index.getAll(filters.platform);
      } else {
        request = store.getAll();
      }

      const transcripts = await this._promisifyRequest(request);
      
      // Apply additional filters
      let filtered = transcripts;
      
      if (filters.startDate || filters.endDate) {
        filtered = filtered.filter(t => {
          const date = new Date(t.createdAt);
          if (filters.startDate && date < filters.startDate) return false;
          if (filters.endDate && date > filters.endDate) return false;
          return true;
        });
      }

      if (filters.tags && filters.tags.length > 0) {
        filtered = filtered.filter(t => 
          filters.tags.some(tag => t.tags.includes(tag))
        );
      }

      // Sort by date (newest first)
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return filtered;
    } catch (error) {
      throw new Error(`Failed to retrieve transcripts: ${error.message}`);
    }
  }

  /**
   * Search transcripts by keywords
   */
  async searchTranscripts(query, options = {}) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['transcripts', 'searchIndex'], 'readonly');
    const searchStore = transaction.objectStore('searchIndex');
    const transcriptStore = transaction.objectStore('transcripts');
    
    try {
      const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
      const matchingIds = new Set();

      // Search in keywords index
      for (const keyword of keywords) {
        const index = searchStore.index('keywords');
        const matches = await this._promisifyRequest(index.getAll(keyword));
        matches.forEach(match => matchingIds.add(match.transcriptId));
      }

      // Get matching transcripts
      const results = [];
      for (const id of matchingIds) {
        const transcript = await this._promisifyRequest(transcriptStore.get(id));
        if (transcript) {
          // Calculate relevance score
          const score = this._calculateRelevanceScore(transcript, keywords);
          results.push({ ...transcript, relevanceScore: score });
        }
      }

      // Sort by relevance
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      return options.limit ? results.slice(0, options.limit) : results;
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Delete a transcript
   */
  async deleteTranscript(id) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['transcripts', 'searchIndex'], 'readwrite');
    const transcriptStore = transaction.objectStore('transcripts');
    const searchStore = transaction.objectStore('searchIndex');
    
    try {
      await this._promisifyRequest(transcriptStore.delete(id));
      await this._promisifyRequest(searchStore.delete(id));
      return true;
    } catch (error) {
      throw new Error(`Failed to delete transcript: ${error.message}`);
    }
  }

  /**
   * Delete multiple transcripts
   */
  async deleteTranscripts(ids) {
    const results = [];
    for (const id of ids) {
      try {
        await this.deleteTranscript(id);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Clean up old transcripts based on retention policy
   */
  async cleanupOldTranscripts(retentionDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const transcripts = await this.getAllTranscripts();
    const toDelete = transcripts
      .filter(t => new Date(t.createdAt) < cutoffDate)
      .map(t => t.id);

    if (toDelete.length > 0) {
      return await this.deleteTranscripts(toDelete);
    }

    return [];
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    if (!this.db) await this.initialize();

    const transcripts = await this.getAllTranscripts();
    
    const stats = {
      totalTranscripts: transcripts.length,
      totalSize: transcripts.reduce((sum, t) => sum + (t.size || 0), 0),
      encryptedCount: transcripts.filter(t => t.encrypted).length,
      oldestTranscript: transcripts.length > 0 ? 
        new Date(Math.min(...transcripts.map(t => new Date(t.createdAt)))) : null,
      newestTranscript: transcripts.length > 0 ? 
        new Date(Math.max(...transcripts.map(t => new Date(t.createdAt)))) : null,
      platformBreakdown: this._groupBy(transcripts, 'platform')
    };

    return stats;
  }

  // Helper methods
  _promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  _generateId() {
    return `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _calculateSize(content) {
    return new Blob([JSON.stringify(content)]).size;
  }

  _extractKeywords(content) {
    if (!content || !content.segments) return [];
    
    const text = content.segments.map(s => s.text).join(' ').toLowerCase();
    const words = text.match(/\b\w{3,}\b/g) || [];
    
    // Remove common stop words and get unique keywords
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
    
    return [...new Set(words.filter(word => !stopWords.has(word)))];
  }

  _extractSearchableText(content) {
    if (!content || !content.segments) return [];
    return content.segments.map(s => s.text.toLowerCase());
  }

  _calculateRelevanceScore(transcript, keywords) {
    let score = 0;
    const title = transcript.title.toLowerCase();
    
    // Title matches get higher score
    keywords.forEach(keyword => {
      if (title.includes(keyword)) score += 10;
    });

    // Tag matches
    if (transcript.tags) {
      transcript.tags.forEach(tag => {
        keywords.forEach(keyword => {
          if (tag.toLowerCase().includes(keyword)) score += 5;
        });
      });
    }

    return score;
  }

  _groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key] || 'unknown';
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }

  /**
   * Build platform-specific metadata
   */
  _buildPlatformMetadata(transcript) {
    const baseMetadata = {
      version: '1.0',
      captureMethod: 'real-time',
      audioQuality: transcript.audioQuality || 'medium',
      participantCount: transcript.participants?.length || 0,
      duration: transcript.duration || 0,
      language: transcript.language || 'en-US'
    };

    switch (transcript.platform) {
      case 'teams':
        return {
          ...baseMetadata,
          meetingType: transcript.metadata?.meetingType || 'scheduled',
          organizationId: transcript.metadata?.organizationId,
          tenantId: transcript.metadata?.tenantId,
          chatThreadId: transcript.metadata?.chatThreadId,
          recordingId: transcript.metadata?.recordingId,
          hasAgenda: !!transcript.agenda,
          participantRoles: transcript.participants?.map(p => ({ id: p.id, role: p.role })) || []
        };
      
      case 'zoom':
        return {
          ...baseMetadata,
          meetingType: transcript.metadata?.meetingType || 'instant',
          zoomMeetingId: transcript.metadata?.zoomMeetingId,
          accountId: transcript.metadata?.accountId,
          recordingId: transcript.metadata?.recordingId,
          hasWaitingRoom: transcript.metadata?.hasWaitingRoom || false,
          isBreakoutRoom: transcript.metadata?.isBreakoutRoom || false
        };
      
      case 'meet':
        return {
          ...baseMetadata,
          meetingType: 'google-meet',
          meetCode: transcript.metadata?.meetCode,
          calendarEventId: transcript.metadata?.calendarEventId,
          organizerEmail: transcript.metadata?.organizerEmail,
          hasCalendarIntegration: !!transcript.metadata?.calendarEventId
        };
      
      default:
        return {
          ...baseMetadata,
          meetingType: 'generic',
          captureMethod: 'system-audio'
        };
    }
  }

  /**
   * Get supported export formats for platform
   */
  _getSupportedExportFormats(platform) {
    const baseFormats = ['json', 'txt', 'pdf'];
    
    switch (platform) {
      case 'teams':
        return [...baseFormats, 'docx', 'teams-chat', 'onenote'];
      case 'zoom':
        return [...baseFormats, 'docx', 'zoom-chat', 'vtt'];
      case 'meet':
        return [...baseFormats, 'docx', 'google-docs', 'drive-upload'];
      default:
        return baseFormats;
    }
  }

  /**
   * Get platform sharing capabilities
   */
  _getPlatformSharingCapabilities(platform) {
    switch (platform) {
      case 'teams':
        return {
          chatIntegration: true,
          emailShare: true,
          linkShare: true,
          oneNoteIntegration: true,
          sharepointIntegration: true
        };
      case 'zoom':
        return {
          chatIntegration: true,
          emailShare: true,
          linkShare: true,
          cloudRecordingIntegration: true
        };
      case 'meet':
        return {
          chatIntegration: false,
          emailShare: true,
          linkShare: true,
          driveIntegration: true,
          calendarIntegration: true
        };
      default:
        return {
          chatIntegration: false,
          emailShare: true,
          linkShare: false,
          fileExport: true
        };
    }
  }

  /**
   * Extract platform-specific keywords for enhanced search
   */
  _extractPlatformKeywords(platformMetadata) {
    const keywords = [];
    
    if (platformMetadata.meetingType) keywords.push(platformMetadata.meetingType);
    if (platformMetadata.organizationId) keywords.push(`org:${platformMetadata.organizationId}`);
    if (platformMetadata.hasAgenda) keywords.push('agenda');
    if (platformMetadata.recordingId) keywords.push('recorded');
    if (platformMetadata.isBreakoutRoom) keywords.push('breakout');
    if (platformMetadata.hasWaitingRoom) keywords.push('waiting-room');
    
    return keywords;
  }

  /**
   * Search transcripts across all platforms with enhanced filtering
   */
  async searchTranscriptsAcrossPlatforms(query, options = {}) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['transcripts', 'searchIndex'], 'readonly');
    const searchStore = transaction.objectStore('searchIndex');
    const transcriptStore = transaction.objectStore('transcripts');
    
    try {
      const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
      const matchingIds = new Set();

      // Search across all platforms or specific platforms
      const platforms = options.platforms || ['teams', 'zoom', 'meet', 'generic'];
      
      for (const platform of platforms) {
        // Search in platform-specific index
        const platformIndex = searchStore.index('platform');
        const platformMatches = await this._promisifyRequest(platformIndex.getAll(platform));
        
        platformMatches.forEach(match => {
          const hasKeywordMatch = keywords.some(keyword => 
            match.keywords.includes(keyword) || 
            match.title.includes(keyword) ||
            match.platformKeywords?.includes(keyword)
          );
          
          if (hasKeywordMatch) {
            matchingIds.add(match.transcriptId);
          }
        });
      }

      // Get matching transcripts with platform metadata
      const results = [];
      for (const id of matchingIds) {
        const transcript = await this._promisifyRequest(transcriptStore.get(id));
        if (transcript) {
          const score = this._calculateCrossPlatformRelevanceScore(transcript, keywords, options);
          results.push({ ...transcript, relevanceScore: score });
        }
      }

      // Sort by relevance and apply filters
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      let filtered = results;
      
      // Apply platform-specific filters
      if (options.meetingType) {
        filtered = filtered.filter(t => 
          t.platformMetadata?.meetingType === options.meetingType
        );
      }
      
      if (options.hasRecording !== undefined) {
        filtered = filtered.filter(t => 
          !!t.platformMetadata?.recordingId === options.hasRecording
        );
      }
      
      if (options.organizationId) {
        filtered = filtered.filter(t => 
          t.platformMetadata?.organizationId === options.organizationId
        );
      }

      return options.limit ? filtered.slice(0, options.limit) : filtered;
    } catch (error) {
      throw new Error(`Cross-platform search failed: ${error.message}`);
    }
  }

  /**
   * Calculate relevance score for cross-platform search
   */
  _calculateCrossPlatformRelevanceScore(transcript, keywords, options) {
    let score = 0;
    const title = transcript.title.toLowerCase();
    const platform = transcript.platform;
    
    // Base keyword matching
    keywords.forEach(keyword => {
      if (title.includes(keyword)) score += 10;
      if (transcript.platformMetadata?.meetingType?.includes(keyword)) score += 8;
    });

    // Platform preference boost
    if (options.preferredPlatforms?.includes(platform)) {
      score += 5;
    }

    // Recency boost
    const daysSinceCreation = (Date.now() - new Date(transcript.createdAt)) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 7) score += 3;
    else if (daysSinceCreation < 30) score += 1;

    // Quality indicators
    if (transcript.platformMetadata?.hasAgenda) score += 2;
    if (transcript.platformMetadata?.recordingId) score += 2;
    if (transcript.size > 10000) score += 1; // Longer meetings might be more important

    return score;
  }

  /**
   * Create cross-platform sharing link
   */
  async createSharingLink(transcriptId, targetPlatform, options = {}) {
    if (!this.db) await this.initialize();

    const transcript = await this.getTranscript(transcriptId);
    if (!transcript) {
      throw new Error('Transcript not found');
    }

    const sharingId = this._generateId();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (options.expirationDays || 7));

    const sharingLink = {
      id: sharingId,
      transcriptId: transcriptId,
      sourcePlatform: transcript.platform,
      targetPlatform: targetPlatform,
      createdAt: new Date(),
      expiresAt: expiresAt,
      accessCount: 0,
      maxAccess: options.maxAccess || 10,
      requiresAuth: options.requiresAuth || false,
      allowedUsers: options.allowedUsers || [],
      metadata: {
        title: transcript.title,
        createdBy: options.createdBy,
        permissions: options.permissions || ['read']
      }
    };

    const transaction = this.db.transaction(['sharingLinks'], 'readwrite');
    const sharingStore = transaction.objectStore('sharingLinks');

    try {
      await this._promisifyRequest(sharingStore.put(sharingLink));
      return {
        linkId: sharingId,
        url: this._generateSharingUrl(sharingId, targetPlatform),
        expiresAt: expiresAt
      };
    } catch (error) {
      throw new Error(`Failed to create sharing link: ${error.message}`);
    }
  }

  /**
   * Get transcript by sharing link
   */
  async getTranscriptByShareLink(linkId) {
    if (!this.db) await this.initialize();

    const transaction = this.db.transaction(['sharingLinks', 'transcripts'], 'readwrite');
    const sharingStore = transaction.objectStore('sharingLinks');
    const transcriptStore = transaction.objectStore('transcripts');

    try {
      const sharingLink = await this._promisifyRequest(sharingStore.get(linkId));
      
      if (!sharingLink) {
        throw new Error('Sharing link not found');
      }

      if (new Date() > new Date(sharingLink.expiresAt)) {
        throw new Error('Sharing link has expired');
      }

      if (sharingLink.accessCount >= sharingLink.maxAccess) {
        throw new Error('Sharing link access limit exceeded');
      }

      // Update access count
      sharingLink.accessCount++;
      await this._promisifyRequest(sharingStore.put(sharingLink));

      // Get the transcript
      const transcript = await this._promisifyRequest(transcriptStore.get(sharingLink.transcriptId));
      
      if (!transcript) {
        throw new Error('Associated transcript not found');
      }

      if (transcript.encrypted) {
        transcript.content = await this.decryptContent(transcript.content);
      }

      return {
        transcript: transcript,
        sharingInfo: {
          sourcePlatform: sharingLink.sourcePlatform,
          targetPlatform: sharingLink.targetPlatform,
          accessCount: sharingLink.accessCount,
          maxAccess: sharingLink.maxAccess,
          expiresAt: sharingLink.expiresAt
        }
      };
    } catch (error) {
      throw new Error(`Failed to access shared transcript: ${error.message}`);
    }
  }

  /**
   * Get platform-specific export data
   */
  async getPlatformExportData(transcriptId, exportFormat) {
    const transcript = await this.getTranscript(transcriptId);
    if (!transcript) {
      throw new Error('Transcript not found');
    }

    const platformMetadata = transcript.platformMetadata;
    const exportData = {
      transcript: transcript,
      format: exportFormat,
      platformSpecific: {}
    };

    switch (transcript.platform) {
      case 'teams':
        exportData.platformSpecific = {
          chatThreadId: platformMetadata?.chatThreadId,
          organizationId: platformMetadata?.organizationId,
          tenantId: platformMetadata?.tenantId,
          participantRoles: platformMetadata?.participantRoles,
          canPostToChat: transcript.sharingCapabilities?.chatIntegration
        };
        break;

      case 'zoom':
        exportData.platformSpecific = {
          zoomMeetingId: platformMetadata?.zoomMeetingId,
          accountId: platformMetadata?.accountId,
          recordingId: platformMetadata?.recordingId,
          canPostToChat: transcript.sharingCapabilities?.chatIntegration
        };
        break;

      case 'meet':
        exportData.platformSpecific = {
          meetCode: platformMetadata?.meetCode,
          calendarEventId: platformMetadata?.calendarEventId,
          organizerEmail: platformMetadata?.organizerEmail,
          driveIntegration: transcript.sharingCapabilities?.driveIntegration
        };
        break;
    }

    return exportData;
  }

  /**
   * Generate sharing URL for platform
   */
  _generateSharingUrl(linkId, targetPlatform) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/${targetPlatform}/${linkId}`;
  }

  /**
   * Get enhanced storage statistics with platform breakdown
   */
  async getEnhancedStorageStats() {
    if (!this.db) await this.initialize();

    const transcripts = await this.getAllTranscripts();
    const sharingTransaction = this.db.transaction(['sharingLinks'], 'readonly');
    const sharingStore = sharingTransaction.objectStore('sharingLinks');
    const sharingLinks = await this._promisifyRequest(sharingStore.getAll());
    
    const stats = {
      totalTranscripts: transcripts.length,
      totalSize: transcripts.reduce((sum, t) => sum + (t.size || 0), 0),
      encryptedCount: transcripts.filter(t => t.encrypted).length,
      platformBreakdown: this._groupBy(transcripts, 'platform'),
      meetingTypeBreakdown: this._groupBy(transcripts, t => t.platformMetadata?.meetingType || 'unknown'),
      sharingStats: {
        totalLinks: sharingLinks.length,
        activeLinks: sharingLinks.filter(l => new Date(l.expiresAt) > new Date()).length,
        totalAccesses: sharingLinks.reduce((sum, l) => sum + l.accessCount, 0)
      },
      crossPlatformUsage: this._analyzeCrossPlatformUsage(transcripts, sharingLinks),
      oldestTranscript: transcripts.length > 0 ? 
        new Date(Math.min(...transcripts.map(t => new Date(t.createdAt)))) : null,
      newestTranscript: transcripts.length > 0 ? 
        new Date(Math.max(...transcripts.map(t => new Date(t.createdAt)))) : null
    };

    return stats;
  }

  /**
   * Analyze cross-platform usage patterns
   */
  _analyzeCrossPlatformUsage(transcripts, sharingLinks) {
    const platformPairs = {};
    
    sharingLinks.forEach(link => {
      const pair = `${link.sourcePlatform}->${link.targetPlatform}`;
      platformPairs[pair] = (platformPairs[pair] || 0) + 1;
    });

    return {
      mostSharedPlatform: this._getMostFrequent(transcripts.map(t => t.platform)),
      popularSharingPairs: Object.entries(platformPairs)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
      averageTranscriptSize: transcripts.reduce((sum, t) => sum + (t.size || 0), 0) / transcripts.length || 0
    };
  }

  /**
   * Get most frequent item in array
   */
  _getMostFrequent(arr) {
    const frequency = {};
    let maxCount = 0;
    let mostFrequent = null;

    arr.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
      if (frequency[item] > maxCount) {
        maxCount = frequency[item];
        mostFrequent = item;
      }
    });

    return mostFrequent;
  }
}

export default TranscriptStorageService;
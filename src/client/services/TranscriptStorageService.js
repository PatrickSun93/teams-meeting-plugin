/**
 * TranscriptStorageService - Manages local transcript storage using IndexedDB
 * Provides encryption, search, and export capabilities for meeting transcripts
 */

class TranscriptStorageService {
  constructor() {
    this.dbName = 'TeamsTranscriptionDB';
    this.dbVersion = 1;
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

        // Transcripts store
        if (!db.objectStoreNames.contains('transcripts')) {
          const transcriptStore = db.createObjectStore('transcripts', { keyPath: 'id' });
          transcriptStore.createIndex('meetingId', 'meetingId', { unique: false });
          transcriptStore.createIndex('date', 'createdAt', { unique: false });
          transcriptStore.createIndex('title', 'title', { unique: false });
          transcriptStore.createIndex('platform', 'platform', { unique: false });
        }

        // Encryption keys store
        if (!db.objectStoreNames.contains('encryption')) {
          db.createObjectStore('encryption', { keyPath: 'id' });
        }

        // Search index store
        if (!db.objectStoreNames.contains('searchIndex')) {
          const searchStore = db.createObjectStore('searchIndex', { keyPath: 'transcriptId' });
          searchStore.createIndex('keywords', 'keywords', { unique: false, multiEntry: true });
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
   * Store a transcript with optional encryption
   */
  async storeTranscript(transcript, encrypt = false) {
    if (!this.db) await this.initialize();

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
      tags: transcript.tags || [],
      size: this._calculateSize(transcript.content)
    };

    const transaction = this.db.transaction(['transcripts', 'searchIndex'], 'readwrite');
    const transcriptStore = transaction.objectStore('transcripts');
    const searchStore = transaction.objectStore('searchIndex');

    try {
      await this._promisifyRequest(transcriptStore.put(transcriptData));
      
      // Build search index
      const keywords = this._extractKeywords(transcript.content);
      await this._promisifyRequest(searchStore.put({
        transcriptId: transcriptData.id,
        keywords: keywords,
        title: transcriptData.title.toLowerCase(),
        content: encrypt ? [] : this._extractSearchableText(transcript.content)
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
}

export default TranscriptStorageService;
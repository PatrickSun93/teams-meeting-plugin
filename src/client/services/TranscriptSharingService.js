/**
 * TranscriptSharingService - Handles transcript sharing and collaboration
 * Provides secure sharing links, access control, and collaboration features
 */

class TranscriptSharingService {
  constructor(storageService) {
    this.storageService = storageService;
    this.shareStore = 'transcriptShares';
    this.accessStore = 'shareAccess';
  }

  /**
   * Initialize sharing database stores
   */
  async initialize() {
    if (!this.storageService.db) {
      await this.storageService.initialize();
    }

    // Check if sharing stores exist, create if needed
    const db = this.storageService.db;
    const version = db.version + 1;
    
    return new Promise((resolve, reject) => {
      db.close();
      
      const request = indexedDB.open(this.storageService.dbName, version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.storageService.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const upgradeDb = event.target.result;

        // Shares store
        if (!upgradeDb.objectStoreNames.contains(this.shareStore)) {
          const shareStore = upgradeDb.createObjectStore(this.shareStore, { keyPath: 'id' });
          shareStore.createIndex('transcriptId', 'transcriptId', { unique: false });
          shareStore.createIndex('createdBy', 'createdBy', { unique: false });
          shareStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Access log store
        if (!upgradeDb.objectStoreNames.contains(this.accessStore)) {
          const accessStore = upgradeDb.createObjectStore(this.accessStore, { keyPath: 'id' });
          accessStore.createIndex('shareId', 'shareId', { unique: false });
          accessStore.createIndex('accessedAt', 'accessedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Create a shareable link for a transcript
   */
  async createShare(transcriptId, options = {}) {
    await this.initialize();

    const transcript = await this.storageService.getTranscript(transcriptId);
    if (!transcript) {
      throw new Error('Transcript not found');
    }

    const shareId = this._generateShareId();
    const shareData = {
      id: shareId,
      transcriptId: transcriptId,
      createdBy: options.createdBy || 'anonymous',
      createdAt: new Date(),
      expiresAt: options.expiresAt || this._getDefaultExpiry(),
      permissions: {
        canView: true,
        canDownload: options.allowDownload !== false,
        canComment: options.allowComments === true,
        canEdit: options.allowEdit === true
      },
      accessControl: {
        requirePassword: !!options.password,
        password: options.password ? await this._hashPassword(options.password) : null,
        allowedEmails: options.allowedEmails || [],
        maxAccesses: options.maxAccesses || null,
        currentAccesses: 0
      },
      metadata: {
        title: transcript.title,
        description: options.description || '',
        tags: options.tags || []
      },
      isActive: true
    };

    const transaction = this.storageService.db.transaction([this.shareStore], 'readwrite');
    const store = transaction.objectStore(this.shareStore);
    
    try {
      await this._promisifyRequest(store.put(shareData));
      
      return {
        shareId: shareId,
        shareUrl: this._generateShareUrl(shareId),
        expiresAt: shareData.expiresAt,
        permissions: shareData.permissions
      };
    } catch (error) {
      throw new Error(`Failed to create share: ${error.message}`);
    }
  }

  /**
   * Access a shared transcript
   */
  async accessShare(shareId, accessOptions = {}) {
    await this.initialize();

    const transaction = this.storageService.db.transaction([this.shareStore, this.accessStore], 'readwrite');
    const shareStore = transaction.objectStore(this.shareStore);
    const accessStore = transaction.objectStore(this.accessStore);
    
    try {
      const share = await this._promisifyRequest(shareStore.get(shareId));
      
      if (!share) {
        throw new Error('Share not found');
      }

      // Validate share
      const validation = await this._validateShareAccess(share, accessOptions);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      // Log access
      const accessLog = {
        id: this._generateId(),
        shareId: shareId,
        accessedAt: new Date(),
        accessedBy: accessOptions.accessedBy || 'anonymous',
        ipAddress: accessOptions.ipAddress || 'unknown',
        userAgent: accessOptions.userAgent || 'unknown'
      };

      await this._promisifyRequest(accessStore.put(accessLog));

      // Update access count
      share.accessControl.currentAccesses += 1;
      await this._promisifyRequest(shareStore.put(share));

      // Get the transcript
      const transcript = await this.storageService.getTranscript(share.transcriptId);
      
      return {
        transcript: transcript,
        share: {
          id: share.id,
          permissions: share.permissions,
          metadata: share.metadata,
          expiresAt: share.expiresAt
        }
      };
    } catch (error) {
      throw new Error(`Access denied: ${error.message}`);
    }
  }

  /**
   * Update share settings
   */
  async updateShare(shareId, updates) {
    await this.initialize();

    const transaction = this.storageService.db.transaction([this.shareStore], 'readwrite');
    const store = transaction.objectStore(this.shareStore);
    
    try {
      const share = await this._promisifyRequest(store.get(shareId));
      
      if (!share) {
        throw new Error('Share not found');
      }

      // Update allowed fields
      if (updates.expiresAt) share.expiresAt = updates.expiresAt;
      if (updates.permissions) {
        share.permissions = { ...share.permissions, ...updates.permissions };
      }
      if (updates.accessControl) {
        share.accessControl = { ...share.accessControl, ...updates.accessControl };
      }
      if (updates.metadata) {
        share.metadata = { ...share.metadata, ...updates.metadata };
      }
      if (updates.isActive !== undefined) {
        share.isActive = updates.isActive;
      }

      share.updatedAt = new Date();

      await this._promisifyRequest(store.put(share));
      
      return share;
    } catch (error) {
      throw new Error(`Failed to update share: ${error.message}`);
    }
  }

  /**
   * Revoke a share
   */
  async revokeShare(shareId) {
    return await this.updateShare(shareId, { isActive: false });
  }

  /**
   * Get all shares for a transcript
   */
  async getTranscriptShares(transcriptId) {
    await this.initialize();

    const transaction = this.storageService.db.transaction([this.shareStore], 'readonly');
    const store = transaction.objectStore(this.shareStore);
    const index = store.index('transcriptId');
    
    try {
      const shares = await this._promisifyRequest(index.getAll(transcriptId));
      
      return shares.map(share => ({
        id: share.id,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        permissions: share.permissions,
        accessControl: {
          ...share.accessControl,
          password: undefined // Don't expose password hash
        },
        metadata: share.metadata,
        isActive: share.isActive,
        shareUrl: this._generateShareUrl(share.id)
      }));
    } catch (error) {
      throw new Error(`Failed to get shares: ${error.message}`);
    }
  }

  /**
   * Get share analytics
   */
  async getShareAnalytics(shareId) {
    await this.initialize();

    const transaction = this.storageService.db.transaction([this.shareStore, this.accessStore], 'readonly');
    const shareStore = transaction.objectStore(this.shareStore);
    const accessStore = transaction.objectStore(this.accessStore);
    
    try {
      const share = await this._promisifyRequest(shareStore.get(shareId));
      if (!share) {
        throw new Error('Share not found');
      }

      const accessIndex = accessStore.index('shareId');
      const accesses = await this._promisifyRequest(accessIndex.getAll(shareId));

      const analytics = {
        shareId: shareId,
        totalAccesses: accesses.length,
        uniqueAccessors: new Set(accesses.map(a => a.accessedBy)).size,
        firstAccess: accesses.length > 0 ? new Date(Math.min(...accesses.map(a => new Date(a.accessedAt)))) : null,
        lastAccess: accesses.length > 0 ? new Date(Math.max(...accesses.map(a => new Date(a.accessedAt)))) : null,
        accessesByDay: this._groupAccessesByDay(accesses),
        topAccessors: this._getTopAccessors(accesses),
        isExpired: new Date() > new Date(share.expiresAt),
        isActive: share.isActive
      };

      return analytics;
    } catch (error) {
      throw new Error(`Failed to get analytics: ${error.message}`);
    }
  }

  /**
   * Clean up expired shares
   */
  async cleanupExpiredShares() {
    await this.initialize();

    const transaction = this.storageService.db.transaction([this.shareStore], 'readwrite');
    const store = transaction.objectStore(this.shareStore);
    const index = store.index('expiresAt');
    
    try {
      const now = new Date();
      const cursor = await this._promisifyRequest(
        index.openCursor(IDBKeyRange.upperBound(now))
      );
      
      const deletedShares = [];
      
      if (cursor) {
        do {
          const share = cursor.value;
          deletedShares.push(share.id);
          await this._promisifyRequest(cursor.delete());
        } while (cursor.continue());
      }

      return deletedShares;
    } catch (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Export sharing data
   */
  async exportSharingData(transcriptId) {
    const shares = await this.getTranscriptShares(transcriptId);
    const analytics = [];

    for (const share of shares) {
      try {
        const shareAnalytics = await this.getShareAnalytics(share.id);
        analytics.push(shareAnalytics);
      } catch (error) {
        analytics.push({ shareId: share.id, error: error.message });
      }
    }

    return {
      transcriptId: transcriptId,
      shares: shares,
      analytics: analytics,
      exportedAt: new Date()
    };
  }

  // Private helper methods
  async _validateShareAccess(share, accessOptions) {
    // Check if share is active
    if (!share.isActive) {
      return { valid: false, reason: 'Share has been revoked' };
    }

    // Check expiration
    if (new Date() > new Date(share.expiresAt)) {
      return { valid: false, reason: 'Share has expired' };
    }

    // Check access limit
    if (share.accessControl.maxAccesses && 
        share.accessControl.currentAccesses >= share.accessControl.maxAccesses) {
      return { valid: false, reason: 'Maximum access limit reached' };
    }

    // Check password
    if (share.accessControl.requirePassword) {
      if (!accessOptions.password) {
        return { valid: false, reason: 'Password required' };
      }
      
      const isValidPassword = await this._verifyPassword(
        accessOptions.password, 
        share.accessControl.password
      );
      
      if (!isValidPassword) {
        return { valid: false, reason: 'Invalid password' };
      }
    }

    // Check email restrictions
    if (share.accessControl.allowedEmails.length > 0) {
      if (!accessOptions.email || 
          !share.accessControl.allowedEmails.includes(accessOptions.email)) {
        return { valid: false, reason: 'Email not authorized' };
      }
    }

    return { valid: true };
  }

  async _hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash));
  }

  async _verifyPassword(password, hash) {
    const hashedInput = await this._hashPassword(password);
    return JSON.stringify(hashedInput) === JSON.stringify(hash);
  }

  _generateShareId() {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  _generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateShareUrl(shareId) {
    // In a real implementation, this would be your app's domain
    return `${window.location.origin}/share/${shareId}`;
  }

  _getDefaultExpiry() {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30); // 30 days default
    return expiry;
  }

  _groupAccessesByDay(accesses) {
    const groups = {};
    accesses.forEach(access => {
      const day = new Date(access.accessedAt).toDateString();
      groups[day] = (groups[day] || 0) + 1;
    });
    return groups;
  }

  _getTopAccessors(accesses) {
    const accessorCounts = {};
    accesses.forEach(access => {
      accessorCounts[access.accessedBy] = (accessorCounts[access.accessedBy] || 0) + 1;
    });
    
    return Object.entries(accessorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([accessor, count]) => ({ accessor, count }));
  }

  _promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export default TranscriptSharingService;
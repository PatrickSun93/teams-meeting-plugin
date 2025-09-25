/**
 * DataRetentionService - Implements data retention policies and automatic cleanup
 * Manages transcript lifecycle, automatic deletion, and compliance with retention policies
 */

class DataRetentionService {
  constructor() {
    this.retentionPolicies = new Map();
    this.cleanupScheduler = null;
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.storageKey = 'teams_transcription_retention_policies';
    this.lastCleanupKey = 'teams_transcription_last_cleanup';
    
    this.initializeDefaultPolicies();
    this.initializeFromStorage();
    this.scheduleCleanup();
  }

  /**
   * Initialize default retention policies
   */
  initializeDefaultPolicies() {
    // Default policies for different data types
    this.setRetentionPolicy('transcripts', {
      enabled: false,
      retentionDays: 90,
      autoDelete: false,
      archiveBeforeDelete: true,
      notifyBeforeDelete: true,
      notifyDaysBefore: 7
    });

    this.setRetentionPolicy('configurations', {
      enabled: false,
      retentionDays: 365,
      autoDelete: false,
      archiveBeforeDelete: false,
      notifyBeforeDelete: false
    });

    this.setRetentionPolicy('analytics', {
      enabled: true,
      retentionDays: 30,
      autoDelete: true,
      archiveBeforeDelete: false,
      notifyBeforeDelete: false
    });

    this.setRetentionPolicy('logs', {
      enabled: true,
      retentionDays: 14,
      autoDelete: true,
      archiveBeforeDelete: false,
      notifyBeforeDelete: false
    });
  }

  /**
   * Set retention policy for a data type
   * @param {string} dataType - Type of data (transcripts, configurations, etc.)
   * @param {object} policy - Retention policy configuration
   */
  setRetentionPolicy(dataType, policy) {
    const fullPolicy = {
      dataType,
      enabled: policy.enabled || false,
      retentionDays: policy.retentionDays || 90,
      autoDelete: policy.autoDelete || false,
      archiveBeforeDelete: policy.archiveBeforeDelete || false,
      notifyBeforeDelete: policy.notifyBeforeDelete || false,
      notifyDaysBefore: policy.notifyDaysBefore || 7,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.retentionPolicies.set(dataType, fullPolicy);
    this.saveToStorage();
  }

  /**
   * Get retention policy for a data type
   * @param {string} dataType - Type of data
   * @returns {object|null} Retention policy or null if not found
   */
  getRetentionPolicy(dataType) {
    return this.retentionPolicies.get(dataType) || null;
  }

  /**
   * Get all retention policies
   * @returns {object} All retention policies
   */
  getAllRetentionPolicies() {
    const policies = {};
    this.retentionPolicies.forEach((policy, dataType) => {
      policies[dataType] = policy;
    });
    return policies;
  }

  /**
   * Check if data should be deleted based on retention policy
   * @param {string} dataType - Type of data
   * @param {number} dataTimestamp - When data was created
   * @returns {object} Deletion check result
   */
  shouldDeleteData(dataType, dataTimestamp) {
    const policy = this.getRetentionPolicy(dataType);
    
    if (!policy || !policy.enabled) {
      return { shouldDelete: false, reason: 'No retention policy or policy disabled' };
    }

    const ageInMs = Date.now() - dataTimestamp;
    const retentionMs = policy.retentionDays * 24 * 60 * 60 * 1000;
    const shouldDelete = ageInMs > retentionMs;

    return {
      shouldDelete,
      reason: shouldDelete ? 'Data exceeds retention period' : 'Data within retention period',
      ageInDays: Math.floor(ageInMs / (24 * 60 * 60 * 1000)),
      retentionDays: policy.retentionDays,
      policy
    };
  }

  /**
   * Check if data should trigger deletion notification
   * @param {string} dataType - Type of data
   * @param {number} dataTimestamp - When data was created
   * @returns {object} Notification check result
   */
  shouldNotifyBeforeDelete(dataType, dataTimestamp) {
    const policy = this.getRetentionPolicy(dataType);
    
    if (!policy || !policy.enabled || !policy.notifyBeforeDelete) {
      return { shouldNotify: false, reason: 'Notifications disabled' };
    }

    const ageInMs = Date.now() - dataTimestamp;
    const retentionMs = policy.retentionDays * 24 * 60 * 60 * 1000;
    const notificationMs = retentionMs - (policy.notifyDaysBefore * 24 * 60 * 60 * 1000);
    
    const shouldNotify = ageInMs > notificationMs && ageInMs < retentionMs;

    return {
      shouldNotify,
      reason: shouldNotify ? 'Data approaching deletion' : 'Not in notification window',
      daysUntilDeletion: Math.ceil((retentionMs - ageInMs) / (24 * 60 * 60 * 1000)),
      policy
    };
  }

  /**
   * Perform cleanup based on retention policies
   * @returns {Promise<object>} Cleanup results
   */
  async performCleanup() {
    const results = {
      startedAt: Date.now(),
      transcriptsProcessed: 0,
      transcriptsDeleted: 0,
      transcriptsArchived: 0,
      configurationsDeleted: 0,
      analyticsDeleted: 0,
      logsDeleted: 0,
      errors: []
    };

    try {
      // Clean up transcripts
      const transcriptResults = await this.cleanupTranscripts();
      results.transcriptsProcessed = transcriptResults.processed;
      results.transcriptsDeleted = transcriptResults.deleted;
      results.transcriptsArchived = transcriptResults.archived;

      // Clean up configurations
      results.configurationsDeleted = await this.cleanupConfigurations();

      // Clean up analytics data
      results.analyticsDeleted = await this.cleanupAnalytics();

      // Clean up logs
      results.logsDeleted = await this.cleanupLogs();

      // Update last cleanup timestamp
      localStorage.setItem(this.lastCleanupKey, Date.now().toString());

    } catch (error) {
      results.errors.push({
        type: 'general',
        message: error.message,
        timestamp: Date.now()
      });
    }

    results.completedAt = Date.now();
    results.duration = results.completedAt - results.startedAt;

    // Log cleanup results
    console.log('Data retention cleanup completed:', results);

    return results;
  }

  /**
   * Clean up transcripts based on retention policy
   * @returns {Promise<object>} Cleanup results for transcripts
   */
  async cleanupTranscripts() {
    const policy = this.getRetentionPolicy('transcripts');
    const results = { processed: 0, deleted: 0, archived: 0 };

    if (!policy || !policy.enabled || !policy.autoDelete) {
      return results;
    }

    try {
      // Get all stored transcripts
      const transcripts = await this.getAllStoredTranscripts();
      results.processed = transcripts.length;

      for (const transcript of transcripts) {
        const deleteCheck = this.shouldDeleteData('transcripts', transcript.timestamp);
        
        if (deleteCheck.shouldDelete) {
          if (policy.archiveBeforeDelete) {
            await this.archiveTranscript(transcript);
            results.archived++;
          }
          
          await this.deleteTranscript(transcript.id);
          results.deleted++;
        }
      }
    } catch (error) {
      console.error('Error cleaning up transcripts:', error);
    }

    return results;
  }

  /**
   * Clean up configuration data
   * @returns {Promise<number>} Number of configurations deleted
   */
  async cleanupConfigurations() {
    const policy = this.getRetentionPolicy('configurations');
    let deleted = 0;

    if (!policy || !policy.enabled || !policy.autoDelete) {
      return deleted;
    }

    try {
      // Implementation would depend on how configurations are stored
      // This is a placeholder for the actual cleanup logic
      console.log('Configuration cleanup not implemented yet');
    } catch (error) {
      console.error('Error cleaning up configurations:', error);
    }

    return deleted;
  }

  /**
   * Clean up analytics data
   * @returns {Promise<number>} Number of analytics records deleted
   */
  async cleanupAnalytics() {
    const policy = this.getRetentionPolicy('analytics');
    let deleted = 0;

    if (!policy || !policy.enabled || !policy.autoDelete) {
      return deleted;
    }

    try {
      // Clean up analytics data from localStorage
      const analyticsKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('teams_transcription_analytics_')) {
          analyticsKeys.push(key);
        }
      }

      const cutoffTime = Date.now() - (policy.retentionDays * 24 * 60 * 60 * 1000);

      for (const key of analyticsKeys) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.timestamp && data.timestamp < cutoffTime) {
            localStorage.removeItem(key);
            deleted++;
          }
        } catch (error) {
          // Invalid data, remove it
          localStorage.removeItem(key);
          deleted++;
        }
      }
    } catch (error) {
      console.error('Error cleaning up analytics:', error);
    }

    return deleted;
  }

  /**
   * Clean up log data
   * @returns {Promise<number>} Number of log entries deleted
   */
  async cleanupLogs() {
    const policy = this.getRetentionPolicy('logs');
    let deleted = 0;

    if (!policy || !policy.enabled || !policy.autoDelete) {
      return deleted;
    }

    try {
      // Clean up log data from localStorage
      const logKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('teams_transcription_log_')) {
          logKeys.push(key);
        }
      }

      const cutoffTime = Date.now() - (policy.retentionDays * 24 * 60 * 60 * 1000);

      for (const key of logKeys) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.timestamp && data.timestamp < cutoffTime) {
            localStorage.removeItem(key);
            deleted++;
          }
        } catch (error) {
          // Invalid data, remove it
          localStorage.removeItem(key);
          deleted++;
        }
      }
    } catch (error) {
      console.error('Error cleaning up logs:', error);
    }

    return deleted;
  }

  /**
   * Get all stored transcripts (placeholder implementation)
   * @returns {Promise<Array>} Array of transcript metadata
   */
  async getAllStoredTranscripts() {
    // This would integrate with the TranscriptStorageService
    // For now, return empty array
    return [];
  }

  /**
   * Archive transcript before deletion
   * @param {object} transcript - Transcript to archive
   * @returns {Promise<boolean>} Success status
   */
  async archiveTranscript(transcript) {
    try {
      // Create archive entry
      const archive = {
        originalId: transcript.id,
        archivedAt: Date.now(),
        originalTimestamp: transcript.timestamp,
        metadata: {
          meetingId: transcript.meetingId,
          duration: transcript.duration,
          participantCount: transcript.participants?.length || 0
        }
      };

      const archiveKey = `teams_transcription_archive_${transcript.id}`;
      localStorage.setItem(archiveKey, JSON.stringify(archive));
      
      return true;
    } catch (error) {
      console.error('Failed to archive transcript:', error);
      return false;
    }
  }

  /**
   * Delete transcript
   * @param {string} transcriptId - ID of transcript to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteTranscript(transcriptId) {
    try {
      // This would integrate with the TranscriptStorageService
      // For now, just remove from localStorage if it exists
      const transcriptKey = `teams_transcription_transcript_${transcriptId}`;
      localStorage.removeItem(transcriptKey);
      return true;
    } catch (error) {
      console.error('Failed to delete transcript:', error);
      return false;
    }
  }

  /**
   * Schedule automatic cleanup
   */
  scheduleCleanup() {
    if (this.cleanupScheduler) {
      clearInterval(this.cleanupScheduler);
    }

    this.cleanupScheduler = setInterval(async () => {
      await this.performCleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup() {
    if (this.cleanupScheduler) {
      clearInterval(this.cleanupScheduler);
      this.cleanupScheduler = null;
    }
  }

  /**
   * Get cleanup status
   * @returns {object} Cleanup status information
   */
  getCleanupStatus() {
    const lastCleanup = localStorage.getItem(this.lastCleanupKey);
    
    return {
      schedulerActive: this.cleanupScheduler !== null,
      cleanupInterval: this.cleanupInterval,
      lastCleanup: lastCleanup ? parseInt(lastCleanup) : null,
      nextCleanup: lastCleanup ? parseInt(lastCleanup) + this.cleanupInterval : Date.now() + this.cleanupInterval
    };
  }

  /**
   * Manually trigger cleanup
   * @returns {Promise<object>} Cleanup results
   */
  async manualCleanup() {
    return await this.performCleanup();
  }

  /**
   * Initialize retention policies from storage
   */
  initializeFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const policies = JSON.parse(stored);
        Object.entries(policies).forEach(([dataType, policy]) => {
          this.retentionPolicies.set(dataType, policy);
        });
      }
    } catch (error) {
      console.error('Failed to initialize retention policies from storage:', error);
    }
  }

  /**
   * Save retention policies to storage
   */
  saveToStorage() {
    try {
      const policies = {};
      this.retentionPolicies.forEach((policy, dataType) => {
        policies[dataType] = policy;
      });
      localStorage.setItem(this.storageKey, JSON.stringify(policies));
    } catch (error) {
      console.error('Failed to save retention policies to storage:', error);
    }
  }

  /**
   * Export retention policy configuration
   * @returns {object} Retention policy export
   */
  exportRetentionPolicies() {
    return {
      version: '1.0',
      exportedAt: Date.now(),
      policies: this.getAllRetentionPolicies(),
      cleanupStatus: this.getCleanupStatus()
    };
  }

  /**
   * Import retention policy configuration
   * @param {object} importData - Retention policy import data
   * @returns {boolean} Success status
   */
  importRetentionPolicies(importData) {
    try {
      if (importData.policies) {
        Object.entries(importData.policies).forEach(([dataType, policy]) => {
          this.setRetentionPolicy(dataType, policy);
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import retention policies:', error);
      return false;
    }
  }
}

export default DataRetentionService;
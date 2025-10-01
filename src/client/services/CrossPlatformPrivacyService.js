/**
 * CrossPlatformPrivacyService - Manages platform-specific privacy and retention policies
 * Handles data retention, privacy controls, and compliance across different meeting platforms
 */

class CrossPlatformPrivacyService {
  constructor(transcriptStorageService, securityManager, dataRetentionService) {
    this.transcriptStorage = transcriptStorageService;
    this.securityManager = securityManager;
    this.dataRetentionService = dataRetentionService;
    this.privacyPolicies = new Map();
    this.retentionPolicies = new Map();
    this._initializePlatformPolicies();
  }

  /**
   * Initialize platform-specific privacy and retention policies
   */
  _initializePlatformPolicies() {
    this.privacyPolicies.set('teams', new TeamsPrivacyPolicy());
    this.privacyPolicies.set('zoom', new ZoomPrivacyPolicy());
    this.privacyPolicies.set('meet', new MeetPrivacyPolicy());
    this.privacyPolicies.set('generic', new GenericPrivacyPolicy());

    this.retentionPolicies.set('teams', new TeamsRetentionPolicy());
    this.retentionPolicies.set('zoom', new ZoomRetentionPolicy());
    this.retentionPolicies.set('meet', new MeetRetentionPolicy());
    this.retentionPolicies.set('generic', new GenericRetentionPolicy());
  }

  /**
   * Apply platform-specific privacy controls to transcript
   */
  async applyPrivacyControls(transcriptId, privacyOptions = {}) {
    try {
      const transcript = await this.transcriptStorage.getTranscript(transcriptId);
      if (!transcript) {
        throw new Error('Transcript not found');
      }

      const privacyPolicy = this.privacyPolicies.get(transcript.platform);
      if (!privacyPolicy) {
        throw new Error(`No privacy policy for platform: ${transcript.platform}`);
      }

      // Apply platform-specific privacy controls
      const privacyControls = await privacyPolicy.applyControls(transcript, privacyOptions);

      // Update transcript with privacy metadata
      const updatedTranscript = {
        ...transcript,
        privacyMetadata: {
          ...transcript.privacyMetadata,
          controls: privacyControls,
          lastUpdated: new Date(),
          appliedBy: privacyOptions.userId
        }
      };

      // Store updated transcript
      await this.transcriptStorage.storeTranscript(updatedTranscript, privacyControls.requiresEncryption);

      // Log privacy action
      await this._logPrivacyAction('apply_controls', transcriptId, privacyOptions);

      return privacyControls;
    } catch (error) {
      throw new Error(`Failed to apply privacy controls: ${error.message}`);
    }
  }

  /**
   * Apply platform-specific retention policy
   */
  async applyRetentionPolicy(transcriptId, retentionOptions = {}) {
    try {
      const transcript = await this.transcriptStorage.getTranscript(transcriptId);
      if (!transcript) {
        throw new Error('Transcript not found');
      }

      const retentionPolicy = this.retentionPolicies.get(transcript.platform);
      if (!retentionPolicy) {
        throw new Error(`No retention policy for platform: ${transcript.platform}`);
      }

      // Calculate retention schedule
      const retentionSchedule = await retentionPolicy.calculateRetention(transcript, retentionOptions);

      // Update transcript with retention metadata
      const updatedTranscript = {
        ...transcript,
        retentionMetadata: {
          ...transcript.retentionMetadata,
          schedule: retentionSchedule,
          policy: retentionPolicy.getPolicyName(),
          lastUpdated: new Date(),
          appliedBy: retentionOptions.userId
        }
      };

      // Store updated transcript
      await this.transcriptStorage.storeTranscript(updatedTranscript);

      // Schedule retention actions
      await this._scheduleRetentionActions(transcriptId, retentionSchedule);

      // Log retention action
      await this._logPrivacyAction('apply_retention', transcriptId, retentionOptions);

      return retentionSchedule;
    } catch (error) {
      throw new Error(`Failed to apply retention policy: ${error.message}`);
    }
  }

  /**
   * Get platform-specific privacy requirements
   */
  async getPrivacyRequirements(platform, organizationId = null) {
    const privacyPolicy = this.privacyPolicies.get(platform);
    if (!privacyPolicy) {
      throw new Error(`No privacy policy for platform: ${platform}`);
    }

    return privacyPolicy.getRequirements(organizationId);
  }

  /**
   * Get platform-specific retention requirements
   */
  async getRetentionRequirements(platform, organizationId = null) {
    const retentionPolicy = this.retentionPolicies.get(platform);
    if (!retentionPolicy) {
      throw new Error(`No retention policy for platform: ${platform}`);
    }

    return retentionPolicy.getRequirements(organizationId);
  }

  /**
   * Perform cross-platform privacy audit
   */
  async performPrivacyAudit(options = {}) {
    try {
      const auditResults = {
        timestamp: new Date(),
        platforms: {},
        summary: {
          totalTranscripts: 0,
          compliantTranscripts: 0,
          nonCompliantTranscripts: 0,
          encryptedTranscripts: 0,
          retentionViolations: 0
        },
        violations: [],
        recommendations: []
      };

      // Get all transcripts
      const allTranscripts = await this.transcriptStorage.getAllTranscripts();
      auditResults.summary.totalTranscripts = allTranscripts.length;

      // Group by platform
      const transcriptsByPlatform = this._groupTranscriptsByPlatform(allTranscripts);

      // Audit each platform
      for (const [platform, transcripts] of Object.entries(transcriptsByPlatform)) {
        const platformAudit = await this._auditPlatform(platform, transcripts);
        auditResults.platforms[platform] = platformAudit;

        // Update summary
        auditResults.summary.compliantTranscripts += platformAudit.compliantCount;
        auditResults.summary.nonCompliantTranscripts += platformAudit.nonCompliantCount;
        auditResults.summary.encryptedTranscripts += platformAudit.encryptedCount;
        auditResults.summary.retentionViolations += platformAudit.retentionViolations;

        // Collect violations and recommendations
        auditResults.violations.push(...platformAudit.violations);
        auditResults.recommendations.push(...platformAudit.recommendations);
      }

      // Log audit activity
      await this._logPrivacyAction('privacy_audit', null, options);

      return auditResults;
    } catch (error) {
      throw new Error(`Privacy audit failed: ${error.message}`);
    }
  }

  /**
   * Execute retention cleanup across all platforms
   */
  async executeRetentionCleanup(dryRun = false) {
    try {
      const cleanupResults = {
        timestamp: new Date(),
        dryRun,
        platforms: {},
        summary: {
          totalEvaluated: 0,
          markedForDeletion: 0,
          deleted: 0,
          errors: 0
        },
        actions: []
      };

      // Get all transcripts
      const allTranscripts = await this.transcriptStorage.getAllTranscripts();
      cleanupResults.summary.totalEvaluated = allTranscripts.length;

      // Group by platform
      const transcriptsByPlatform = this._groupTranscriptsByPlatform(allTranscripts);

      // Process each platform
      for (const [platform, transcripts] of Object.entries(transcriptsByPlatform)) {
        const platformCleanup = await this._executePlatformCleanup(platform, transcripts, dryRun);
        cleanupResults.platforms[platform] = platformCleanup;

        // Update summary
        cleanupResults.summary.markedForDeletion += platformCleanup.markedForDeletion;
        cleanupResults.summary.deleted += platformCleanup.deleted;
        cleanupResults.summary.errors += platformCleanup.errors;

        // Collect actions
        cleanupResults.actions.push(...platformCleanup.actions);
      }

      // Log cleanup activity
      await this._logPrivacyAction('retention_cleanup', null, { dryRun });

      return cleanupResults;
    } catch (error) {
      throw new Error(`Retention cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get cross-platform compliance status
   */
  async getComplianceStatus() {
    try {
      const complianceStatus = {
        timestamp: new Date(),
        overall: 'unknown',
        platforms: {},
        summary: {
          totalTranscripts: 0,
          compliantPlatforms: 0,
          totalPlatforms: 0,
          criticalIssues: 0,
          warnings: 0
        },
        issues: []
      };

      // Get all transcripts
      const allTranscripts = await this.transcriptStorage.getAllTranscripts();
      complianceStatus.summary.totalTranscripts = allTranscripts.length;

      // Group by platform
      const transcriptsByPlatform = this._groupTranscriptsByPlatform(allTranscripts);
      complianceStatus.summary.totalPlatforms = Object.keys(transcriptsByPlatform).length;

      // Check compliance for each platform
      for (const [platform, transcripts] of Object.entries(transcriptsByPlatform)) {
        const platformCompliance = await this._checkPlatformCompliance(platform, transcripts);
        complianceStatus.platforms[platform] = platformCompliance;

        if (platformCompliance.status === 'compliant') {
          complianceStatus.summary.compliantPlatforms++;
        }

        complianceStatus.summary.criticalIssues += platformCompliance.criticalIssues;
        complianceStatus.summary.warnings += platformCompliance.warnings;
        complianceStatus.issues.push(...platformCompliance.issues);
      }

      // Determine overall compliance status
      const complianceRatio = complianceStatus.summary.compliantPlatforms / complianceStatus.summary.totalPlatforms;
      if (complianceRatio === 1 && complianceStatus.summary.criticalIssues === 0) {
        complianceStatus.overall = 'compliant';
      } else if (complianceStatus.summary.criticalIssues > 0) {
        complianceStatus.overall = 'non-compliant';
      } else {
        complianceStatus.overall = 'partial';
      }

      return complianceStatus;
    } catch (error) {
      throw new Error(`Failed to get compliance status: ${error.message}`);
    }
  }

  /**
   * Apply emergency data protection measures
   */
  async applyEmergencyProtection(reason, options = {}) {
    try {
      const protectionResults = {
        timestamp: new Date(),
        reason,
        actions: [],
        affectedTranscripts: 0,
        errors: []
      };

      // Get all transcripts
      const allTranscripts = await this.transcriptStorage.getAllTranscripts();

      for (const transcript of allTranscripts) {
        try {
          // Apply emergency encryption if not already encrypted
          if (!transcript.encrypted) {
            await this.transcriptStorage.storeTranscript(transcript, true);
            protectionResults.actions.push({
              type: 'emergency_encryption',
              transcriptId: transcript.id,
              platform: transcript.platform,
              timestamp: new Date()
            });
          }

          // Apply immediate retention hold
          const updatedTranscript = {
            ...transcript,
            retentionMetadata: {
              ...transcript.retentionMetadata,
              emergencyHold: {
                applied: true,
                reason,
                appliedAt: new Date(),
                appliedBy: options.userId
              }
            }
          };

          await this.transcriptStorage.storeTranscript(updatedTranscript);
          protectionResults.actions.push({
            type: 'retention_hold',
            transcriptId: transcript.id,
            platform: transcript.platform,
            timestamp: new Date()
          });

          protectionResults.affectedTranscripts++;
        } catch (error) {
          protectionResults.errors.push({
            transcriptId: transcript.id,
            error: error.message
          });
        }
      }

      // Log emergency action
      await this._logPrivacyAction('emergency_protection', null, { reason, ...options });

      return protectionResults;
    } catch (error) {
      throw new Error(`Emergency protection failed: ${error.message}`);
    }
  }

  /**
   * Audit specific platform
   */
  async _auditPlatform(platform, transcripts) {
    const privacyPolicy = this.privacyPolicies.get(platform);
    const retentionPolicy = this.retentionPolicies.get(platform);

    const audit = {
      platform,
      totalTranscripts: transcripts.length,
      compliantCount: 0,
      nonCompliantCount: 0,
      encryptedCount: 0,
      retentionViolations: 0,
      violations: [],
      recommendations: []
    };

    for (const transcript of transcripts) {
      let isCompliant = true;

      // Check encryption requirements
      if (transcript.encrypted) {
        audit.encryptedCount++;
      }

      // Check privacy compliance
      if (privacyPolicy) {
        const privacyCompliance = await privacyPolicy.checkCompliance(transcript);
        if (!privacyCompliance.compliant) {
          isCompliant = false;
          audit.violations.push(...privacyCompliance.violations);
        }
      }

      // Check retention compliance
      if (retentionPolicy) {
        const retentionCompliance = await retentionPolicy.checkCompliance(transcript);
        if (!retentionCompliance.compliant) {
          isCompliant = false;
          audit.retentionViolations++;
          audit.violations.push(...retentionCompliance.violations);
        }
      }

      if (isCompliant) {
        audit.compliantCount++;
      } else {
        audit.nonCompliantCount++;
      }
    }

    // Generate recommendations
    if (privacyPolicy) {
      audit.recommendations.push(...privacyPolicy.getRecommendations(audit));
    }
    if (retentionPolicy) {
      audit.recommendations.push(...retentionPolicy.getRecommendations(audit));
    }

    return audit;
  }

  /**
   * Execute platform-specific cleanup
   */
  async _executePlatformCleanup(platform, transcripts, dryRun) {
    const retentionPolicy = this.retentionPolicies.get(platform);
    
    const cleanup = {
      platform,
      totalEvaluated: transcripts.length,
      markedForDeletion: 0,
      deleted: 0,
      errors: 0,
      actions: []
    };

    for (const transcript of transcripts) {
      try {
        if (retentionPolicy) {
          const shouldDelete = await retentionPolicy.shouldDelete(transcript);
          
          if (shouldDelete) {
            cleanup.markedForDeletion++;
            
            const action = {
              type: 'delete',
              transcriptId: transcript.id,
              platform: transcript.platform,
              reason: shouldDelete.reason,
              scheduledFor: shouldDelete.deleteDate,
              dryRun
            };

            if (!dryRun) {
              await this.transcriptStorage.deleteTranscript(transcript.id);
              cleanup.deleted++;
              action.executed = true;
            }

            cleanup.actions.push(action);
          }
        }
      } catch (error) {
        cleanup.errors++;
        cleanup.actions.push({
          type: 'error',
          transcriptId: transcript.id,
          error: error.message
        });
      }
    }

    return cleanup;
  }

  /**
   * Check platform compliance
   */
  async _checkPlatformCompliance(platform, transcripts) {
    const privacyPolicy = this.privacyPolicies.get(platform);
    const retentionPolicy = this.retentionPolicies.get(platform);

    const compliance = {
      platform,
      status: 'compliant',
      totalTranscripts: transcripts.length,
      criticalIssues: 0,
      warnings: 0,
      issues: []
    };

    for (const transcript of transcripts) {
      // Check privacy compliance
      if (privacyPolicy) {
        const privacyCheck = await privacyPolicy.checkCompliance(transcript);
        if (!privacyCheck.compliant) {
          compliance.issues.push(...privacyCheck.violations);
          compliance.criticalIssues += privacyCheck.violations.filter(v => v.severity === 'critical').length;
          compliance.warnings += privacyCheck.violations.filter(v => v.severity === 'warning').length;
        }
      }

      // Check retention compliance
      if (retentionPolicy) {
        const retentionCheck = await retentionPolicy.checkCompliance(transcript);
        if (!retentionCheck.compliant) {
          compliance.issues.push(...retentionCheck.violations);
          compliance.criticalIssues += retentionCheck.violations.filter(v => v.severity === 'critical').length;
          compliance.warnings += retentionCheck.violations.filter(v => v.severity === 'warning').length;
        }
      }
    }

    // Determine overall status
    if (compliance.criticalIssues > 0) {
      compliance.status = 'non-compliant';
    } else if (compliance.warnings > 0) {
      compliance.status = 'partial';
    }

    return compliance;
  }

  /**
   * Group transcripts by platform
   */
  _groupTranscriptsByPlatform(transcripts) {
    return transcripts.reduce((groups, transcript) => {
      const platform = transcript.platform || 'unknown';
      groups[platform] = groups[platform] || [];
      groups[platform].push(transcript);
      return groups;
    }, {});
  }

  /**
   * Schedule retention actions
   */
  async _scheduleRetentionActions(transcriptId, retentionSchedule) {
    // In a real implementation, this would integrate with a job scheduler
    for (const action of retentionSchedule.actions) {
      if (action.type === 'delete' && action.executeAt) {
        const delay = new Date(action.executeAt).getTime() - Date.now();
        if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Within 24 hours
          setTimeout(async () => {
            try {
              await this.transcriptStorage.deleteTranscript(transcriptId);
              await this._logPrivacyAction('scheduled_deletion', transcriptId, { reason: action.reason });
            } catch (error) {
              console.error(`Scheduled deletion failed for ${transcriptId}:`, error);
            }
          }, delay);
        }
      }
    }
  }

  /**
   * Log privacy action
   */
  async _logPrivacyAction(action, transcriptId, options) {
    const logEntry = {
      type: 'privacy_action',
      action,
      transcriptId,
      timestamp: new Date(),
      options: this._sanitizeOptions(options),
      userId: options?.userId
    };

    if (this.securityManager && this.securityManager.logActivity) {
      await this.securityManager.logActivity(logEntry);
    }
  }

  /**
   * Sanitize options for logging
   */
  _sanitizeOptions(options) {
    if (!options) return {};
    const sanitized = { ...options };
    delete sanitized.apiKey;
    delete sanitized.accessToken;
    delete sanitized.password;
    return sanitized;
  }
}

/**
 * Base privacy policy class
 */
class BasePrivacyPolicy {
  async applyControls(transcript, options) {
    return {
      requiresEncryption: false,
      dataMinimization: false,
      accessControls: [],
      retentionOverride: null
    };
  }

  async checkCompliance(transcript) {
    return { compliant: true, violations: [] };
  }

  getRequirements(organizationId) {
    return {
      encryption: 'optional',
      dataMinimization: false,
      accessControls: false,
      auditLogging: false
    };
  }

  getRecommendations(auditResults) {
    return [];
  }
}

/**
 * Teams-specific privacy policy
 */
class TeamsPrivacyPolicy extends BasePrivacyPolicy {
  async applyControls(transcript, options) {
    const controls = {
      requiresEncryption: options.sensitiveContent || false,
      dataMinimization: options.removePersonalInfo || false,
      accessControls: [],
      retentionOverride: null
    };

    // Teams-specific controls
    if (transcript.platformMetadata?.organizationId) {
      controls.accessControls.push({
        type: 'organization',
        value: transcript.platformMetadata.organizationId
      });
    }

    if (options.restrictToParticipants) {
      controls.accessControls.push({
        type: 'participants',
        value: transcript.platformMetadata?.participantRoles || []
      });
    }

    return controls;
  }

  async checkCompliance(transcript) {
    const violations = [];

    // Check if sensitive organizational data requires encryption
    if (transcript.platformMetadata?.organizationId && !transcript.encrypted) {
      violations.push({
        type: 'encryption_required',
        severity: 'warning',
        message: 'Organizational transcripts should be encrypted',
        transcriptId: transcript.id
      });
    }

    // Check retention metadata
    if (!transcript.retentionMetadata) {
      violations.push({
        type: 'missing_retention_metadata',
        severity: 'warning',
        message: 'Transcript missing retention metadata',
        transcriptId: transcript.id
      });
    }

    return {
      compliant: violations.length === 0,
      violations
    };
  }

  getRequirements(organizationId) {
    return {
      encryption: organizationId ? 'recommended' : 'optional',
      dataMinimization: true,
      accessControls: true,
      auditLogging: true,
      retentionPolicy: 'required'
    };
  }

  getRecommendations(auditResults) {
    const recommendations = [];

    if (auditResults.encryptedCount < auditResults.totalTranscripts * 0.5) {
      recommendations.push({
        type: 'increase_encryption',
        priority: 'medium',
        message: 'Consider encrypting more Teams transcripts for better security'
      });
    }

    return recommendations;
  }
}

/**
 * Zoom-specific privacy policy
 */
class ZoomPrivacyPolicy extends BasePrivacyPolicy {
  async applyControls(transcript, options) {
    const controls = {
      requiresEncryption: options.sensitiveContent || !!transcript.platformMetadata?.recordingId,
      dataMinimization: options.removePersonalInfo || false,
      accessControls: [],
      retentionOverride: null
    };

    // Zoom-specific controls
    if (transcript.platformMetadata?.accountId) {
      controls.accessControls.push({
        type: 'account',
        value: transcript.platformMetadata.accountId
      });
    }

    return controls;
  }

  async checkCompliance(transcript) {
    const violations = [];

    // Check if recorded meetings require encryption
    if (transcript.platformMetadata?.recordingId && !transcript.encrypted) {
      violations.push({
        type: 'recorded_meeting_encryption',
        severity: 'critical',
        message: 'Recorded meeting transcripts must be encrypted',
        transcriptId: transcript.id
      });
    }

    return {
      compliant: violations.length === 0,
      violations
    };
  }

  getRequirements(organizationId) {
    return {
      encryption: 'required_for_recordings',
      dataMinimization: false,
      accessControls: true,
      auditLogging: true,
      retentionPolicy: 'recommended'
    };
  }
}

/**
 * Google Meet-specific privacy policy
 */
class MeetPrivacyPolicy extends BasePrivacyPolicy {
  async applyControls(transcript, options) {
    const controls = {
      requiresEncryption: options.sensitiveContent || false,
      dataMinimization: options.removePersonalInfo || true, // Default for Meet
      accessControls: [],
      retentionOverride: null
    };

    // Meet-specific controls
    if (transcript.platformMetadata?.organizerEmail) {
      controls.accessControls.push({
        type: 'organizer',
        value: transcript.platformMetadata.organizerEmail
      });
    }

    return controls;
  }

  getRequirements(organizationId) {
    return {
      encryption: 'optional',
      dataMinimization: true,
      accessControls: false,
      auditLogging: false,
      retentionPolicy: 'optional'
    };
  }
}

/**
 * Generic privacy policy
 */
class GenericPrivacyPolicy extends BasePrivacyPolicy {
  getRequirements(organizationId) {
    return {
      encryption: 'optional',
      dataMinimization: false,
      accessControls: false,
      auditLogging: false,
      retentionPolicy: 'optional'
    };
  }
}

/**
 * Base retention policy class
 */
class BaseRetentionPolicy {
  getPolicyName() {
    return 'base_retention';
  }

  async calculateRetention(transcript, options) {
    const defaultRetentionDays = options.retentionDays || 90;
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() + defaultRetentionDays);

    return {
      policy: this.getPolicyName(),
      retentionPeriod: defaultRetentionDays,
      deleteDate,
      actions: [
        {
          type: 'delete',
          executeAt: deleteDate,
          reason: 'Standard retention policy'
        }
      ]
    };
  }

  async shouldDelete(transcript) {
    const retentionMetadata = transcript.retentionMetadata;
    if (!retentionMetadata || !retentionMetadata.schedule) {
      return false;
    }

    const deleteDate = new Date(retentionMetadata.schedule.deleteDate);
    if (deleteDate <= new Date()) {
      return {
        shouldDelete: true,
        reason: 'Retention period expired',
        deleteDate
      };
    }

    return false;
  }

  async checkCompliance(transcript) {
    return { compliant: true, violations: [] };
  }

  getRequirements(organizationId) {
    return {
      defaultRetentionDays: 90,
      maxRetentionDays: 365,
      requiresApproval: false
    };
  }

  getRecommendations(auditResults) {
    return [];
  }
}

/**
 * Teams-specific retention policy
 */
class TeamsRetentionPolicy extends BaseRetentionPolicy {
  getPolicyName() {
    return 'teams_retention';
  }

  async calculateRetention(transcript, options) {
    // Teams organizational data may have longer retention
    const isOrganizational = !!transcript.platformMetadata?.organizationId;
    const defaultRetentionDays = isOrganizational ? 
      (options.organizationalRetentionDays || 365) : 
      (options.retentionDays || 90);

    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() + defaultRetentionDays);

    return {
      policy: this.getPolicyName(),
      retentionPeriod: defaultRetentionDays,
      deleteDate,
      organizationalData: isOrganizational,
      actions: [
        {
          type: 'archive',
          executeAt: new Date(Date.now() + (defaultRetentionDays - 30) * 24 * 60 * 60 * 1000),
          reason: 'Pre-deletion archive'
        },
        {
          type: 'delete',
          executeAt: deleteDate,
          reason: 'Teams retention policy'
        }
      ]
    };
  }

  getRequirements(organizationId) {
    return {
      defaultRetentionDays: organizationId ? 365 : 90,
      maxRetentionDays: organizationId ? 2555 : 365, // 7 years for org data
      requiresApproval: organizationId
    };
  }
}

/**
 * Zoom-specific retention policy
 */
class ZoomRetentionPolicy extends BaseRetentionPolicy {
  getPolicyName() {
    return 'zoom_retention';
  }

  async calculateRetention(transcript, options) {
    // Recorded meetings may have different retention
    const hasRecording = !!transcript.platformMetadata?.recordingId;
    const defaultRetentionDays = hasRecording ? 
      (options.recordingRetentionDays || 180) : 
      (options.retentionDays || 90);

    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() + defaultRetentionDays);

    return {
      policy: this.getPolicyName(),
      retentionPeriod: defaultRetentionDays,
      deleteDate,
      hasRecording,
      actions: [
        {
          type: 'delete',
          executeAt: deleteDate,
          reason: 'Zoom retention policy'
        }
      ]
    };
  }

  getRequirements(organizationId) {
    return {
      defaultRetentionDays: 90,
      recordingRetentionDays: 180,
      maxRetentionDays: 365,
      requiresApproval: false
    };
  }
}

/**
 * Google Meet-specific retention policy
 */
class MeetRetentionPolicy extends BaseRetentionPolicy {
  getPolicyName() {
    return 'meet_retention';
  }

  async calculateRetention(transcript, options) {
    // Meet has shorter default retention
    const defaultRetentionDays = options.retentionDays || 60;
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() + defaultRetentionDays);

    return {
      policy: this.getPolicyName(),
      retentionPeriod: defaultRetentionDays,
      deleteDate,
      actions: [
        {
          type: 'delete',
          executeAt: deleteDate,
          reason: 'Meet retention policy'
        }
      ]
    };
  }

  getRequirements(organizationId) {
    return {
      defaultRetentionDays: 60, // Shorter default for Meet
      maxRetentionDays: 180,
      requiresApproval: false
    };
  }
}

/**
 * Generic retention policy
 */
class GenericRetentionPolicy extends BaseRetentionPolicy {
  getPolicyName() {
    return 'generic_retention';
  }
}

export default CrossPlatformPrivacyService;
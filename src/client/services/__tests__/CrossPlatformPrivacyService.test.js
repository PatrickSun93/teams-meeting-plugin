/**
 * Tests for CrossPlatformPrivacyService
 */

import CrossPlatformPrivacyService from '../CrossPlatformPrivacyService.js';

// Mock dependencies
const mockTranscriptStorage = {
  getTranscript: jest.fn(),
  storeTranscript: jest.fn(),
  getAllTranscripts: jest.fn(),
  deleteTranscript: jest.fn()
};

const mockSecurityManager = {
  logActivity: jest.fn()
};

const mockDataRetentionService = {
  applyRetentionPolicy: jest.fn()
};

describe('CrossPlatformPrivacyService', () => {
  let privacyService;

  beforeEach(() => {
    privacyService = new CrossPlatformPrivacyService(
      mockTranscriptStorage,
      mockSecurityManager,
      mockDataRetentionService
    );
    jest.clearAllMocks();
  });

  describe('applyPrivacyControls', () => {
    it('should apply Teams-specific privacy controls', async () => {
      const mockTranscript = {
        id: 'teams-transcript',
        platform: 'teams',
        title: 'Teams Meeting',
        platformMetadata: {
          organizationId: 'org-123',
          participantRoles: [{ id: 'user1', role: 'presenter' }]
        }
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptStorage.storeTranscript.mockResolvedValue('teams-transcript');

      const result = await privacyService.applyPrivacyControls('teams-transcript', {
        sensitiveContent: true,
        restrictToParticipants: true,
        userId: 'user123'
      });

      expect(result.requiresEncryption).toBe(true);
      expect(result.accessControls).toContainEqual({
        type: 'organization',
        value: 'org-123'
      });
      expect(result.accessControls).toContainEqual({
        type: 'participants',
        value: [{ id: 'user1', role: 'presenter' }]
      });
      expect(mockTranscriptStorage.storeTranscript).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyMetadata: expect.objectContaining({
            controls: result,
            appliedBy: 'user123'
          })
        }),
        true // requiresEncryption
      );
    });

    it('should apply Zoom-specific privacy controls', async () => {
      const mockTranscript = {
        id: 'zoom-transcript',
        platform: 'zoom',
        title: 'Zoom Meeting',
        platformMetadata: {
          accountId: 'acc-456',
          recordingId: 'rec-789'
        }
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptStorage.storeTranscript.mockResolvedValue('zoom-transcript');

      const result = await privacyService.applyPrivacyControls('zoom-transcript', {
        sensitiveContent: false
      });

      expect(result.requiresEncryption).toBe(true); // Due to recording
      expect(result.accessControls).toContainEqual({
        type: 'account',
        value: 'acc-456'
      });
    });

    it('should apply Google Meet privacy controls', async () => {
      const mockTranscript = {
        id: 'meet-transcript',
        platform: 'meet',
        title: 'Google Meet Session',
        platformMetadata: {
          organizerEmail: 'organizer@example.com'
        }
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptStorage.storeTranscript.mockResolvedValue('meet-transcript');

      const result = await privacyService.applyPrivacyControls('meet-transcript', {});

      expect(result.dataMinimization).toBe(true); // Default for Meet
      expect(result.accessControls).toContainEqual({
        type: 'organizer',
        value: 'organizer@example.com'
      });
    });

    it('should handle transcript not found', async () => {
      mockTranscriptStorage.getTranscript.mockResolvedValue(null);

      await expect(
        privacyService.applyPrivacyControls('nonexistent')
      ).rejects.toThrow('Transcript not found');
    });

    it('should handle unsupported platform', async () => {
      const mockTranscript = {
        id: 'unknown-transcript',
        platform: 'unknown-platform'
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);

      await expect(
        privacyService.applyPrivacyControls('unknown-transcript')
      ).rejects.toThrow('No privacy policy for platform: unknown-platform');
    });
  });

  describe('applyRetentionPolicy', () => {
    it('should apply Teams retention policy with organizational data', async () => {
      const mockTranscript = {
        id: 'teams-transcript',
        platform: 'teams',
        createdAt: new Date(),
        platformMetadata: {
          organizationId: 'org-123'
        }
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptStorage.storeTranscript.mockResolvedValue('teams-transcript');

      const result = await privacyService.applyRetentionPolicy('teams-transcript', {
        organizationalRetentionDays: 730,
        userId: 'user123'
      });

      expect(result.policy).toBe('teams_retention');
      expect(result.retentionPeriod).toBe(730);
      expect(result.organizationalData).toBe(true);
      expect(result.actions).toHaveLength(2); // Archive and delete actions
      expect(result.actions[0].type).toBe('archive');
      expect(result.actions[1].type).toBe('delete');
    });

    it('should apply Zoom retention policy for recorded meetings', async () => {
      const mockTranscript = {
        id: 'zoom-transcript',
        platform: 'zoom',
        createdAt: new Date(),
        platformMetadata: {
          recordingId: 'rec-123'
        }
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptStorage.storeTranscript.mockResolvedValue('zoom-transcript');

      const result = await privacyService.applyRetentionPolicy('zoom-transcript', {
        recordingRetentionDays: 180
      });

      expect(result.policy).toBe('zoom_retention');
      expect(result.retentionPeriod).toBe(180);
      expect(result.hasRecording).toBe(true);
    });

    it('should apply Google Meet retention policy', async () => {
      const mockTranscript = {
        id: 'meet-transcript',
        platform: 'meet',
        createdAt: new Date()
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptStorage.storeTranscript.mockResolvedValue('meet-transcript');

      const result = await privacyService.applyRetentionPolicy('meet-transcript');

      expect(result.policy).toBe('meet_retention');
      expect(result.retentionPeriod).toBe(60); // Shorter default for Meet
    });

    it('should handle generic platform retention', async () => {
      const mockTranscript = {
        id: 'generic-transcript',
        platform: 'generic',
        createdAt: new Date()
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptStorage.storeTranscript.mockResolvedValue('generic-transcript');

      const result = await privacyService.applyRetentionPolicy('generic-transcript');

      expect(result.policy).toBe('generic_retention');
      expect(result.retentionPeriod).toBe(90); // Default retention
    });
  });

  describe('getPrivacyRequirements', () => {
    it('should return Teams privacy requirements', async () => {
      const requirements = await privacyService.getPrivacyRequirements('teams', 'org-123');

      expect(requirements.encryption).toBe('recommended');
      expect(requirements.dataMinimization).toBe(true);
      expect(requirements.accessControls).toBe(true);
      expect(requirements.auditLogging).toBe(true);
      expect(requirements.retentionPolicy).toBe('required');
    });

    it('should return Zoom privacy requirements', async () => {
      const requirements = await privacyService.getPrivacyRequirements('zoom');

      expect(requirements.encryption).toBe('required_for_recordings');
      expect(requirements.accessControls).toBe(true);
      expect(requirements.auditLogging).toBe(true);
    });

    it('should return Google Meet privacy requirements', async () => {
      const requirements = await privacyService.getPrivacyRequirements('meet');

      expect(requirements.encryption).toBe('optional');
      expect(requirements.dataMinimization).toBe(true);
      expect(requirements.accessControls).toBe(false);
    });

    it('should return generic privacy requirements', async () => {
      const requirements = await privacyService.getPrivacyRequirements('generic');

      expect(requirements.encryption).toBe('optional');
      expect(requirements.dataMinimization).toBe(false);
      expect(requirements.accessControls).toBe(false);
    });
  });

  describe('performPrivacyAudit', () => {
    it('should perform comprehensive privacy audit', async () => {
      const mockTranscripts = [
        {
          id: 'teams-1',
          platform: 'teams',
          encrypted: true,
          platformMetadata: { organizationId: 'org-123' },
          retentionMetadata: { schedule: { deleteDate: new Date(Date.now() + 86400000) } }
        },
        {
          id: 'teams-2',
          platform: 'teams',
          encrypted: false,
          platformMetadata: { organizationId: 'org-123' }
        },
        {
          id: 'zoom-1',
          platform: 'zoom',
          encrypted: true,
          platformMetadata: { recordingId: 'rec-123' }
        },
        {
          id: 'meet-1',
          platform: 'meet',
          encrypted: false
        }
      ];

      mockTranscriptStorage.getAllTranscripts.mockResolvedValue(mockTranscripts);

      const auditResults = await privacyService.performPrivacyAudit();

      expect(auditResults.summary.totalTranscripts).toBe(4);
      expect(auditResults.summary.encryptedTranscripts).toBe(2);
      expect(auditResults.platforms).toHaveProperty('teams');
      expect(auditResults.platforms).toHaveProperty('zoom');
      expect(auditResults.platforms).toHaveProperty('meet');
      
      // Teams should have violations (unencrypted organizational data)
      expect(auditResults.platforms.teams.nonCompliantCount).toBeGreaterThan(0);
      expect(auditResults.violations.length).toBeGreaterThan(0);
    });

    it('should handle empty transcript collection', async () => {
      mockTranscriptStorage.getAllTranscripts.mockResolvedValue([]);

      const auditResults = await privacyService.performPrivacyAudit();

      expect(auditResults.summary.totalTranscripts).toBe(0);
      expect(auditResults.summary.compliantTranscripts).toBe(0);
      expect(auditResults.violations).toHaveLength(0);
    });
  });

  describe('executeRetentionCleanup', () => {
    it('should execute retention cleanup in dry run mode', async () => {
      const mockTranscripts = [
        {
          id: 'old-transcript',
          platform: 'teams',
          createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days old
          retentionMetadata: {
            schedule: {
              deleteDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // Should be deleted
            }
          }
        },
        {
          id: 'recent-transcript',
          platform: 'teams',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
          retentionMetadata: {
            schedule: {
              deleteDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // Future deletion
            }
          }
        }
      ];

      mockTranscriptStorage.getAllTranscripts.mockResolvedValue(mockTranscripts);

      const cleanupResults = await privacyService.executeRetentionCleanup(true);

      expect(cleanupResults.dryRun).toBe(true);
      expect(cleanupResults.summary.totalEvaluated).toBe(2);
      expect(cleanupResults.summary.markedForDeletion).toBe(1);
      expect(cleanupResults.summary.deleted).toBe(0); // Dry run, no actual deletion
      expect(mockTranscriptStorage.deleteTranscript).not.toHaveBeenCalled();
    });

    it('should execute actual retention cleanup', async () => {
      const mockTranscripts = [
        {
          id: 'expired-transcript',
          platform: 'teams',
          createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
          retentionMetadata: {
            schedule: {
              deleteDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
            }
          }
        }
      ];

      mockTranscriptStorage.getAllTranscripts.mockResolvedValue(mockTranscripts);
      mockTranscriptStorage.deleteTranscript.mockResolvedValue(true);

      const cleanupResults = await privacyService.executeRetentionCleanup(false);

      expect(cleanupResults.dryRun).toBe(false);
      expect(cleanupResults.summary.markedForDeletion).toBe(1);
      expect(cleanupResults.summary.deleted).toBe(1);
      expect(mockTranscriptStorage.deleteTranscript).toHaveBeenCalledWith('expired-transcript');
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockTranscripts = [
        {
          id: 'error-transcript',
          platform: 'teams',
          createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
          retentionMetadata: {
            schedule: {
              deleteDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
            }
          }
        }
      ];

      mockTranscriptStorage.getAllTranscripts.mockResolvedValue(mockTranscripts);
      mockTranscriptStorage.deleteTranscript.mockRejectedValue(new Error('Deletion failed'));

      const cleanupResults = await privacyService.executeRetentionCleanup(false);

      expect(cleanupResults.summary.errors).toBe(1);
      expect(cleanupResults.actions).toContainEqual(
        expect.objectContaining({
          type: 'error',
          transcriptId: 'error-transcript',
          error: 'Deletion failed'
        })
      );
    });
  });

  describe('getComplianceStatus', () => {
    it('should return overall compliance status', async () => {
      const mockTranscripts = [
        {
          id: 'compliant-teams',
          platform: 'teams',
          encrypted: true,
          platformMetadata: { organizationId: 'org-123' },
          retentionMetadata: { schedule: {} }
        },
        {
          id: 'non-compliant-zoom',
          platform: 'zoom',
          encrypted: false,
          platformMetadata: { recordingId: 'rec-123' } // Should be encrypted
        }
      ];

      mockTranscriptStorage.getAllTranscripts.mockResolvedValue(mockTranscripts);

      const complianceStatus = await privacyService.getComplianceStatus();

      expect(complianceStatus.overall).toBe('non-compliant'); // Due to critical issues
      expect(complianceStatus.summary.totalTranscripts).toBe(2);
      expect(complianceStatus.summary.totalPlatforms).toBe(2);
      expect(complianceStatus.summary.criticalIssues).toBeGreaterThan(0);
      expect(complianceStatus.platforms).toHaveProperty('teams');
      expect(complianceStatus.platforms).toHaveProperty('zoom');
    });

    it('should return compliant status when all transcripts are compliant', async () => {
      const mockTranscripts = [
        {
          id: 'compliant-transcript',
          platform: 'meet',
          encrypted: false, // Optional for Meet
          retentionMetadata: { schedule: {} }
        }
      ];

      mockTranscriptStorage.getAllTranscripts.mockResolvedValue(mockTranscripts);

      const complianceStatus = await privacyService.getComplianceStatus();

      expect(complianceStatus.overall).toBe('compliant');
      expect(complianceStatus.summary.criticalIssues).toBe(0);
      expect(complianceStatus.summary.compliantPlatforms).toBe(1);
    });
  });

  describe('applyEmergencyProtection', () => {
    it('should apply emergency protection to all transcripts', async () => {
      const mockTranscripts = [
        {
          id: 'transcript-1',
          platform: 'teams',
          encrypted: false
        },
        {
          id: 'transcript-2',
          platform: 'zoom',
          encrypted: true // Already encrypted
        }
      ];

      mockTranscriptStorage.getAllTranscripts.mockResolvedValue(mockTranscripts);
      mockTranscriptStorage.storeTranscript.mockResolvedValue(true);

      const result = await privacyService.applyEmergencyProtection('Data breach incident', {
        userId: 'admin123'
      });

      expect(result.reason).toBe('Data breach incident');
      expect(result.affectedTranscripts).toBe(2);
      expect(result.actions).toHaveLength(3); // 1 encryption + 2 retention holds
      
      // Should encrypt the unencrypted transcript
      expect(result.actions).toContainEqual(
        expect.objectContaining({
          type: 'emergency_encryption',
          transcriptId: 'transcript-1'
        })
      );

      // Should apply retention hold to both
      expect(result.actions.filter(a => a.type === 'retention_hold')).toHaveLength(2);
    });

    it('should handle errors during emergency protection', async () => {
      const mockTranscripts = [
        {
          id: 'error-transcript',
          platform: 'teams',
          encrypted: false
        }
      ];

      mockTranscriptStorage.getAllTranscripts.mockResolvedValue(mockTranscripts);
      mockTranscriptStorage.storeTranscript.mockRejectedValue(new Error('Storage failed'));

      const result = await privacyService.applyEmergencyProtection('Emergency');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        transcriptId: 'error-transcript',
        error: 'Storage failed'
      });
    });
  });

  describe('Platform-specific policies', () => {
    describe('TeamsPrivacyPolicy', () => {
      it('should check compliance for organizational data', async () => {
        const teamsPolicy = privacyService.privacyPolicies.get('teams');
        
        const transcript = {
          id: 'teams-test',
          encrypted: false,
          platformMetadata: { organizationId: 'org-123' }
        };

        const compliance = await teamsPolicy.checkCompliance(transcript);

        expect(compliance.compliant).toBe(false);
        expect(compliance.violations).toContainEqual(
          expect.objectContaining({
            type: 'encryption_required',
            severity: 'warning'
          })
        );
      });

      it('should provide recommendations for Teams', () => {
        const teamsPolicy = privacyService.privacyPolicies.get('teams');
        
        const auditResults = {
          totalTranscripts: 10,
          encryptedCount: 3
        };

        const recommendations = teamsPolicy.getRecommendations(auditResults);

        expect(recommendations).toContainEqual(
          expect.objectContaining({
            type: 'increase_encryption',
            priority: 'medium'
          })
        );
      });
    });

    describe('ZoomPrivacyPolicy', () => {
      it('should require encryption for recorded meetings', async () => {
        const zoomPolicy = privacyService.privacyPolicies.get('zoom');
        
        const transcript = {
          id: 'zoom-test',
          encrypted: false,
          platformMetadata: { recordingId: 'rec-123' }
        };

        const compliance = await zoomPolicy.checkCompliance(transcript);

        expect(compliance.compliant).toBe(false);
        expect(compliance.violations).toContainEqual(
          expect.objectContaining({
            type: 'recorded_meeting_encryption',
            severity: 'critical'
          })
        );
      });
    });

    describe('Retention policies', () => {
      it('should calculate Teams retention with organizational considerations', async () => {
        const teamsRetention = privacyService.retentionPolicies.get('teams');
        
        const transcript = {
          id: 'teams-org',
          createdAt: new Date(),
          platformMetadata: { organizationId: 'org-123' }
        };

        const retention = await teamsRetention.calculateRetention(transcript, {
          organizationalRetentionDays: 730
        });

        expect(retention.retentionPeriod).toBe(730);
        expect(retention.organizationalData).toBe(true);
        expect(retention.actions).toHaveLength(2); // Archive and delete
      });

      it('should determine if transcript should be deleted', async () => {
        const baseRetention = privacyService.retentionPolicies.get('generic');
        
        const expiredTranscript = {
          id: 'expired',
          retentionMetadata: {
            schedule: {
              deleteDate: new Date(Date.now() - 86400000) // Yesterday
            }
          }
        };

        const shouldDelete = await baseRetention.shouldDelete(expiredTranscript);

        expect(shouldDelete.shouldDelete).toBe(true);
        expect(shouldDelete.reason).toBe('Retention period expired');
      });

      it('should not delete transcript before retention period', async () => {
        const baseRetention = privacyService.retentionPolicies.get('generic');
        
        const activeTranscript = {
          id: 'active',
          retentionMetadata: {
            schedule: {
              deleteDate: new Date(Date.now() + 86400000) // Tomorrow
            }
          }
        };

        const shouldDelete = await baseRetention.shouldDelete(activeTranscript);

        expect(shouldDelete).toBe(false);
      });
    });
  });

  describe('Logging and audit', () => {
    it('should log privacy actions', async () => {
      const mockTranscript = {
        id: 'test-transcript',
        platform: 'teams'
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptStorage.storeTranscript.mockResolvedValue('test-transcript');

      await privacyService.applyPrivacyControls('test-transcript', { userId: 'user123' });

      expect(mockSecurityManager.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'privacy_action',
          action: 'apply_controls',
          transcriptId: 'test-transcript',
          userId: 'user123'
        })
      );
    });

    it('should sanitize sensitive options in logs', async () => {
      await privacyService._logPrivacyAction('test_action', 'transcript-id', {
        userId: 'user123',
        apiKey: 'secret-key',
        accessToken: 'secret-token'
      });

      const logCall = mockSecurityManager.logActivity.mock.calls[0][0];
      expect(logCall.options).not.toHaveProperty('apiKey');
      expect(logCall.options).not.toHaveProperty('accessToken');
      expect(logCall.options).toHaveProperty('userId', 'user123');
    });

    it('should handle missing security manager gracefully', async () => {
      const privacyServiceWithoutSecurity = new CrossPlatformPrivacyService(
        mockTranscriptStorage,
        null, // No security manager
        mockDataRetentionService
      );

      // Should not throw error when security manager is null
      await expect(
        privacyServiceWithoutSecurity._logPrivacyAction('test', 'id', {})
      ).resolves.toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should handle storage errors in privacy controls', async () => {
      const mockTranscript = {
        id: 'test-transcript',
        platform: 'teams'
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptStorage.storeTranscript.mockRejectedValue(new Error('Storage failed'));

      await expect(
        privacyService.applyPrivacyControls('test-transcript')
      ).rejects.toThrow('Failed to apply privacy controls: Storage failed');
    });

    it('should handle storage errors in retention policy', async () => {
      const mockTranscript = {
        id: 'test-transcript',
        platform: 'teams'
      };

      mockTranscriptStorage.getTranscript.mockResolvedValue(mockTranscript);
      mockTranscriptStorage.storeTranscript.mockRejectedValue(new Error('Storage failed'));

      await expect(
        privacyService.applyRetentionPolicy('test-transcript')
      ).rejects.toThrow('Failed to apply retention policy: Storage failed');
    });

    it('should handle audit errors gracefully', async () => {
      mockTranscriptStorage.getAllTranscripts.mockRejectedValue(new Error('Database error'));

      await expect(
        privacyService.performPrivacyAudit()
      ).rejects.toThrow('Privacy audit failed: Database error');
    });
  });
});
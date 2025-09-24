// SpeakerIdentificationService Tests
import SpeakerIdentificationService from '../SpeakerIdentificationService.js';

// Mock Web Audio API
global.AudioContext = jest.fn().mockImplementation(() => ({
  sampleRate: 16000,
  state: 'running',
  close: jest.fn()
}));

global.webkitAudioContext = global.AudioContext;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

describe('SpeakerIdentificationService', () => {
  let speakerService;
  let mockAudioData;

  beforeEach(() => {
    speakerService = new SpeakerIdentificationService();
    
    // Create mock audio data
    mockAudioData = {
      data: new Float32Array(8000), // 0.5 seconds at 16kHz
      sampleRate: 16000,
      duration: 500,
      timestamp: Date.now()
    };
    
    // Fill with some test audio pattern
    for (let i = 0; i < mockAudioData.data.length; i++) {
      mockAudioData.data[i] = Math.sin(2 * Math.PI * 440 * i / 16000) * 0.1; // 440Hz sine wave
    }
    
    // Clear localStorage mock
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
  });

  afterEach(() => {
    if (speakerService) {
      speakerService.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const result = await speakerService.initialize();
      
      expect(result).toBe(true);
      expect(speakerService.isInitialized).toBe(true);
      expect(speakerService.audioContext).toBeDefined();
    });

    test('should not initialize twice', async () => {
      await speakerService.initialize();
      const result = await speakerService.initialize();
      
      expect(result).toBe(true);
      expect(speakerService.isInitialized).toBe(true);
    });

    test('should load existing speaker profiles', async () => {
      const mockProfiles = [
        {
          id: 'speaker1',
          name: 'John Doe',
          voiceprint: [1, 2, 3, 4, 5],
          enrollmentDate: Date.now(),
          sampleCount: 5
        }
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockProfiles));
      
      await speakerService.initialize();
      
      expect(speakerService.speakerProfiles.size).toBe(1);
      expect(speakerService.speakerProfiles.get('speaker1')).toBeDefined();
    });
  });

  describe('Audio Validation', () => {
    beforeEach(async () => {
      await speakerService.initialize();
    });

    test('should validate good audio data', () => {
      const isValid = speakerService.isAudioValid(mockAudioData);
      expect(isValid).toBe(true);
    });

    test('should reject null audio data', () => {
      const isValid = speakerService.isAudioValid(null);
      expect(isValid).toBe(false);
    });

    test('should reject audio without data', () => {
      const invalidAudio = { sampleRate: 16000 };
      const isValid = speakerService.isAudioValid(invalidAudio);
      expect(isValid).toBe(false);
    });

    test('should reject too short audio', () => {
      const shortAudio = {
        data: new Float32Array(100), // Very short
        sampleRate: 16000,
        duration: 10
      };
      const isValid = speakerService.isAudioValid(shortAudio);
      expect(isValid).toBe(false);
    });

    test('should reject silent audio', () => {
      const silentAudio = {
        data: new Float32Array(8000), // All zeros
        sampleRate: 16000,
        duration: 500
      };
      const isValid = speakerService.isAudioValid(silentAudio);
      expect(isValid).toBe(false);
    });
  });

  describe('Feature Extraction', () => {
    beforeEach(async () => {
      await speakerService.initialize();
    });

    test('should extract voice features from audio', async () => {
      const features = await speakerService.extractVoiceFeatures(mockAudioData);
      
      expect(features).toBeDefined();
      expect(Array.isArray(features)).toBe(true);
      expect(features.length).toBeGreaterThan(0);
      
      // Check that features are numbers
      features.forEach(feature => {
        expect(typeof feature).toBe('number');
        expect(isFinite(feature)).toBe(true);
      });
    });

    test('should return null for invalid audio', async () => {
      const invalidAudio = { data: null };
      const features = await speakerService.extractVoiceFeatures(invalidAudio);
      
      expect(features).toBeNull();
    });

    test('should normalize features', () => {
      const testFeatures = [1, 2, 3, 4, 5];
      const normalized = speakerService.normalizeFeatures(testFeatures);
      
      expect(normalized).toBeDefined();
      expect(normalized.length).toBe(testFeatures.length);
      
      // Check that mean is approximately 0
      const mean = normalized.reduce((sum, val) => sum + val, 0) / normalized.length;
      expect(Math.abs(mean)).toBeLessThan(0.001);
    });
  });

  describe('Speaker Identification', () => {
    beforeEach(async () => {
      await speakerService.initialize();
    });

    test('should identify new speaker when no profiles exist', async () => {
      const result = await speakerService.identifySpeaker(mockAudioData);
      
      expect(result).toBeDefined();
      expect(result.speakerId).toMatch(/Speaker_\d+/);
      expect(result.isNewSpeaker).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle invalid audio gracefully', async () => {
      const result = await speakerService.identifySpeaker(null);
      
      expect(result).toBeDefined();
      expect(result.speakerId).toBe('unknown');
      expect(result.confidence).toBe(0);
      expect(result.reason).toBe('invalid_audio');
    });

    test('should track speaker consistency', async () => {
      // First identification
      const result1 = await speakerService.identifySpeaker(mockAudioData);
      const speakerId = result1.speakerId;
      
      // Second identification with same speaker
      const result2 = await speakerService.identifySpeaker(mockAudioData);
      
      expect(result2.speakerId).toBe(speakerId);
      expect(result2.consistencyScore).toBeDefined();
    });
  });

  describe('Speaker Enrollment', () => {
    beforeEach(async () => {
      await speakerService.initialize();
    });

    test('should enroll new speaker successfully', async () => {
      const speakerId = 'test_speaker';
      const speakerName = 'Test Speaker';
      const audioSamples = [mockAudioData, mockAudioData, mockAudioData];
      
      const profile = await speakerService.enrollSpeaker(speakerId, audioSamples, speakerName);
      
      expect(profile).toBeDefined();
      expect(profile.id).toBe(speakerId);
      expect(profile.name).toBe(speakerName);
      expect(profile.voiceprint).toBeDefined();
      expect(profile.sampleCount).toBe(audioSamples.length);
      
      // Check that speaker is now in profiles
      expect(speakerService.speakerProfiles.has(speakerId)).toBe(true);
    });

    test('should reject enrollment with no audio samples', async () => {
      await expect(speakerService.enrollSpeaker('test', [])).rejects.toThrow();
    });

    test('should reject enrollment with invalid speaker ID', async () => {
      await expect(speakerService.enrollSpeaker('', [mockAudioData])).rejects.toThrow();
    });

    test('should save profiles to localStorage after enrollment', async () => {
      const speakerId = 'test_speaker';
      const audioSamples = [mockAudioData];
      
      await speakerService.enrollSpeaker(speakerId, audioSamples);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'speakerProfiles',
        expect.any(String)
      );
    });
  });

  describe('Speaker Management', () => {
    beforeEach(async () => {
      await speakerService.initialize();
      
      // Enroll a test speaker
      await speakerService.enrollSpeaker('test_speaker', [mockAudioData], 'Test Speaker');
    });

    test('should get speaker profile by ID', () => {
      const profile = speakerService.getSpeakerProfile('test_speaker');
      
      expect(profile).toBeDefined();
      expect(profile.id).toBe('test_speaker');
      expect(profile.name).toBe('Test Speaker');
    });

    test('should return null for non-existent speaker', () => {
      const profile = speakerService.getSpeakerProfile('non_existent');
      expect(profile).toBeNull();
    });

    test('should get all speaker profiles', () => {
      const profiles = speakerService.getAllSpeakerProfiles();
      
      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBe(1);
      expect(profiles[0].id).toBe('test_speaker');
    });

    test('should update speaker name', () => {
      const result = speakerService.updateSpeakerName('test_speaker', 'Updated Name');
      
      expect(result).toBe(true);
      
      const profile = speakerService.getSpeakerProfile('test_speaker');
      expect(profile.name).toBe('Updated Name');
    });

    test('should remove speaker', () => {
      const result = speakerService.removeSpeaker('test_speaker');
      
      expect(result).toBe(true);
      expect(speakerService.speakerProfiles.has('test_speaker')).toBe(false);
    });

    test('should clear all profiles', () => {
      speakerService.clearAllProfiles();
      
      expect(speakerService.speakerProfiles.size).toBe(0);
      expect(speakerService.unknownSpeakers.size).toBe(0);
      expect(speakerService.speakerHistory.length).toBe(0);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('speakerProfiles');
    });
  });

  describe('Distance Calculation', () => {
    beforeEach(async () => {
      await speakerService.initialize();
    });

    test('should calculate distance between identical vectors', () => {
      const vector1 = [1, 2, 3, 4, 5];
      const vector2 = [1, 2, 3, 4, 5];
      
      const distance = speakerService.calculateDistance(vector1, vector2);
      expect(distance).toBe(0);
    });

    test('should calculate distance between different vectors', () => {
      const vector1 = [1, 2, 3, 4, 5];
      const vector2 = [2, 3, 4, 5, 6];
      
      const distance = speakerService.calculateDistance(vector1, vector2);
      expect(distance).toBeGreaterThan(0);
    });

    test('should return infinity for vectors of different lengths', () => {
      const vector1 = [1, 2, 3];
      const vector2 = [1, 2, 3, 4, 5];
      
      const distance = speakerService.calculateDistance(vector1, vector2);
      expect(distance).toBe(Infinity);
    });

    test('should convert distance to confidence', () => {
      const distance1 = 0;
      const distance2 = 5;
      const distance3 = 100;
      
      const confidence1 = speakerService.distanceToConfidence(distance1);
      const confidence2 = speakerService.distanceToConfidence(distance2);
      const confidence3 = speakerService.distanceToConfidence(distance3);
      
      expect(confidence1).toBe(1); // Perfect match
      expect(confidence2).toBeGreaterThan(confidence3); // Closer distance = higher confidence
      expect(confidence3).toBeCloseTo(0, 1); // Far distance = low confidence
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await speakerService.initialize();
    });

    test('should add and notify event listeners', () => {
      const mockListener = jest.fn();
      
      speakerService.addEventListener('speakerIdentified', mockListener);
      speakerService.notifyListeners('speakerIdentified', { test: 'data' });
      
      expect(mockListener).toHaveBeenCalledWith({ test: 'data' });
    });

    test('should remove event listeners', () => {
      const mockListener = jest.fn();
      
      speakerService.addEventListener('speakerIdentified', mockListener);
      speakerService.removeEventListener('speakerIdentified', mockListener);
      speakerService.notifyListeners('speakerIdentified', { test: 'data' });
      
      expect(mockListener).not.toHaveBeenCalled();
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Test error');
      });
      
      speakerService.addEventListener('speakerIdentified', errorListener);
      
      // Should not throw
      expect(() => {
        speakerService.notifyListeners('speakerIdentified', { test: 'data' });
      }).not.toThrow();
    });
  });

  describe('Service Status', () => {
    test('should return correct status when not initialized', () => {
      const status = speakerService.getStatus();
      
      expect(status.isInitialized).toBe(false);
      expect(status.speakerCount).toBe(0);
      expect(status.unknownSpeakerCount).toBe(0);
    });

    test('should return correct status when initialized', async () => {
      await speakerService.initialize();
      await speakerService.enrollSpeaker('test_speaker', [mockAudioData]);
      
      const status = speakerService.getStatus();
      
      expect(status.isInitialized).toBe(true);
      expect(status.speakerCount).toBe(1);
      expect(status.config).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await speakerService.initialize();
      await speakerService.enrollSpeaker('test_speaker', [mockAudioData]);
      
      speakerService.cleanup();
      
      expect(speakerService.isInitialized).toBe(false);
      expect(speakerService.speakerProfiles.size).toBe(0);
      expect(speakerService.eventListeners.size).toBe(0);
    });
  });

  describe('Audio Processing Methods', () => {
    beforeEach(async () => {
      await speakerService.initialize();
    });

    test('should apply pre-emphasis filter', () => {
      const samples = new Float32Array([1, 2, 3, 4, 5]);
      const filtered = speakerService.applyPreEmphasis(samples);
      
      expect(filtered).toBeDefined();
      expect(filtered.length).toBe(samples.length);
      expect(filtered[0]).toBe(samples[0]); // First sample unchanged
    });

    test('should apply window function', () => {
      const frame = new Float32Array([1, 1, 1, 1, 1]);
      const windowed = speakerService.applyWindow(frame, 'hamming');
      
      expect(windowed).toBeDefined();
      expect(windowed.length).toBe(frame.length);
      
      // Window should modify the values
      expect(windowed[0]).not.toBe(frame[0]);
      expect(windowed[windowed.length - 1]).not.toBe(frame[frame.length - 1]);
    });

    test('should convert Hz to mel and back', () => {
      const hz = 1000;
      const mel = speakerService.hzToMel(hz);
      const backToHz = speakerService.melToHz(mel);
      
      expect(mel).toBeGreaterThan(0);
      expect(Math.abs(backToHz - hz)).toBeLessThan(1); // Should be close to original
    });

    test('should compute feature statistics', () => {
      const featureMatrix = [
        [1, 2, 3],
        [2, 3, 4],
        [3, 4, 5]
      ];
      
      const stats = speakerService.computeFeatureStatistics(featureMatrix);
      
      expect(stats).toBeDefined();
      expect(stats.length).toBe(6); // 3 features * 2 stats (mean, std)
      
      // First feature mean should be 2 (average of 1, 2, 3)
      expect(stats[0]).toBeCloseTo(2, 1);
    });
  });
});
// Speaker Identification Service - Handles voice pattern analysis and speaker recognition
class SpeakerIdentificationService {
  constructor() {
    this.isInitialized = false;
    this.audioContext = null;
    this.speakerProfiles = new Map();
    this.unknownSpeakers = new Map();
    this.currentSpeakerId = null;
    this.speakerCounter = 0;
    
    // Configuration
    this.config = {
      minEnrollmentDuration: 3000, // 3 seconds minimum for enrollment
      confidenceThreshold: 0.6,
      maxUnknownSpeakers: 10,
      voiceprintSize: 128, // Feature vector size
      analysisWindowSize: 1024,
      hopLength: 512,
      sampleRate: 16000
    };
    
    // Voice analysis parameters
    this.analysisParams = {
      mfccCoefficients: 13,
      melFilters: 26,
      fftSize: 2048,
      windowFunction: 'hamming'
    };
    
    // Speaker tracking
    this.speakerHistory = [];
    this.maxHistoryLength = 50;
    this.consistencyWindow = 5; // Number of recent segments to check for consistency
    
    // Event listeners
    this.eventListeners = new Map();
    
    // Bind methods
    this.identifySpeaker = this.identifySpeaker.bind(this);
    this.extractVoiceFeatures = this.extractVoiceFeatures.bind(this);
  }

  /**
   * Initialize the speaker identification service
   */
  async initialize(audioContext = null) {
    if (this.isInitialized) {
      console.log('Speaker identification service already initialized');
      return true;
    }

    try {
      // Use provided audio context or create new one
      this.audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });
      
      // Initialize speaker profiles storage
      await this.loadSpeakerProfiles();
      
      this.isInitialized = true;
      console.log('Speaker identification service initialized');
      
      this.notifyListeners('initialized', {
        speakerCount: this.speakerProfiles.size,
        config: this.config
      });
      
      return true;
      
    } catch (error) {
      console.error('Failed to initialize speaker identification service:', error);
      throw new Error(`Speaker identification initialization failed: ${error.message}`);
    }
  }

  /**
   * Identify speaker from audio segment
   */
  async identifySpeaker(audioData) {
    if (!this.isInitialized) {
      throw new Error('Speaker identification service not initialized');
    }

    if (!this.isAudioValid(audioData)) {
      return {
        speakerId: 'unknown',
        confidence: 0,
        isNewSpeaker: false,
        reason: 'invalid_audio'
      };
    }

    try {
      // Extract voice features from audio
      const voiceFeatures = await this.extractVoiceFeatures(audioData);
      
      if (!voiceFeatures || voiceFeatures.length === 0) {
        return {
          speakerId: 'unknown',
          confidence: 0,
          isNewSpeaker: false,
          reason: 'feature_extraction_failed'
        };
      }
      
      // Find best matching speaker
      const matchResult = this.findBestMatch(voiceFeatures);
      
      // Update speaker tracking history
      this.updateSpeakerHistory(matchResult);
      
      // Apply consistency checking
      const consistentResult = this.applyConsistencyCheck(matchResult);
      
      console.log(`Speaker identified: ${consistentResult.speakerId} (confidence: ${consistentResult.confidence})`);
      
      // Notify listeners
      this.notifyListeners('speakerIdentified', consistentResult);
      
      return consistentResult;
      
    } catch (error) {
      console.error('Speaker identification failed:', error);
      return {
        speakerId: 'unknown',
        confidence: 0,
        isNewSpeaker: false,
        reason: 'identification_error',
        error: error.message
      };
    }
  }

  /**
   * Extract voice features using MFCC and other audio characteristics
   */
  async extractVoiceFeatures(audioData) {
    try {
      const samples = audioData.data;
      const sampleRate = audioData.sampleRate || this.config.sampleRate;
      
      // Pre-emphasis filter to balance frequency spectrum
      const preEmphasized = this.applyPreEmphasis(samples);
      
      // Extract MFCC features
      const mfccFeatures = this.extractMFCC(preEmphasized, sampleRate);
      
      // Extract pitch features
      const pitchFeatures = this.extractPitchFeatures(preEmphasized, sampleRate);
      
      // Extract spectral features
      const spectralFeatures = this.extractSpectralFeatures(preEmphasized, sampleRate);
      
      // Combine all features into a single vector
      const combinedFeatures = [
        ...mfccFeatures,
        ...pitchFeatures,
        ...spectralFeatures
      ];
      
      // Normalize features
      const normalizedFeatures = this.normalizeFeatures(combinedFeatures);
      
      return normalizedFeatures;
      
    } catch (error) {
      console.error('Feature extraction failed:', error);
      return null;
    }
  }

  /**
   * Apply pre-emphasis filter to audio signal
   */
  applyPreEmphasis(samples, alpha = 0.97) {
    const filtered = new Float32Array(samples.length);
    filtered[0] = samples[0];
    
    for (let i = 1; i < samples.length; i++) {
      filtered[i] = samples[i] - alpha * samples[i - 1];
    }
    
    return filtered;
  }

  /**
   * Extract MFCC (Mel-Frequency Cepstral Coefficients) features
   */
  extractMFCC(samples, sampleRate) {
    const frameSize = this.config.analysisWindowSize;
    const hopLength = this.config.hopLength;
    const numFrames = Math.floor((samples.length - frameSize) / hopLength) + 1;
    
    const mfccMatrix = [];
    
    for (let frame = 0; frame < numFrames; frame++) {
      const startIdx = frame * hopLength;
      const endIdx = Math.min(startIdx + frameSize, samples.length);
      const frameData = samples.slice(startIdx, endIdx);
      
      // Apply window function
      const windowedFrame = this.applyWindow(frameData, 'hamming');
      
      // Compute FFT
      const fftResult = this.computeFFT(windowedFrame);
      
      // Apply mel filter bank
      const melSpectrum = this.applyMelFilterBank(fftResult, sampleRate);
      
      // Compute DCT to get MFCC coefficients
      const mfccCoeffs = this.computeDCT(melSpectrum);
      
      mfccMatrix.push(mfccCoeffs.slice(0, this.analysisParams.mfccCoefficients));
    }
    
    // Compute statistics across frames (mean and variance)
    return this.computeFeatureStatistics(mfccMatrix);
  }

  /**
   * Apply window function to frame
   */
  applyWindow(frame, windowType = 'hamming') {
    const windowed = new Float32Array(frame.length);
    
    for (let i = 0; i < frame.length; i++) {
      let windowValue = 1;
      
      if (windowType === 'hamming') {
        windowValue = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (frame.length - 1));
      } else if (windowType === 'hanning') {
        windowValue = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (frame.length - 1));
      }
      
      windowed[i] = frame[i] * windowValue;
    }
    
    return windowed;
  }

  /**
   * Compute FFT (simplified implementation)
   */
  computeFFT(samples) {
    const N = samples.length;
    const fftSize = Math.pow(2, Math.ceil(Math.log2(N)));
    
    // Pad with zeros if necessary
    const paddedSamples = new Float32Array(fftSize);
    paddedSamples.set(samples);
    
    // Simple magnitude spectrum calculation
    const spectrum = new Float32Array(fftSize / 2);
    
    for (let k = 0; k < spectrum.length; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < fftSize; n++) {
        const angle = -2 * Math.PI * k * n / fftSize;
        real += paddedSamples[n] * Math.cos(angle);
        imag += paddedSamples[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  /**
   * Apply mel filter bank to spectrum
   */
  applyMelFilterBank(spectrum, sampleRate) {
    const numFilters = this.analysisParams.melFilters;
    const melSpectrum = new Float32Array(numFilters);
    
    // Convert frequency to mel scale
    const melMin = this.hzToMel(0);
    const melMax = this.hzToMel(sampleRate / 2);
    const melPoints = new Float32Array(numFilters + 2);
    
    for (let i = 0; i < melPoints.length; i++) {
      melPoints[i] = melMin + (melMax - melMin) * i / (numFilters + 1);
    }
    
    // Convert mel points back to Hz
    const hzPoints = melPoints.map(mel => this.melToHz(mel));
    
    // Convert Hz to FFT bin indices
    const binPoints = hzPoints.map(hz => Math.floor(hz * spectrum.length * 2 / sampleRate));
    
    // Apply triangular filters
    for (let m = 0; m < numFilters; m++) {
      let filterSum = 0;
      
      for (let k = binPoints[m]; k < binPoints[m + 2]; k++) {
        if (k >= spectrum.length) break;
        
        let weight = 0;
        if (k >= binPoints[m] && k <= binPoints[m + 1]) {
          weight = (k - binPoints[m]) / (binPoints[m + 1] - binPoints[m]);
        } else if (k >= binPoints[m + 1] && k <= binPoints[m + 2]) {
          weight = (binPoints[m + 2] - k) / (binPoints[m + 2] - binPoints[m + 1]);
        }
        
        filterSum += spectrum[k] * weight;
      }
      
      melSpectrum[m] = Math.log(Math.max(filterSum, 1e-10));
    }
    
    return melSpectrum;
  }

  /**
   * Convert Hz to mel scale
   */
  hzToMel(hz) {
    return 2595 * Math.log10(1 + hz / 700);
  }

  /**
   * Convert mel scale to Hz
   */
  melToHz(mel) {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
   * Compute DCT (Discrete Cosine Transform)
   */
  computeDCT(melSpectrum) {
    const N = melSpectrum.length;
    const dctCoeffs = new Float32Array(N);
    
    for (let k = 0; k < N; k++) {
      let sum = 0;
      for (let n = 0; n < N; n++) {
        sum += melSpectrum[n] * Math.cos(Math.PI * k * (n + 0.5) / N);
      }
      dctCoeffs[k] = sum;
    }
    
    return dctCoeffs;
  }

  /**
   * Extract pitch features from audio
   */
  extractPitchFeatures(samples, sampleRate) {
    // Simple autocorrelation-based pitch detection
    const minPitch = 50; // Hz
    const maxPitch = 400; // Hz
    const minPeriod = Math.floor(sampleRate / maxPitch);
    const maxPeriod = Math.floor(sampleRate / minPitch);
    
    let maxCorrelation = 0;
    let bestPeriod = 0;
    
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < samples.length - period; i++) {
        correlation += samples[i] * samples[i + period];
        count++;
      }
      
      if (count > 0) {
        correlation /= count;
        if (correlation > maxCorrelation) {
          maxCorrelation = correlation;
          bestPeriod = period;
        }
      }
    }
    
    const fundamentalFreq = bestPeriod > 0 ? sampleRate / bestPeriod : 0;
    
    return [
      fundamentalFreq,
      maxCorrelation,
      Math.log(fundamentalFreq + 1), // Log pitch
      fundamentalFreq > 0 ? 1 : 0 // Voiced/unvoiced
    ];
  }

  /**
   * Extract spectral features
   */
  extractSpectralFeatures(samples, sampleRate) {
    const spectrum = this.computeFFT(samples);
    
    // Spectral centroid
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = i * sampleRate / (2 * spectrum.length);
      weightedSum += frequency * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    
    // Spectral rolloff (frequency below which 85% of energy is contained)
    const energyThreshold = 0.85 * magnitudeSum;
    let cumulativeEnergy = 0;
    let rolloffFreq = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i];
      if (cumulativeEnergy >= energyThreshold) {
        rolloffFreq = i * sampleRate / (2 * spectrum.length);
        break;
      }
    }
    
    // Zero crossing rate
    let zeroCrossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const zeroCrossingRate = zeroCrossings / samples.length;
    
    return [
      spectralCentroid,
      rolloffFreq,
      zeroCrossingRate,
      Math.log(spectralCentroid + 1)
    ];
  }

  /**
   * Compute feature statistics across frames
   */
  computeFeatureStatistics(featureMatrix) {
    if (featureMatrix.length === 0) return [];
    
    const numFeatures = featureMatrix[0].length;
    const statistics = [];
    
    // Compute mean and standard deviation for each feature
    for (let f = 0; f < numFeatures; f++) {
      const values = featureMatrix.map(frame => frame[f]);
      
      // Mean
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      // Standard deviation
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      
      statistics.push(mean, std);
    }
    
    return statistics;
  }

  /**
   * Normalize feature vector
   */
  normalizeFeatures(features) {
    if (features.length === 0) return features;
    
    // Z-score normalization
    const mean = features.reduce((sum, val) => sum + val, 0) / features.length;
    const variance = features.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / features.length;
    const std = Math.sqrt(variance);
    
    if (std === 0) return features;
    
    return features.map(val => (val - mean) / std);
  }

  /**
   * Find best matching speaker for given features
   */
  findBestMatch(voiceFeatures) {
    if (this.speakerProfiles.size === 0) {
      return this.handleNewSpeaker(voiceFeatures);
    }
    
    let bestMatch = null;
    let bestDistance = Infinity;
    let bestConfidence = 0;
    
    // Compare with all known speakers
    for (const [speakerId, profile] of this.speakerProfiles) {
      const distance = this.calculateDistance(voiceFeatures, profile.voiceprint);
      const confidence = this.distanceToConfidence(distance);
      
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = speakerId;
        bestConfidence = confidence;
      }
    }
    
    // Check if match is confident enough
    if (bestConfidence >= this.config.confidenceThreshold) {
      return {
        speakerId: bestMatch,
        confidence: bestConfidence,
        isNewSpeaker: false,
        distance: bestDistance
      };
    } else {
      // Check unknown speakers
      return this.checkUnknownSpeakers(voiceFeatures) || this.handleNewSpeaker(voiceFeatures);
    }
  }

  /**
   * Calculate distance between two feature vectors
   */
  calculateDistance(features1, features2) {
    if (features1.length !== features2.length) {
      return Infinity;
    }
    
    // Euclidean distance
    let sum = 0;
    for (let i = 0; i < features1.length; i++) {
      const diff = features1[i] - features2[i];
      sum += diff * diff;
    }
    
    return Math.sqrt(sum);
  }

  /**
   * Convert distance to confidence score
   */
  distanceToConfidence(distance) {
    // Exponential decay function
    const maxDistance = 10; // Adjust based on feature space
    return Math.exp(-distance / maxDistance);
  }

  /**
   * Check against unknown speakers
   */
  checkUnknownSpeakers(voiceFeatures) {
    let bestMatch = null;
    let bestDistance = Infinity;
    let bestConfidence = 0;
    
    for (const [unknownId, unknownData] of this.unknownSpeakers) {
      const distance = this.calculateDistance(voiceFeatures, unknownData.voiceprint);
      const confidence = this.distanceToConfidence(distance);
      
      if (distance < bestDistance && confidence >= this.config.confidenceThreshold) {
        bestDistance = distance;
        bestMatch = unknownId;
        bestConfidence = confidence;
      }
    }
    
    if (bestMatch) {
      // Update unknown speaker data
      this.updateUnknownSpeaker(bestMatch, voiceFeatures);
      
      return {
        speakerId: bestMatch,
        confidence: bestConfidence,
        isNewSpeaker: false,
        distance: bestDistance
      };
    }
    
    return null;
  }

  /**
   * Handle new speaker detection
   */
  handleNewSpeaker(voiceFeatures) {
    this.speakerCounter++;
    const newSpeakerId = `Speaker_${this.speakerCounter}`;
    
    // Add to unknown speakers for tracking
    this.unknownSpeakers.set(newSpeakerId, {
      voiceprint: [...voiceFeatures],
      samples: [voiceFeatures],
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      sampleCount: 1
    });
    
    // Clean up old unknown speakers if we have too many
    if (this.unknownSpeakers.size > this.config.maxUnknownSpeakers) {
      this.cleanupUnknownSpeakers();
    }
    
    console.log(`New speaker detected: ${newSpeakerId}`);
    
    this.notifyListeners('newSpeakerDetected', {
      speakerId: newSpeakerId,
      voiceFeatures: voiceFeatures
    });
    
    return {
      speakerId: newSpeakerId,
      confidence: 0.5, // Moderate confidence for new speakers
      isNewSpeaker: true,
      distance: 0
    };
  }

  /**
   * Update unknown speaker data with new sample
   */
  updateUnknownSpeaker(speakerId, voiceFeatures) {
    const unknownData = this.unknownSpeakers.get(speakerId);
    if (!unknownData) return;
    
    // Add new sample
    unknownData.samples.push([...voiceFeatures]);
    unknownData.sampleCount++;
    unknownData.lastSeen = Date.now();
    
    // Update voiceprint (running average)
    for (let i = 0; i < voiceFeatures.length; i++) {
      unknownData.voiceprint[i] = (unknownData.voiceprint[i] * (unknownData.sampleCount - 1) + voiceFeatures[i]) / unknownData.sampleCount;
    }
    
    // Check if we have enough samples to promote to known speaker
    const duration = unknownData.lastSeen - unknownData.firstSeen;
    if (duration >= this.config.minEnrollmentDuration && unknownData.sampleCount >= 5) {
      this.promoteUnknownSpeaker(speakerId);
    }
  }

  /**
   * Promote unknown speaker to known speaker
   */
  promoteUnknownSpeaker(speakerId) {
    const unknownData = this.unknownSpeakers.get(speakerId);
    if (!unknownData) return;
    
    // Create speaker profile
    const speakerProfile = {
      id: speakerId,
      name: speakerId, // Can be updated later
      voiceprint: unknownData.voiceprint,
      enrollmentDate: Date.now(),
      sampleCount: unknownData.sampleCount,
      lastUpdated: Date.now()
    };
    
    // Add to known speakers
    this.speakerProfiles.set(speakerId, speakerProfile);
    
    // Remove from unknown speakers
    this.unknownSpeakers.delete(speakerId);
    
    console.log(`Speaker ${speakerId} promoted to known speaker`);
    
    this.notifyListeners('speakerEnrolled', {
      speakerId: speakerId,
      profile: speakerProfile
    });
    
    // Save updated profiles
    this.saveSpeakerProfiles();
  }

  /**
   * Clean up old unknown speakers
   */
  cleanupUnknownSpeakers() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    for (const [speakerId, data] of this.unknownSpeakers) {
      if (now - data.lastSeen > maxAge) {
        this.unknownSpeakers.delete(speakerId);
        console.log(`Cleaned up old unknown speaker: ${speakerId}`);
      }
    }
  }

  /**
   * Apply consistency checking to speaker identification
   */
  applyConsistencyCheck(matchResult) {
    // Add to history
    this.speakerHistory.push({
      speakerId: matchResult.speakerId,
      confidence: matchResult.confidence,
      timestamp: Date.now()
    });
    
    // Maintain history size
    if (this.speakerHistory.length > this.maxHistoryLength) {
      this.speakerHistory.shift();
    }
    
    // Check recent history for consistency
    const recentHistory = this.speakerHistory.slice(-this.consistencyWindow);
    const speakerCounts = new Map();
    
    for (const entry of recentHistory) {
      speakerCounts.set(entry.speakerId, (speakerCounts.get(entry.speakerId) || 0) + 1);
    }
    
    // Find most frequent speaker in recent history
    let mostFrequentSpeaker = matchResult.speakerId;
    let maxCount = 1;
    
    for (const [speakerId, count] of speakerCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentSpeaker = speakerId;
      }
    }
    
    // Apply consistency boost if speaker is consistent
    let adjustedConfidence = matchResult.confidence;
    if (mostFrequentSpeaker === matchResult.speakerId && maxCount >= 3) {
      adjustedConfidence = Math.min(1.0, adjustedConfidence * 1.2);
    }
    
    return {
      ...matchResult,
      confidence: adjustedConfidence,
      consistencyScore: maxCount / recentHistory.length
    };
  }

  /**
   * Update speaker tracking history
   */
  updateSpeakerHistory(matchResult) {
    this.currentSpeakerId = matchResult.speakerId;
    
    // Notify if speaker changed
    const previousEntry = this.speakerHistory[this.speakerHistory.length - 1];
    if (previousEntry && previousEntry.speakerId !== matchResult.speakerId) {
      this.notifyListeners('speakerChanged', {
        previousSpeaker: previousEntry.speakerId,
        currentSpeaker: matchResult.speakerId,
        confidence: matchResult.confidence
      });
    }
  }

  /**
   * Enroll a new speaker with provided audio samples
   */
  async enrollSpeaker(speakerId, audioSamples, speakerName = null) {
    if (!this.isInitialized) {
      throw new Error('Speaker identification service not initialized');
    }

    if (!speakerId || audioSamples.length === 0) {
      throw new Error('Speaker ID and audio samples are required');
    }

    try {
      console.log(`Enrolling speaker: ${speakerId} with ${audioSamples.length} samples`);
      
      const featureVectors = [];
      let totalDuration = 0;
      
      // Extract features from all audio samples
      for (const audioData of audioSamples) {
        if (this.isAudioValid(audioData)) {
          const features = await this.extractVoiceFeatures(audioData);
          if (features && features.length > 0) {
            featureVectors.push(features);
            totalDuration += audioData.duration || 0;
          }
        }
      }
      
      if (featureVectors.length === 0) {
        throw new Error('No valid features extracted from audio samples');
      }
      
      if (totalDuration < this.config.minEnrollmentDuration) {
        console.warn(`Enrollment duration (${totalDuration}ms) is less than minimum (${this.config.minEnrollmentDuration}ms)`);
      }
      
      // Compute average voiceprint
      const voiceprint = this.computeAverageVoiceprint(featureVectors);
      
      // Create speaker profile
      const speakerProfile = {
        id: speakerId,
        name: speakerName || speakerId,
        voiceprint: voiceprint,
        enrollmentDate: Date.now(),
        sampleCount: featureVectors.length,
        lastUpdated: Date.now(),
        enrollmentDuration: totalDuration
      };
      
      // Add to speaker profiles
      this.speakerProfiles.set(speakerId, speakerProfile);
      
      // Remove from unknown speakers if exists
      this.unknownSpeakers.delete(speakerId);
      
      // Save profiles
      await this.saveSpeakerProfiles();
      
      console.log(`Speaker ${speakerId} enrolled successfully`);
      
      this.notifyListeners('speakerEnrolled', {
        speakerId: speakerId,
        profile: speakerProfile
      });
      
      return speakerProfile;
      
    } catch (error) {
      console.error('Speaker enrollment failed:', error);
      throw new Error(`Speaker enrollment failed: ${error.message}`);
    }
  }

  /**
   * Compute average voiceprint from multiple feature vectors
   */
  computeAverageVoiceprint(featureVectors) {
    if (featureVectors.length === 0) return [];
    
    const featureLength = featureVectors[0].length;
    const averageVoiceprint = new Array(featureLength).fill(0);
    
    // Sum all feature vectors
    for (const features of featureVectors) {
      for (let i = 0; i < featureLength; i++) {
        averageVoiceprint[i] += features[i];
      }
    }
    
    // Compute average
    for (let i = 0; i < featureLength; i++) {
      averageVoiceprint[i] /= featureVectors.length;
    }
    
    return averageVoiceprint;
  }

  /**
   * Validate audio data for processing
   */
  isAudioValid(audioData) {
    if (!audioData || !audioData.data || audioData.data.length === 0) {
      return false;
    }
    
    // Check minimum duration
    const minSamples = (this.config.sampleRate * 0.5); // 0.5 seconds minimum
    if (audioData.data.length < minSamples) {
      return false;
    }
    
    // Check for audio energy (not silent)
    let energy = 0;
    for (let i = 0; i < audioData.data.length; i++) {
      energy += audioData.data[i] * audioData.data[i];
    }
    const rms = Math.sqrt(energy / audioData.data.length);
    
    return rms > 0.001; // Minimum energy threshold
  }

  /**
   * Get speaker profile by ID
   */
  getSpeakerProfile(speakerId) {
    return this.speakerProfiles.get(speakerId) || null;
  }

  /**
   * Get all speaker profiles
   */
  getAllSpeakerProfiles() {
    return Array.from(this.speakerProfiles.values());
  }

  /**
   * Update speaker name
   */
  updateSpeakerName(speakerId, newName) {
    const profile = this.speakerProfiles.get(speakerId);
    if (profile) {
      profile.name = newName;
      profile.lastUpdated = Date.now();
      this.saveSpeakerProfiles();
      
      this.notifyListeners('speakerUpdated', {
        speakerId: speakerId,
        profile: profile
      });
      
      return true;
    }
    return false;
  }

  /**
   * Remove speaker profile
   */
  removeSpeaker(speakerId) {
    const removed = this.speakerProfiles.delete(speakerId);
    if (removed) {
      this.saveSpeakerProfiles();
      
      this.notifyListeners('speakerRemoved', {
        speakerId: speakerId
      });
    }
    return removed;
  }

  /**
   * Load speaker profiles from storage
   */
  async loadSpeakerProfiles() {
    try {
      const stored = localStorage.getItem('speakerProfiles');
      if (stored) {
        const profiles = JSON.parse(stored);
        for (const profile of profiles) {
          this.speakerProfiles.set(profile.id, profile);
        }
        console.log(`Loaded ${this.speakerProfiles.size} speaker profiles`);
      }
    } catch (error) {
      console.error('Failed to load speaker profiles:', error);
    }
  }

  /**
   * Save speaker profiles to storage
   */
  async saveSpeakerProfiles() {
    try {
      const profiles = Array.from(this.speakerProfiles.values());
      localStorage.setItem('speakerProfiles', JSON.stringify(profiles));
      console.log(`Saved ${profiles.length} speaker profiles`);
    } catch (error) {
      console.error('Failed to save speaker profiles:', error);
    }
  }

  /**
   * Clear all speaker profiles
   */
  clearAllProfiles() {
    this.speakerProfiles.clear();
    this.unknownSpeakers.clear();
    this.speakerHistory = [];
    this.speakerCounter = 0;
    
    localStorage.removeItem('speakerProfiles');
    
    this.notifyListeners('profilesCleared', {});
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      speakerCount: this.speakerProfiles.size,
      unknownSpeakerCount: this.unknownSpeakers.size,
      currentSpeaker: this.currentSpeakerId,
      historyLength: this.speakerHistory.length,
      config: this.config
    };
  }

  /**
   * Add event listener
   */
  addEventListener(eventType, listener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType, listener) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify event listeners
   */
  notifyListeners(eventType, data) {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in ${eventType} listener:`, error);
      }
    });
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.speakerProfiles.clear();
    this.unknownSpeakers.clear();
    this.speakerHistory = [];
    this.eventListeners.clear();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.isInitialized = false;
    console.log('Speaker identification service cleaned up');
  }
}

export default SpeakerIdentificationService;
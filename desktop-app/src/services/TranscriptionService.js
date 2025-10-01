const { EventEmitter } = require('events');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class TranscriptionService extends EventEmitter {
  constructor() {
    super();
    this.isTranscribing = false;
    this.currentSession = null;
    this.config = {
      provider: 'local', // 'local', 'openai', 'azure', 'claude'
      apiKey: null,
      endpoint: null,
      model: 'whisper-1',
      language: 'en',
      enableSpeakerDiarization: true
    };
    this.audioBuffer = [];
    this.transcriptBuffer = [];
    this.speakerProfiles = new Map();
  }

  async initialize() {
    try {
      // Initialize local Whisper if available
      if (this.config.provider === 'local') {
        await this.initializeLocalWhisper();
      }
      
      console.log('TranscriptionService initialized');
    } catch (error) {
      console.error('Failed to initialize TranscriptionService:', error);
      throw error;
    }
  }

  async initializeLocalWhisper() {
    try {
      // Initialize @xenova/transformers for local Whisper
      const { pipeline } = require('@xenova/transformers');
      
      this.localTranscriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en',
        { quantized: false }
      );
      
      console.log('Local Whisper initialized');
    } catch (error) {
      console.warn('Local Whisper initialization failed:', error.message);
      // Fall back to cloud services if local fails
      this.config.provider = 'openai';
    }
  }

  async startTranscription(options = {}) {
    if (this.isTranscribing) {
      throw new Error('Transcription already in progress');
    }

    try {
      this.isTranscribing = true;
      this.currentSession = {
        id: options.meetingId || Date.now().toString(),
        startTime: new Date(),
        audioSource: options.audioSource,
        onTranscript: options.onTranscript || (() => {}),
        transcript: [],
        speakers: new Map()
      };

      // Set up audio processing
      if (this.currentSession.audioSource) {
        this.currentSession.audioSource.on('audioSegment', this.processAudioSegment.bind(this));
      }

      console.log('Transcription started');
      this.emit('transcriptionStarted', this.currentSession.id);
      
    } catch (error) {
      this.isTranscribing = false;
      console.error('Failed to start transcription:', error);
      throw error;
    }
  }

  async stopTranscription() {
    if (!this.isTranscribing) {
      return;
    }

    try {
      this.isTranscribing = false;
      
      // Process any remaining audio
      if (this.audioBuffer.length > 0) {
        await this.processAudioBuffer();
      }

      const session = this.currentSession;
      this.currentSession = null;

      console.log('Transcription stopped');
      this.emit('transcriptionStopped', session?.id);
      
      return session;
      
    } catch (error) {
      console.error('Failed to stop transcription:', error);
      throw error;
    }
  }

  async processAudioSegment(audioBuffer) {
    if (!this.isTranscribing || !this.currentSession) {
      return;
    }

    try {
      // Add to buffer
      this.audioBuffer.push(audioBuffer);
      
      // Process when buffer reaches threshold (e.g., 3 seconds of audio)
      const bufferDuration = this.calculateBufferDuration();
      if (bufferDuration >= 3000) { // 3 seconds
        await this.processAudioBuffer();
      }
      
    } catch (error) {
      console.error('Audio segment processing failed:', error);
      this.emit('transcriptionError', error);
    }
  }

  async processAudioBuffer() {
    if (this.audioBuffer.length === 0) {
      return;
    }

    try {
      // Combine audio buffers
      const combinedBuffer = Buffer.concat(this.audioBuffer);
      this.audioBuffer = [];

      // Transcribe audio
      const transcriptionResult = await this.transcribeAudio(combinedBuffer);
      
      if (transcriptionResult && transcriptionResult.text.trim()) {
        // Identify speaker if enabled
        let speakerId = 'Unknown';
        if (this.config.enableSpeakerDiarization) {
          speakerId = await this.identifySpeaker(combinedBuffer);
        }

        const transcript = {
          id: Date.now().toString(),
          timestamp: new Date(),
          speaker: speakerId,
          text: transcriptionResult.text.trim(),
          confidence: transcriptionResult.confidence || 0.8,
          duration: this.calculateBufferDuration()
        };

        // Add to session transcript
        this.currentSession.transcript.push(transcript);
        
        // Emit transcript update
        this.emit('transcriptUpdate', transcript);
        this.currentSession.onTranscript(transcript);
      }
      
    } catch (error) {
      console.error('Audio buffer processing failed:', error);
      this.emit('transcriptionError', error);
    }
  }

  async transcribeAudio(audioBuffer) {
    try {
      switch (this.config.provider) {
        case 'local':
          return await this.transcribeWithLocal(audioBuffer);
        case 'openai':
          return await this.transcribeWithOpenAI(audioBuffer);
        case 'azure':
          return await this.transcribeWithAzure(audioBuffer);
        case 'claude':
          return await this.transcribeWithClaude(audioBuffer);
        default:
          throw new Error(`Unsupported transcription provider: ${this.config.provider}`);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      
      // Try fallback provider
      if (this.config.provider !== 'local' && this.localTranscriber) {
        console.log('Falling back to local transcription');
        return await this.transcribeWithLocal(audioBuffer);
      }
      
      throw error;
    }
  }

  async transcribeWithLocal(audioBuffer) {
    if (!this.localTranscriber) {
      throw new Error('Local transcriber not available');
    }

    try {
      // Convert audio buffer to format expected by Whisper
      const audioArray = this.convertAudioBufferToArray(audioBuffer);
      
      const result = await this.localTranscriber(audioArray);
      
      return {
        text: result.text,
        confidence: 0.8 // Local models don't provide confidence scores
      };
    } catch (error) {
      console.error('Local transcription failed:', error);
      throw error;
    }
  }

  async transcribeWithOpenAI(audioBuffer) {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      // Save audio to temporary file
      const tempFile = path.join(__dirname, '../../temp', `audio-${Date.now()}.wav`);
      await this.saveAudioToFile(audioBuffer, tempFile);

      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFile));
      formData.append('model', this.config.model);
      formData.append('language', this.config.language);

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      // Clean up temp file
      fs.unlinkSync(tempFile);

      return {
        text: response.data.text,
        confidence: 0.9 // OpenAI doesn't provide confidence scores
      };
    } catch (error) {
      console.error('OpenAI transcription failed:', error);
      throw error;
    }
  }

  async transcribeWithAzure(audioBuffer) {
    if (!this.config.apiKey || !this.config.endpoint) {
      throw new Error('Azure Speech Services not configured');
    }

    try {
      // Azure Speech Services implementation
      // This is a simplified version - real implementation would use Azure SDK
      const response = await axios.post(
        `${this.config.endpoint}/speech/recognition/conversation/cognitiveservices/v1`,
        audioBuffer,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.config.apiKey,
            'Content-Type': 'audio/wav'
          },
          params: {
            language: this.config.language
          }
        }
      );

      return {
        text: response.data.DisplayText,
        confidence: response.data.Confidence || 0.8
      };
    } catch (error) {
      console.error('Azure transcription failed:', error);
      throw error;
    }
  }

  async transcribeWithClaude(audioBuffer) {
    // Claude doesn't have direct speech-to-text API
    // This would require a different approach or integration
    throw new Error('Claude speech transcription not implemented');
  }

  async identifySpeaker(audioBuffer) {
    try {
      // Simplified speaker identification
      // In a real implementation, you would use voice fingerprinting
      const audioFeatures = this.extractAudioFeatures(audioBuffer);
      
      // Compare with known speaker profiles
      let bestMatch = null;
      let bestScore = 0;

      for (const [speakerId, profile] of this.speakerProfiles) {
        const similarity = this.calculateSimilarity(audioFeatures, profile.features);
        if (similarity > bestScore && similarity > 0.7) {
          bestMatch = speakerId;
          bestScore = similarity;
        }
      }

      if (bestMatch) {
        return bestMatch;
      }

      // Create new speaker profile
      const newSpeakerId = `Speaker ${this.speakerProfiles.size + 1}`;
      this.speakerProfiles.set(newSpeakerId, {
        id: newSpeakerId,
        features: audioFeatures,
        sampleCount: 1
      });

      return newSpeakerId;
    } catch (error) {
      console.error('Speaker identification failed:', error);
      return 'Unknown';
    }
  }

  extractAudioFeatures(audioBuffer) {
    // Simplified audio feature extraction
    // In a real implementation, you would extract MFCC, pitch, etc.
    const features = {
      energy: this.calculateEnergy(audioBuffer),
      pitch: this.estimatePitch(audioBuffer),
      spectralCentroid: this.calculateSpectralCentroid(audioBuffer)
    };
    
    return features;
  }

  calculateSimilarity(features1, features2) {
    // Simplified similarity calculation
    const energyDiff = Math.abs(features1.energy - features2.energy);
    const pitchDiff = Math.abs(features1.pitch - features2.pitch);
    
    // Normalize and combine
    const similarity = 1 - (energyDiff + pitchDiff) / 2;
    return Math.max(0, similarity);
  }

  calculateEnergy(audioBuffer) {
    let sum = 0;
    for (let i = 0; i < audioBuffer.length; i += 2) {
      const sample = audioBuffer.readInt16LE(i);
      sum += sample * sample;
    }
    return Math.sqrt(sum / (audioBuffer.length / 2));
  }

  estimatePitch(audioBuffer) {
    // Simplified pitch estimation
    // Real implementation would use autocorrelation or FFT
    return 200; // Placeholder
  }

  calculateSpectralCentroid(audioBuffer) {
    // Simplified spectral centroid calculation
    return 1000; // Placeholder
  }

  convertAudioBufferToArray(audioBuffer) {
    // Convert Buffer to Float32Array for Whisper
    const samples = new Float32Array(audioBuffer.length / 2);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = audioBuffer.readInt16LE(i * 2) / 32768.0;
    }
    return samples;
  }

  async saveAudioToFile(audioBuffer, filePath) {
    // Ensure temp directory exists
    const tempDir = path.dirname(filePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Write WAV file with proper header
    const wavHeader = this.createWavHeader(audioBuffer.length);
    const wavFile = Buffer.concat([wavHeader, audioBuffer]);
    
    fs.writeFileSync(filePath, wavFile);
  }

  createWavHeader(dataLength) {
    const header = Buffer.alloc(44);
    
    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);
    
    // Format chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Chunk size
    header.writeUInt16LE(1, 20);  // Audio format (PCM)
    header.writeUInt16LE(1, 22);  // Channels
    header.writeUInt32LE(16000, 24); // Sample rate
    header.writeUInt32LE(32000, 28); // Byte rate
    header.writeUInt16LE(2, 32);  // Block align
    header.writeUInt16LE(16, 34); // Bits per sample
    
    // Data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);
    
    return header;
  }

  calculateBufferDuration() {
    // Estimate duration based on buffer size and sample rate
    const totalSamples = this.audioBuffer.reduce((sum, buf) => sum + buf.length / 2, 0);
    return (totalSamples / 16000) * 1000; // Convert to milliseconds
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize if provider changed
    if (newConfig.provider && newConfig.provider !== this.config.provider) {
      this.initialize();
    }
  }

  getConfig() {
    return { ...this.config };
  }

  getCurrentSession() {
    return this.currentSession ? {
      id: this.currentSession.id,
      startTime: this.currentSession.startTime,
      transcriptCount: this.currentSession.transcript.length,
      speakers: Array.from(this.currentSession.speakers.keys())
    } : null;
  }

  getTranscriptionStats() {
    return {
      isTranscribing: this.isTranscribing,
      provider: this.config.provider,
      audioBufferSize: this.audioBuffer.length,
      speakerCount: this.speakerProfiles.size,
      currentSession: this.getCurrentSession()
    };
  }
}

module.exports = TranscriptionService;
// LocalSTTController.js - Component that integrates AudioProcessor with TranscriptionEngine
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AudioProcessor from './AudioProcessor.js';
import TranscriptionEngine from '../services/TranscriptionEngine.js';

const LocalSTTController = ({ 
  isEnabled = false, 
  language = 'en',
  onTranscriptionResult,
  onError,
  onStatusChange 
}) => {
  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState(null);
  const [audioQuality, setAudioQuality] = useState(null);
  const [stats, setStats] = useState({
    totalTranscriptions: 0,
    successRate: 0,
    averageConfidence: 0,
    averageProcessingTime: 0
  });

  // Refs for services
  const audioProcessorRef = useRef(null);
  const transcriptionEngineRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Initialize AudioProcessor
        audioProcessorRef.current = new AudioProcessor();
        await audioProcessorRef.current.initialize();

        // Initialize TranscriptionEngine
        transcriptionEngineRef.current = new TranscriptionEngine();
        await transcriptionEngineRef.current.initialize({
          language: language,
          provider: 'local',
          confidenceThreshold: 0.3
        });

        // Set up event listeners
        setupEventListeners();

        setIsInitialized(true);
        setIsLoading(false);

        console.log('Local STT Controller initialized successfully');

      } catch (err) {
        console.error('Failed to initialize Local STT Controller:', err);
        setError(err.message);
        setIsLoading(false);
        
        if (onError) {
          onError(err);
        }
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, [language]);

  // Set up event listeners for services
  const setupEventListeners = useCallback(() => {
    const audioProcessor = audioProcessorRef.current;
    const transcriptionEngine = transcriptionEngineRef.current;

    if (!audioProcessor || !transcriptionEngine) return;

    // Audio processor events
    audioProcessor.addEventListener('captureStarted', handleAudioCaptureStarted);
    audioProcessor.addEventListener('captureStopped', handleAudioCaptureStopped);
    audioProcessor.addEventListener('audioReady', handleAudioReady);
    audioProcessor.addEventListener('qualityUpdate', handleAudioQualityUpdate);

    // Transcription engine events
    transcriptionEngine.addEventListener('modelLoading', handleModelLoading);
    transcriptionEngine.addEventListener('modelLoaded', handleModelLoaded);
    transcriptionEngine.addEventListener('transcriptionStarted', handleTranscriptionStarted);
    transcriptionEngine.addEventListener('transcriptionStopped', handleTranscriptionStopped);
    transcriptionEngine.addEventListener('textOutput', handleTextOutput);
    transcriptionEngine.addEventListener('transcriptionResult', handleTranscriptionResult);
    transcriptionEngine.addEventListener('transcriptionError', handleTranscriptionError);
    transcriptionEngine.addEventListener('lowQualityAudio', handleLowQualityAudio);

  }, []);

  // Event handlers
  const handleAudioCaptureStarted = useCallback((data) => {
    console.log('Audio capture started:', data);
    if (onStatusChange) {
      onStatusChange({ type: 'audioCaptureStarted', data });
    }
  }, [onStatusChange]);

  const handleAudioCaptureStopped = useCallback((data) => {
    console.log('Audio capture stopped:', data);
    if (onStatusChange) {
      onStatusChange({ type: 'audioCaptureStopped', data });
    }
  }, [onStatusChange]);

  const handleAudioReady = useCallback((audioData) => {
    // Forward audio data to transcription engine
    if (transcriptionEngineRef.current && isTranscribing) {
      transcriptionEngineRef.current.handleAudioData(audioData);
    }
  }, [isTranscribing]);

  const handleAudioQualityUpdate = useCallback((qualityMetrics) => {
    setAudioQuality(qualityMetrics);
    
    if (onStatusChange) {
      onStatusChange({ type: 'audioQualityUpdate', data: qualityMetrics });
    }
  }, [onStatusChange]);

  const handleModelLoading = useCallback((data) => {
    console.log('Model loading:', data);
    setIsLoading(true);
    
    if (onStatusChange) {
      onStatusChange({ type: 'modelLoading', data });
    }
  }, [onStatusChange]);

  const handleModelLoaded = useCallback((data) => {
    console.log('Model loaded:', data);
    setIsLoading(false);
    
    if (onStatusChange) {
      onStatusChange({ type: 'modelLoaded', data });
    }
  }, [onStatusChange]);

  const handleTranscriptionStarted = useCallback((data) => {
    console.log('Transcription started:', data);
    setIsTranscribing(true);
    setCurrentText('');
    setConfidence(0);
    
    if (onStatusChange) {
      onStatusChange({ type: 'transcriptionStarted', data });
    }
  }, [onStatusChange]);

  const handleTranscriptionStopped = useCallback((data) => {
    console.log('Transcription stopped:', data);
    setIsTranscribing(false);
    
    // Update final stats
    if (data.metrics) {
      setStats(data.metrics);
    }
    
    if (onStatusChange) {
      onStatusChange({ type: 'transcriptionStopped', data });
    }
  }, [onStatusChange]);

  const handleTextOutput = useCallback((output) => {
    console.log('Text output:', output);
    
    setCurrentText(output.text);
    setConfidence(output.confidence);
    
    // Update stats from transcription engine
    if (transcriptionEngineRef.current) {
      const currentStats = transcriptionEngineRef.current.getMetrics();
      setStats(currentStats);
    }
    
    // Notify parent component
    if (onTranscriptionResult) {
      onTranscriptionResult({
        text: output.text,
        confidence: output.confidence,
        timestamp: output.timestamp,
        segmentCount: output.segmentCount,
        provider: 'local'
      });
    }
  }, [onTranscriptionResult]);

  const handleTranscriptionResult = useCallback((result) => {
    console.log('Individual transcription result:', result);
    
    // Update current display with latest result
    if (result.text && result.text.trim().length > 0) {
      setCurrentText(prev => {
        const newText = prev ? `${prev} ${result.text}` : result.text;
        return newText.trim();
      });
      setConfidence(result.confidence);
    }
  }, []);

  const handleTranscriptionError = useCallback((errorData) => {
    console.error('Transcription error:', errorData);
    
    const errorMessage = `Transcription failed: ${errorData.error}`;
    setError(errorMessage);
    
    if (onError) {
      onError(new Error(errorMessage));
    }
  }, [onError]);

  const handleLowQualityAudio = useCallback((data) => {
    console.warn('Low quality audio detected:', data);
    
    if (onStatusChange) {
      onStatusChange({ type: 'lowQualityAudio', data });
    }
  }, [onStatusChange]);

  // Start transcription
  const startTranscription = useCallback(async () => {
    if (!isInitialized || isTranscribing) {
      console.warn('Cannot start transcription: not initialized or already transcribing');
      return false;
    }

    try {
      setError(null);

      // Get media stream (microphone access)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      mediaStreamRef.current = stream;

      // Start audio capture
      await audioProcessorRef.current.startCapture(stream);

      // Start transcription engine
      await transcriptionEngineRef.current.startTranscription();

      console.log('Local STT transcription started');
      return true;

    } catch (err) {
      console.error('Failed to start transcription:', err);
      setError(err.message);
      
      if (onError) {
        onError(err);
      }
      
      return false;
    }
  }, [isInitialized, isTranscribing, onError]);

  // Stop transcription
  const stopTranscription = useCallback(() => {
    if (!isTranscribing) {
      console.warn('Transcription not active');
      return;
    }

    try {
      // Stop transcription engine
      if (transcriptionEngineRef.current) {
        transcriptionEngineRef.current.stopTranscription();
      }

      // Stop audio capture
      if (audioProcessorRef.current) {
        audioProcessorRef.current.stopCapture();
      }

      // Stop media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      console.log('Local STT transcription stopped');

    } catch (err) {
      console.error('Error stopping transcription:', err);
      setError(err.message);
      
      if (onError) {
        onError(err);
      }
    }
  }, [isTranscribing, onError]);

  // Change language
  const changeLanguage = useCallback(async (newLanguage) => {
    if (!isInitialized) {
      console.warn('Cannot change language: not initialized');
      return false;
    }

    try {
      setError(null);
      
      if (transcriptionEngineRef.current) {
        await transcriptionEngineRef.current.changeLanguage(newLanguage);
        console.log(`Language changed to: ${newLanguage}`);
        
        if (onStatusChange) {
          onStatusChange({ type: 'languageChanged', data: { language: newLanguage } });
        }
        
        return true;
      }
      
      return false;

    } catch (err) {
      console.error('Failed to change language:', err);
      setError(err.message);
      
      if (onError) {
        onError(err);
      }
      
      return false;
    }
  }, [isInitialized, onError, onStatusChange]);

  // Get available languages
  const getAvailableLanguages = useCallback(() => {
    if (transcriptionEngineRef.current) {
      return transcriptionEngineRef.current.getAvailableLanguages();
    }
    return ['en'];
  }, []);

  // Get current status
  const getStatus = useCallback(() => {
    return {
      isInitialized,
      isTranscribing,
      isLoading,
      currentText,
      confidence,
      error,
      audioQuality,
      stats,
      audioProcessorStatus: audioProcessorRef.current ? audioProcessorRef.current.getStatus() : null,
      transcriptionEngineStatus: transcriptionEngineRef.current ? transcriptionEngineRef.current.getStatus() : null
    };
  }, [isInitialized, isTranscribing, isLoading, currentText, confidence, error, audioQuality, stats]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up Local STT Controller');

    // Stop transcription if active
    if (isTranscribing) {
      stopTranscription();
    }

    // Cleanup services
    if (audioProcessorRef.current) {
      audioProcessorRef.current.cleanup();
      audioProcessorRef.current = null;
    }

    if (transcriptionEngineRef.current) {
      transcriptionEngineRef.current.cleanup();
      transcriptionEngineRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Reset state
    setIsInitialized(false);
    setIsTranscribing(false);
    setIsLoading(false);
    setCurrentText('');
    setConfidence(0);
    setError(null);
    setAudioQuality(null);
  }, [isTranscribing, stopTranscription]);

  // Effect to handle enabled/disabled state
  useEffect(() => {
    if (isEnabled && isInitialized && !isTranscribing) {
      startTranscription();
    } else if (!isEnabled && isTranscribing) {
      stopTranscription();
    }
  }, [isEnabled, isInitialized, isTranscribing, startTranscription, stopTranscription]);

  // Expose methods and state through ref or return object
  return {
    // State
    isInitialized,
    isTranscribing,
    isLoading,
    currentText,
    confidence,
    error,
    audioQuality,
    stats,

    // Methods
    startTranscription,
    stopTranscription,
    changeLanguage,
    getAvailableLanguages,
    getStatus,
    cleanup
  };
};

export default LocalSTTController;
// LocalSTTDemo.js - Demo component showing local STT functionality
import React, { useState, useRef, useEffect } from 'react';
import LocalSTTController from './LocalSTTController.js';

const LocalSTTDemo = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [language, setLanguage] = useState('en');
  const [availableLanguages, setAvailableLanguages] = useState(['en']);
  const [stats, setStats] = useState({});

  const sttControllerRef = useRef(null);

  // Initialize STT Controller
  useEffect(() => {
    sttControllerRef.current = LocalSTTController({
      isEnabled: false,
      language: language,
      onTranscriptionResult: handleTranscriptionResult,
      onError: handleError,
      onStatusChange: handleStatusChange
    });

    // Get available languages once initialized
    const checkInitialization = setInterval(() => {
      if (sttControllerRef.current && sttControllerRef.current.isInitialized) {
        const languages = sttControllerRef.current.getAvailableLanguages();
        setAvailableLanguages(languages);
        setStatus('Ready');
        clearInterval(checkInitialization);
      }
    }, 500);

    return () => {
      clearInterval(checkInitialization);
      if (sttControllerRef.current) {
        sttControllerRef.current.cleanup();
      }
    };
  }, [language]);

  const handleTranscriptionResult = (result) => {
    setTranscriptionText(prev => {
      const newText = prev ? `${prev} ${result.text}` : result.text;
      return newText.trim();
    });
    setConfidence(result.confidence);
    
    // Update stats
    if (sttControllerRef.current) {
      const currentStatus = sttControllerRef.current.getStatus();
      setStats(currentStatus.stats);
    }
  };

  const handleError = (error) => {
    setError(error.message);
    setStatus('Error');
  };

  const handleStatusChange = (statusData) => {
    switch (statusData.type) {
      case 'modelLoading':
        setStatus('Loading model...');
        break;
      case 'modelLoaded':
        setStatus('Model loaded');
        break;
      case 'transcriptionStarted':
        setStatus('Transcribing...');
        setError(null);
        break;
      case 'transcriptionStopped':
        setStatus('Stopped');
        break;
      case 'audioQualityUpdate':
        // Could show audio quality indicators here
        break;
      case 'lowQualityAudio':
        setError('Low audio quality detected');
        break;
      default:
        break;
    }
  };

  const toggleTranscription = async () => {
    if (!sttControllerRef.current) return;

    if (isEnabled) {
      sttControllerRef.current.stopTranscription();
      setIsEnabled(false);
    } else {
      const success = await sttControllerRef.current.startTranscription();
      if (success) {
        setIsEnabled(true);
        setTranscriptionText('');
        setError(null);
      }
    }
  };

  const changeLanguage = async (newLanguage) => {
    if (!sttControllerRef.current) return;

    setStatus('Changing language...');
    const success = await sttControllerRef.current.changeLanguage(newLanguage);
    if (success) {
      setLanguage(newLanguage);
      setStatus('Ready');
    } else {
      setStatus('Language change failed');
    }
  };

  const clearTranscription = () => {
    setTranscriptionText('');
    setConfidence(0);
  };

  const getStatusColor = () => {
    if (error) return '#ff4444';
    if (isEnabled) return '#44ff44';
    if (status === 'Ready') return '#4444ff';
    return '#ffaa44';
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Local STT Demo</h2>
      
      {/* Status Section */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '10px', 
        border: '1px solid #ccc', 
        borderRadius: '5px',
        backgroundColor: '#f9f9f9'
      }}>
        <h3>Status</h3>
        <div style={{ color: getStatusColor(), fontWeight: 'bold' }}>
          {status}
        </div>
        {error && (
          <div style={{ color: '#ff4444', marginTop: '5px' }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* Controls Section */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Controls</h3>
        
        <div style={{ marginBottom: '10px' }}>
          <label style={{ marginRight: '10px' }}>Language:</label>
          <select 
            value={language} 
            onChange={(e) => changeLanguage(e.target.value)}
            disabled={isEnabled}
            style={{ padding: '5px' }}
          >
            {availableLanguages.map(lang => (
              <option key={lang} value={lang}>
                {lang === 'en' ? 'English' : 
                 lang === 'multilingual' ? 'Multilingual' :
                 lang === 'es' ? 'Spanish' :
                 lang === 'fr' ? 'French' :
                 lang === 'de' ? 'German' : lang}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={toggleTranscription}
            disabled={status !== 'Ready' && !isEnabled}
            style={{
              padding: '10px 20px',
              backgroundColor: isEnabled ? '#ff4444' : '#44aa44',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            {isEnabled ? 'Stop Transcription' : 'Start Transcription'}
          </button>

          <button 
            onClick={clearTranscription}
            style={{
              padding: '10px 20px',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Clear Text
          </button>
        </div>
      </div>

      {/* Transcription Section */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Transcription</h3>
        <div style={{
          border: '1px solid #ccc',
          borderRadius: '5px',
          padding: '15px',
          minHeight: '100px',
          backgroundColor: '#fff',
          fontSize: '16px',
          lineHeight: '1.5'
        }}>
          {transcriptionText || (isEnabled ? 'Listening... speak into your microphone.' : 'Click "Start Transcription" to begin.')}
        </div>
        
        {confidence > 0 && (
          <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            Confidence: {Math.round(confidence * 100)}%
          </div>
        )}
      </div>

      {/* Statistics Section */}
      {stats.totalTranscriptions > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Statistics</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '10px',
            fontSize: '14px'
          }}>
            <div>
              <strong>Total Transcriptions:</strong> {stats.totalTranscriptions}
            </div>
            <div>
              <strong>Success Rate:</strong> {Math.round(stats.successRate)}%
            </div>
            <div>
              <strong>Average Confidence:</strong> {Math.round(stats.averageConfidence * 100)}%
            </div>
            <div>
              <strong>Avg Processing Time:</strong> {Math.round(stats.averageProcessingTime)}ms
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{ 
        marginTop: '30px', 
        padding: '15px', 
        backgroundColor: '#e8f4f8', 
        borderRadius: '5px',
        fontSize: '14px'
      }}>
        <h4>Instructions:</h4>
        <ol>
          <li>Select your preferred language from the dropdown</li>
          <li>Click "Start Transcription" to begin</li>
          <li>Allow microphone access when prompted</li>
          <li>Speak clearly into your microphone</li>
          <li>Watch the transcription appear in real-time</li>
          <li>Click "Stop Transcription" when finished</li>
        </ol>
        
        <p><strong>Note:</strong> This demo uses local Whisper.js models for privacy. 
        The first time you use a model, it may take a moment to download and initialize.</p>
      </div>
    </div>
  );
};

export default LocalSTTDemo;
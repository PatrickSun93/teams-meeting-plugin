// Real-time Transcription Display Component
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './RealTimeTranscription.css';

const RealTimeTranscription = ({ 
  transcriptionEngine, 
  isActive = false,
  onPause,
  onResume,
  onClear,
  onTranscriptUpdate,
  onSummaryUpdate
}) => {
  const [transcriptionSegments, setTranscriptionSegments] = useState([]);
  const [currentText, setCurrentText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState([]);
  const [editingSegment, setEditingSegment] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const transcriptRef = useRef(null);
  const autoScrollRef = useRef(true);

  // Handle transcription results
  const handleTranscriptionResult = useCallback((result) => {
    if (isPaused) return;

    const segment = {
      id: result.id || `segment_${Date.now()}`,
      text: result.text,
      confidence: result.confidence,
      timestamp: result.timestamp || Date.now(),
      provider: result.provider,
      segments: result.segments || [],
      isEdited: false
    };

    setTranscriptionSegments(prev => {
      const newSegments = [...prev, segment];
      
      // Update parent component with current transcript
      if (onTranscriptUpdate) {
        const transcript = {
          meetingId: `meeting_${Date.now()}`,
          startTime: newSegments[0]?.timestamp || Date.now(),
          endTime: Date.now(),
          segments: newSegments,
          speakers: [...new Set(newSegments.map(s => s.speakerId || 'Unknown Speaker'))],
          meetingTitle: 'Teams Meeting'
        };
        onTranscriptUpdate(transcript);
      }
      
      return newSegments;
    });
    
    setCurrentText('');
    setConfidence(result.confidence);
    
    // Auto-scroll to bottom if enabled
    if (autoScrollRef.current && transcriptRef.current) {
      setTimeout(() => {
        transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
      }, 100);
    }
  }, [isPaused, onTranscriptUpdate]);

  // Handle partial transcription results (streaming)
  const handlePartialResult = useCallback((result) => {
    if (isPaused) return;
    
    setCurrentText(result.text || '');
    setConfidence(result.confidence || 0);
  }, [isPaused]);

  // Handle transcription errors
  const handleTranscriptionError = useCallback((error) => {
    console.error('Transcription error:', error);
    
    const errorSegment = {
      id: `error_${Date.now()}`,
      text: `[Error: ${error.error || error.message}]`,
      confidence: 0,
      timestamp: Date.now(),
      provider: error.provider,
      isError: true
    };
    
    setTranscriptionSegments(prev => [...prev, errorSegment]);
  }, []);

  // Handle low confidence results
  const handleLowConfidenceResult = useCallback((result) => {
    const segment = {
      id: result.id,
      text: result.text,
      confidence: result.confidence,
      timestamp: result.timestamp,
      provider: result.provider,
      isLowConfidence: true,
      warning: result.warning
    };
    
    setTranscriptionSegments(prev => [...prev, segment]);
  }, []);

  // Handle processing status changes
  const handleProcessingStatusChange = useCallback((status) => {
    setIsProcessing(status.isProcessing);
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (!transcriptionEngine || !isActive) return;

    transcriptionEngine.addEventListener('transcriptionResult', handleTranscriptionResult);
    transcriptionEngine.addEventListener('partialResult', handlePartialResult);
    transcriptionEngine.addEventListener('transcriptionError', handleTranscriptionError);
    transcriptionEngine.addEventListener('lowConfidenceResult', handleLowConfidenceResult);
    transcriptionEngine.addEventListener('processingStatusChanged', handleProcessingStatusChange);

    return () => {
      transcriptionEngine.removeEventListener('transcriptionResult', handleTranscriptionResult);
      transcriptionEngine.removeEventListener('partialResult', handlePartialResult);
      transcriptionEngine.removeEventListener('transcriptionError', handleTranscriptionError);
      transcriptionEngine.removeEventListener('lowConfidenceResult', handleLowConfidenceResult);
      transcriptionEngine.removeEventListener('processingStatusChanged', handleProcessingStatusChange);
    };
  }, [
    transcriptionEngine, 
    isActive, 
    handleTranscriptionResult, 
    handlePartialResult, 
    handleTranscriptionError,
    handleLowConfidenceResult,
    handleProcessingStatusChange
  ]);

  // Pause transcription
  const handlePause = useCallback(() => {
    setIsPaused(true);
    if (onPause) onPause();
  }, [onPause]);

  // Resume transcription
  const handleResume = useCallback(() => {
    setIsPaused(false);
    if (onResume) onResume();
  }, [onResume]);

  // Clear transcription
  const handleClear = useCallback(() => {
    // Save current segments to history before clearing
    if (transcriptionSegments.length > 0) {
      const historyEntry = {
        id: `history_${Date.now()}`,
        timestamp: Date.now(),
        segments: [...transcriptionSegments],
        totalText: transcriptionSegments.map(s => s.text).join(' ')
      };
      setHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10 entries
    }
    
    setTranscriptionSegments([]);
    setCurrentText('');
    setConfidence(0);
    
    if (onClear) onClear();
  }, [transcriptionSegments, onClear]);

  // Edit segment
  const handleEditSegment = useCallback((segmentId, newText) => {
    setTranscriptionSegments(prev => 
      prev.map(segment => 
        segment.id === segmentId 
          ? { ...segment, text: newText, isEdited: true }
          : segment
      )
    );
    setEditingSegment(null);
  }, []);

  // Delete segment
  const handleDeleteSegment = useCallback((segmentId) => {
    setTranscriptionSegments(prev => prev.filter(segment => segment.id !== segmentId));
  }, []);

  // Toggle auto-scroll
  const toggleAutoScroll = useCallback(() => {
    autoScrollRef.current = !autoScrollRef.current;
  }, []);

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Get full transcript text
  const getFullTranscript = () => {
    return transcriptionSegments
      .filter(segment => !segment.isError)
      .map(segment => segment.text)
      .join(' ');
  };

  if (!isActive) {
    return (
      <div className="real-time-transcription inactive">
        <div className="inactive-message">
          <span className="icon">💬</span>
          <p>Start transcription to see real-time text</p>
        </div>
      </div>
    );
  }

  return (
    <div className="real-time-transcription">
      <div className="transcription-header">
        <div className="header-left">
          <h3>Live Transcription</h3>
          <div className="status-indicators">
            {isPaused ? (
              <span className="status paused">⏸️ Paused</span>
            ) : (
              <span className="status active">🔴 Live</span>
            )}
            {isProcessing && (
              <span className="status processing">⚡ Processing</span>
            )}
          </div>
        </div>
        
        <div className="header-controls">
          <button
            className="control-btn"
            onClick={isPaused ? handleResume : handlePause}
            title={isPaused ? 'Resume transcription' : 'Pause transcription'}
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>
          
          <button
            className="control-btn"
            onClick={handleClear}
            title="Clear transcription"
          >
            🗑️
          </button>
          
          <button
            className="control-btn"
            onClick={() => setShowHistory(!showHistory)}
            title="Show history"
          >
            📚
          </button>
          
          <button
            className="control-btn"
            onClick={toggleAutoScroll}
            title={`${autoScrollRef.current ? 'Disable' : 'Enable'} auto-scroll`}
          >
            {autoScrollRef.current ? '📜' : '📋'}
          </button>
        </div>
      </div>

      <div className="transcription-content">
        <div 
          className="transcript-display"
          ref={transcriptRef}
        >
          {transcriptionSegments.length === 0 && !currentText ? (
            <div className="empty-state">
              <span className="icon">🎤</span>
              <p>Listening for speech...</p>
            </div>
          ) : (
            <>
              {transcriptionSegments.map((segment) => (
                <div 
                  key={segment.id} 
                  className={`transcript-segment ${segment.isError ? 'error' : ''} ${segment.isLowConfidence ? 'low-confidence' : ''}`}
                >
                  <div className="segment-header">
                    <span className="timestamp">
                      {formatTimestamp(segment.timestamp)}
                    </span>
                    <span className={`confidence ${getConfidenceColor(segment.confidence)}`}>
                      {segment.isError ? 'Error' : `${Math.round(segment.confidence * 100)}%`}
                    </span>
                    <span className="provider">
                      {segment.provider}
                    </span>
                    {segment.isEdited && (
                      <span className="edited-badge">✏️ Edited</span>
                    )}
                    <div className="segment-actions">
                      <button
                        className="action-btn edit"
                        onClick={() => setEditingSegment(segment.id)}
                        title="Edit segment"
                      >
                        ✏️
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteSegment(segment.id)}
                        title="Delete segment"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  
                  {editingSegment === segment.id ? (
                    <div className="segment-editor">
                      <textarea
                        defaultValue={segment.text}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            handleEditSegment(segment.id, e.target.value);
                          } else if (e.key === 'Escape') {
                            setEditingSegment(null);
                          }
                        }}
                        placeholder="Edit transcription text..."
                        autoFocus
                      />
                      <div className="editor-actions">
                        <button
                          onClick={(e) => {
                            const textarea = e.target.parentElement.previousElementSibling;
                            handleEditSegment(segment.id, textarea.value);
                          }}
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingSegment(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="segment-text">
                      {segment.text}
                    </div>
                  )}
                  
                  {segment.warning && (
                    <div className="segment-warning">
                      ⚠️ {segment.warning}
                    </div>
                  )}
                </div>
              ))}
              
              {currentText && (
                <div className="transcript-segment current">
                  <div className="segment-header">
                    <span className="timestamp">
                      {formatTimestamp(Date.now())}
                    </span>
                    <span className={`confidence ${getConfidenceColor(confidence)}`}>
                      {Math.round(confidence * 100)}%
                    </span>
                    <span className="status">Processing...</span>
                  </div>
                  <div className="segment-text current-text">
                    {currentText}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {showHistory && (
          <div className="transcription-history">
            <div className="history-header">
              <h4>Transcription History</h4>
              <button
                className="close-btn"
                onClick={() => setShowHistory(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="history-list">
              {history.length === 0 ? (
                <div className="empty-history">
                  <p>No previous transcriptions</p>
                </div>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className="history-entry">
                    <div className="history-header">
                      <span className="history-timestamp">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      <span className="history-segments">
                        {entry.segments.length} segments
                      </span>
                    </div>
                    <div className="history-preview">
                      {entry.totalText.substring(0, 100)}
                      {entry.totalText.length > 100 && '...'}
                    </div>
                    <div className="history-actions">
                      <button
                        onClick={() => {
                          setTranscriptionSegments(entry.segments);
                          setShowHistory(false);
                        }}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="transcription-footer">
        <div className="stats">
          <span>Segments: {transcriptionSegments.length}</span>
          <span>Words: {getFullTranscript().split(' ').filter(w => w.length > 0).length}</span>
          <span>Avg Confidence: {
            transcriptionSegments.length > 0 
              ? Math.round(transcriptionSegments.reduce((sum, s) => sum + (s.confidence || 0), 0) / transcriptionSegments.length * 100)
              : 0
          }%</span>
        </div>
        
        <div className="export-actions">
          <button
            className="export-btn"
            onClick={() => {
              const text = getFullTranscript();
              navigator.clipboard.writeText(text);
            }}
            title="Copy to clipboard"
          >
            📋 Copy
          </button>
          
          <button
            className="export-btn"
            onClick={() => {
              const text = getFullTranscript();
              const blob = new Blob([text], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `transcript_${new Date().toISOString().split('T')[0]}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            title="Download as text file"
          >
            💾 Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default RealTimeTranscription;
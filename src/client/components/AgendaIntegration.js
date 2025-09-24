/**
 * Agenda Integration Component
 * Displays meeting agenda, tracks progress, and provides agenda-based filtering
 */

import React, { useState, useEffect, useCallback } from 'react';
import AgendaService from '../services/AgendaService';
import './AgendaIntegration.css';

const AgendaIntegration = ({ 
  meetingInfo, 
  transcriptionText, 
  onAgendaUpdate,
  onContentFilter 
}) => {
  const [agendaService] = useState(() => new AgendaService());
  const [agenda, setAgenda] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState(null);
  const [matchedTopics, setMatchedTopics] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

  /**
   * Load meeting agenda when meeting info changes
   */
  useEffect(() => {
    if (meetingInfo?.id) {
      loadAgenda(meetingInfo.id);
    }
  }, [meetingInfo]);

  /**
   * Track agenda progress when transcription changes
   */
  useEffect(() => {
    if (transcriptionText && agenda) {
      trackProgress(transcriptionText);
    }
  }, [transcriptionText, agenda]);

  /**
   * Load meeting agenda
   */
  const loadAgenda = async (meetingId) => {
    setLoading(true);
    setError(null);
    
    try {
      const fetchedAgenda = await agendaService.fetchMeetingAgenda(meetingId);
      setAgenda(fetchedAgenda);
      
      if (onAgendaUpdate) {
        onAgendaUpdate(fetchedAgenda);
      }
      
      console.log('Agenda loaded:', fetchedAgenda);
    } catch (err) {
      setError(`Failed to load agenda: ${err.message}`);
      console.error('Error loading agenda:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Track agenda progress based on transcription
   */
  const trackProgress = useCallback((text) => {
    try {
      const tracking = agendaService.trackAgendaProgress(text);
      setProgress(tracking.progress);
      setCurrentItem(tracking.currentItem);
      setMatchedTopics(tracking.matchedTopics);

      // Apply content filtering
      if (onContentFilter) {
        const filterResult = agendaService.filterContentByAgenda(text);
        onContentFilter(filterResult);
      }
    } catch (err) {
      console.error('Error tracking agenda progress:', err);
    }
  }, [agendaService, onContentFilter]);

  /**
   * Refresh agenda
   */
  const refreshAgenda = () => {
    if (meetingInfo?.id) {
      loadAgenda(meetingInfo.id);
    }
  };

  /**
   * Reset agenda tracking
   */
  const resetTracking = () => {
    agendaService.resetTracking();
    setProgress(0);
    setCurrentItem(null);
    setMatchedTopics([]);
  };

  /**
   * Get agenda summary prompt
   */
  const getAgendaSummaryPrompt = () => {
    return agendaService.generateAgendaSummaryPrompt();
  };

  if (loading) {
    return (
      <div className="agenda-integration loading">
        <div className="loading-spinner"></div>
        <span>Loading meeting agenda...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="agenda-integration error">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
        <button onClick={refreshAgenda} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (!agenda) {
    return (
      <div className="agenda-integration empty">
        <span>No agenda available</span>
        <button onClick={refreshAgenda} className="refresh-button">
          Check for Agenda
        </button>
      </div>
    );
  }

  return (
    <div className="agenda-integration">
      <div className="agenda-header">
        <div className="agenda-title">
          <h3>{agenda.title}</h3>
          {agenda.isFallback && (
            <span className="fallback-indicator">No agenda found</span>
          )}
        </div>
        
        <div className="agenda-controls">
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="toggle-details"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          <button onClick={refreshAgenda} className="refresh-button">
            🔄
          </button>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="agenda-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <span className="progress-text">{progress}% Complete</span>
      </div>

      {/* Current Item Indicator */}
      {currentItem && (
        <div className="current-item">
          <span className="current-label">Currently Discussing:</span>
          <span className="current-title">{currentItem.title}</span>
        </div>
      )}

      {/* Matched Topics */}
      {matchedTopics.length > 0 && (
        <div className="matched-topics">
          <span className="topics-label">Active Topics:</span>
          <div className="topics-list">
            {matchedTopics.map((topic, index) => (
              <span key={index} className="topic-tag">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agenda Details */}
      {showDetails && (
        <div className="agenda-details">
          <div className="agenda-items">
            {agenda.items.map((item, index) => {
              const isTracked = agendaService.getTrackedItems().has(item.id);
              const isCurrent = currentItem?.id === item.id;
              
              return (
                <div 
                  key={item.id} 
                  className={`agenda-item ${isTracked ? 'tracked' : ''} ${isCurrent ? 'current' : ''}`}
                >
                  <div className="item-header">
                    <span className="item-number">{index + 1}</span>
                    <span className="item-title">{item.title}</span>
                    <span className="item-status">
                      {isCurrent ? '🔄' : isTracked ? '✅' : '⏳'}
                    </span>
                  </div>
                  
                  {item.description && (
                    <div className="item-description">{item.description}</div>
                  )}
                  
                  <div className="item-meta">
                    {item.estimatedDuration && (
                      <span className="duration">
                        ⏱️ {item.estimatedDuration} min
                      </span>
                    )}
                    {item.timeSlot && (
                      <span className="time-slot">
                        🕐 {item.timeSlot}
                      </span>
                    )}
                  </div>
                  
                  {item.keywords.length > 0 && (
                    <div className="item-keywords">
                      {item.keywords.map((keyword, idx) => (
                        <span key={idx} className="keyword-tag">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda Actions */}
      <div className="agenda-actions">
        <button onClick={resetTracking} className="reset-button">
          Reset Tracking
        </button>
        <button 
          onClick={() => {
            const prompt = getAgendaSummaryPrompt();
            navigator.clipboard.writeText(prompt);
            alert('Agenda summary prompt copied to clipboard!');
          }}
          className="copy-prompt-button"
        >
          Copy Summary Prompt
        </button>
      </div>
    </div>
  );
};

export default AgendaIntegration;
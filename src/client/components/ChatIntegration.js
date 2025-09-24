import React, { useState, useCallback, useEffect } from 'react';
import TeamsChatService from '../services/TeamsChatService.js';
import './ChatIntegration.css';

/**
 * Chat Integration Component - Handles sending transcripts and summaries to Teams chat
 */
const ChatIntegration = ({ 
  teamsAdapter, 
  transcript, 
  summary, 
  onChatSent, 
  onError 
}) => {
  const [chatService] = useState(() => new TeamsChatService());
  const [permissions, setPermissions] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState([]);

  // Initialize chat service when Teams adapter is available
  useEffect(() => {
    if (teamsAdapter) {
      chatService.setTeamsAdapter(teamsAdapter);
      checkPermissions();
    }
  }, [teamsAdapter, chatService]);

  // Check chat permissions
  const checkPermissions = useCallback(async () => {
    try {
      const permissionResult = await chatService.checkChatPermissions();
      setPermissions(permissionResult);
      
      if (!permissionResult.hasPermission) {
        console.log('Chat permissions not available:', permissionResult.error);
      }
    } catch (error) {
      console.error('Error checking chat permissions:', error);
      setPermissions({
        hasPermission: false,
        error: error.message
      });
    }
  }, [chatService]);

  // Send transcript to chat
  const handleSendTranscript = useCallback(async () => {
    if (!transcript || isSending) return;

    setIsSending(true);
    setSendStatus(null);
    setShowAlternatives(false);

    try {
      const result = await chatService.sendTranscriptToChat(transcript, {
        includeTimestamps: false,
        includeSpeakerLabels: true,
        includeHeader: true,
        includeFooter: true
      });

      if (result.success) {
        setSendStatus({
          type: 'success',
          message: `Transcript sent successfully (${result.messagesSent} messages)`
        });
        
        if (onChatSent) {
          onChatSent({ type: 'transcript', result });
        }
      } else {
        setSendStatus({
          type: 'error',
          message: result.error
        });
        
        // Show alternative delivery methods
        if (result.alternativeMethod) {
          setAlternatives(result.alternativeMethod.alternatives);
          setShowAlternatives(true);
        }
        
        if (onError) {
          onError(new Error(result.error));
        }
      }
    } catch (error) {
      console.error('Error sending transcript:', error);
      setSendStatus({
        type: 'error',
        message: error.message
      });
      
      if (onError) {
        onError(error);
      }
    } finally {
      setIsSending(false);
    }
  }, [transcript, isSending, chatService, onChatSent, onError]);

  // Send summary to chat
  const handleSendSummary = useCallback(async () => {
    if (!summary || isSending) return;

    setIsSending(true);
    setSendStatus(null);
    setShowAlternatives(false);

    try {
      const result = await chatService.sendSummaryToChat(summary, {
        includeMetadata: true,
        includeAgendaItems: true,
        includeActionItems: true,
        includeDecisions: true
      });

      if (result.success) {
        setSendStatus({
          type: 'success',
          message: `Summary sent successfully (${result.messagesSent} messages)`
        });
        
        if (onChatSent) {
          onChatSent({ type: 'summary', result });
        }
      } else {
        setSendStatus({
          type: 'error',
          message: result.error
        });
        
        // Show alternative delivery methods
        if (result.alternativeMethod) {
          setAlternatives(result.alternativeMethod.alternatives);
          setShowAlternatives(true);
        }
        
        if (onError) {
          onError(new Error(result.error));
        }
      }
    } catch (error) {
      console.error('Error sending summary:', error);
      setSendStatus({
        type: 'error',
        message: error.message
      });
      
      if (onError) {
        onError(error);
      }
    } finally {
      setIsSending(false);
    }
  }, [summary, isSending, chatService, onChatSent, onError]);

  // Handle alternative delivery method
  const handleAlternativeMethod = useCallback(async (alternative) => {
    try {
      setIsSending(true);
      const result = await alternative.action();
      
      if (result.success) {
        setSendStatus({
          type: 'success',
          message: `Content delivered via ${alternative.method}`
        });
        setShowAlternatives(false);
      } else {
        setSendStatus({
          type: 'error',
          message: `Failed to deliver via ${alternative.method}: ${result.error}`
        });
      }
    } catch (error) {
      console.error('Error with alternative delivery:', error);
      setSendStatus({
        type: 'error',
        message: `Alternative delivery failed: ${error.message}`
      });
    } finally {
      setIsSending(false);
    }
  }, []);

  // Clear status message
  const clearStatus = useCallback(() => {
    setSendStatus(null);
    setShowAlternatives(false);
  }, []);

  // Refresh permissions
  const refreshPermissions = useCallback(() => {
    checkPermissions();
  }, [checkPermissions]);

  if (!teamsAdapter) {
    return (
      <div className="chat-integration">
        <div className="chat-status">
          <span className="status-icon">⏳</span>
          <span>Waiting for Teams connection...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-integration">
      <div className="chat-header">
        <h3>📤 Send to Teams Chat</h3>
        <button 
          className="refresh-button"
          onClick={refreshPermissions}
          title="Refresh permissions"
        >
          🔄
        </button>
      </div>

      {/* Permission Status */}
      {permissions && (
        <div className={`permission-status ${permissions.hasPermission ? 'granted' : 'denied'}`}>
          {permissions.hasPermission ? (
            <div className="permission-granted">
              <span className="status-icon">✅</span>
              <span>Chat integration available</span>
            </div>
          ) : (
            <div className="permission-denied">
              <span className="status-icon">❌</span>
              <span>{permissions.error || 'Permission denied'}</span>
            </div>
          )}
        </div>
      )}

      {/* Send Status */}
      {sendStatus && (
        <div className={`send-status ${sendStatus.type}`}>
          <span className="status-icon">
            {sendStatus.type === 'success' ? '✅' : '⚠️'}
          </span>
          <span className="status-message">{sendStatus.message}</span>
          <button className="status-close" onClick={clearStatus}>×</button>
        </div>
      )}

      {/* Send Buttons */}
      <div className="send-buttons">
        <button
          className="send-transcript-button"
          onClick={handleSendTranscript}
          disabled={!transcript || isSending || !permissions?.hasPermission}
          title={!permissions?.hasPermission ? (permissions?.error || 'Permission required') : 'Send transcript to chat'}
        >
          {isSending ? (
            <>
              <span className="spinner">⏳</span>
              Sending...
            </>
          ) : (
            <>
              📝 Send Transcript
            </>
          )}
        </button>

        <button
          className="send-summary-button"
          onClick={handleSendSummary}
          disabled={!summary || isSending || !permissions?.hasPermission}
          title={!permissions?.hasPermission ? (permissions?.error || 'Permission required') : 'Send summary to chat'}
        >
          {isSending ? (
            <>
              <span className="spinner">⏳</span>
              Sending...
            </>
          ) : (
            <>
              🎯 Send Summary
            </>
          )}
        </button>
      </div>

      {/* Content Preview */}
      {(transcript || summary) && (
        <div className="content-preview">
          <details>
            <summary>Preview content to be sent</summary>
            <div className="preview-content">
              {transcript && (
                <div className="transcript-preview">
                  <h4>Transcript Preview:</h4>
                  <div className="preview-text">
                    {chatService.formatTranscriptForChat(transcript).substring(0, 500)}...
                  </div>
                </div>
              )}
              {summary && (
                <div className="summary-preview">
                  <h4>Summary Preview:</h4>
                  <div className="preview-text">
                    {chatService.formatSummaryForChat(summary).substring(0, 500)}...
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {/* Alternative Delivery Methods */}
      {showAlternatives && alternatives.length > 0 && (
        <div className="alternative-methods">
          <h4>Alternative Delivery Methods</h4>
          <p className="alternative-description">
            Teams chat is not available. Choose an alternative way to share the content:
          </p>
          <div className="alternative-buttons">
            {alternatives.map((alternative, index) => (
              <button
                key={index}
                className="alternative-button"
                onClick={() => handleAlternativeMethod(alternative)}
                disabled={isSending}
                title={alternative.description}
              >
                {alternative.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Debug Information */}
      {process.env.NODE_ENV === 'development' && permissions && (
        <details className="debug-info">
          <summary>Debug: Chat Integration Status</summary>
          <div className="debug-content">
            <div><strong>Has Permission:</strong> {permissions.hasPermission ? 'Yes' : 'No'}</div>
            <div><strong>Error:</strong> {permissions.error || 'None'}</div>
            <div><strong>Meeting ID:</strong> {permissions.meetingId || 'N/A'}</div>
            <div><strong>Capabilities:</strong></div>
            <ul>
              {permissions.capabilities && Object.entries(permissions.capabilities).map(([key, value]) => (
                <li key={key}>{key}: {String(value)}</li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
};

export default ChatIntegration;
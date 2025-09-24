/**
 * Example component showing how to integrate agenda functionality
 * This demonstrates the complete workflow of agenda integration
 */

import React, { useState, useCallback } from 'react';
import AgendaIntegration from './AgendaIntegration';
import MeetingController from './MeetingController';

const AgendaExample = () => {
  const [currentAgenda, setCurrentAgenda] = useState(null);
  const [contentFilter, setContentFilter] = useState(null);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [meetingController, setMeetingController] = useState(null);

  // Handle agenda updates from the integration component
  const handleAgendaUpdate = useCallback((agenda) => {
    setCurrentAgenda(agenda);
    console.log('Agenda updated:', agenda);
  }, []);

  // Handle content filtering results
  const handleContentFilter = useCallback((filterResult) => {
    setContentFilter(filterResult);
    console.log('Content filter result:', filterResult);
    
    // Show relevance feedback to user
    if (filterResult.relevanceScore < 0.3 && filterResult.suggestedFocus) {
      console.log(`Low relevance detected. Suggested focus: ${filterResult.suggestedFocus.title}`);
    }
  }, []);

  // Handle meeting state changes
  const handleMeetingStateChange = useCallback((event) => {
    console.log('Meeting state changed:', event);
  }, []);

  // Handle errors
  const handleError = useCallback((error) => {
    console.error('Meeting controller error:', error);
  }, []);

  // Simulate transcription text for demo
  const simulateTranscription = (text) => {
    setTranscriptionText(text);
  };

  // Example meeting info (would come from Teams adapter in real usage)
  const mockMeetingInfo = {
    id: 'example-meeting-123',
    title: 'Weekly Team Meeting',
    platform: 'teams',
    startTime: new Date(),
    participants: [
      { id: '1', name: 'John Doe', role: 'host' },
      { id: '2', name: 'Jane Smith', role: 'participant' }
    ]
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Agenda Integration Example</h1>
      
      {/* Meeting Controller Integration */}
      <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Meeting Controller</h2>
        <p>This would normally be initialized automatically when joining a Teams meeting.</p>
        <button 
          onClick={() => {
            // In real usage, this would be handled by MeetingController
            console.log('Meeting controller would be initialized here');
          }}
          style={{ padding: '8px 16px', marginRight: '8px' }}
        >
          Initialize Meeting Controller
        </button>
      </div>

      {/* Agenda Integration Component */}
      <div style={{ marginBottom: '20px' }}>
        <h2>Meeting Agenda</h2>
        <AgendaIntegration
          meetingInfo={mockMeetingInfo}
          transcriptionText={transcriptionText}
          onAgendaUpdate={handleAgendaUpdate}
          onContentFilter={handleContentFilter}
        />
      </div>

      {/* Transcription Simulation */}
      <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Transcription Simulation</h2>
        <p>Click buttons to simulate different discussion topics:</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => simulateTranscription('Let\'s start with the project update and current status')}
            style={{ padding: '8px 12px' }}
          >
            Project Discussion
          </button>
          <button 
            onClick={() => simulateTranscription('Now let\'s review the budget and financial planning')}
            style={{ padding: '8px 12px' }}
          >
            Budget Discussion
          </button>
          <button 
            onClick={() => simulateTranscription('How was everyone\'s weekend? Nice weather today.')}
            style={{ padding: '8px 12px' }}
          >
            Off-topic Chat
          </button>
          <button 
            onClick={() => simulateTranscription('What are the next steps and action items?')}
            style={{ padding: '8px 12px' }}
          >
            Next Steps
          </button>
        </div>
        
        {transcriptionText && (
          <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <strong>Current Transcription:</strong> {transcriptionText}
          </div>
        )}
      </div>

      {/* Content Filter Results */}
      {contentFilter && (
        <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h2>Content Relevance Analysis</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <strong>Relevance Score:</strong> {(contentFilter.relevanceScore * 100).toFixed(1)}%
            </div>
            <div>
              <strong>Is Relevant:</strong> {contentFilter.isRelevant ? '✅ Yes' : '❌ No'}
            </div>
            <div>
              <strong>Matched Topics:</strong> {contentFilter.matchedTopics.join(', ') || 'None'}
            </div>
            <div>
              <strong>Suggested Focus:</strong> {contentFilter.suggestedFocus?.title || 'None'}
            </div>
          </div>
        </div>
      )}

      {/* Current Agenda Display */}
      {currentAgenda && (
        <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h2>Current Agenda Summary</h2>
          <div>
            <strong>Title:</strong> {currentAgenda.title}
          </div>
          <div>
            <strong>Items:</strong> {currentAgenda.items.length}
          </div>
          <div>
            <strong>Type:</strong> {currentAgenda.isFallback ? 'Fallback (No agenda found)' : 'Parsed from meeting'}
          </div>
          
          {currentAgenda.items.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <strong>Agenda Items:</strong>
              <ul>
                {currentAgenda.items.map((item, index) => (
                  <li key={item.id}>
                    {item.title} ({item.estimatedDuration} min)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Usage Instructions */}
      <div style={{ padding: '16px', backgroundColor: '#f0f8ff', borderRadius: '8px' }}>
        <h2>How It Works</h2>
        <ol>
          <li><strong>Agenda Loading:</strong> When a meeting starts, the system attempts to fetch the agenda from Microsoft Graph API</li>
          <li><strong>Content Tracking:</strong> As transcription occurs, the system tracks which agenda items are being discussed</li>
          <li><strong>Relevance Filtering:</strong> Content is analyzed for relevance to the agenda topics</li>
          <li><strong>Progress Monitoring:</strong> The system shows progress through agenda items and suggests focus when discussions go off-topic</li>
          <li><strong>Summary Generation:</strong> At meeting end, an agenda-focused summary is generated using the tracked information</li>
        </ol>
        
        <h3>Integration Points</h3>
        <ul>
          <li><strong>Teams Adapter:</strong> Fetches meeting metadata and agenda via Graph API</li>
          <li><strong>Transcription Engine:</strong> Provides real-time text for agenda tracking</li>
          <li><strong>Summary Engine:</strong> Uses agenda context to generate focused summaries</li>
          <li><strong>UI Components:</strong> Display agenda progress and relevance feedback</li>
        </ul>
      </div>
    </div>
  );
};

export default AgendaExample;
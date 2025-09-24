import React, { useState } from 'react';
import './SummaryDisplay.css';

/**
 * Summary Display Component - Displays AI-generated meeting summaries
 * Shows structured summary with sections for key points, decisions, action items, etc.
 */
const SummaryDisplay = ({ 
  summary, 
  isGenerating, 
  onRegenerateSummary, 
  onExportSummary,
  onSendToChat 
}) => {
  const [expandedSections, setExpandedSections] = useState(new Set(['keyPoints']));
  const [copyStatus, setCopyStatus] = useState('');

  /**
   * Toggle section expansion
   */
  const toggleSection = (sectionName) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName);
    } else {
      newExpanded.add(sectionName);
    }
    setExpandedSections(newExpanded);
  };

  /**
   * Copy summary to clipboard
   */
  const handleCopyToClipboard = async () => {
    try {
      const summaryText = formatSummaryForCopy(summary);
      await navigator.clipboard.writeText(summaryText);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setCopyStatus('Copy failed');
      setTimeout(() => setCopyStatus(''), 2000);
    }
  };

  /**
   * Format summary for copying/exporting
   */
  const formatSummaryForCopy = (summary) => {
    let text = `Meeting Summary\n`;
    text += `Generated: ${new Date(summary.metadata?.generatedAt).toLocaleString()}\n`;
    text += `Duration: ${summary.metadata?.meetingDuration || 'Unknown'} minutes\n\n`;

    if (summary.keyPoints?.length > 0) {
      text += `KEY DISCUSSION POINTS:\n`;
      summary.keyPoints.forEach((point, index) => {
        text += `${index + 1}. ${point}\n`;
      });
      text += '\n';
    }

    if (summary.decisions?.length > 0) {
      text += `DECISIONS MADE:\n`;
      summary.decisions.forEach((decision, index) => {
        text += `${index + 1}. ${decision}\n`;
      });
      text += '\n';
    }

    if (summary.actionItems?.length > 0) {
      text += `ACTION ITEMS:\n`;
      summary.actionItems.forEach((item, index) => {
        text += `${index + 1}. ${item.task}`;
        if (item.assignee) text += ` (${item.assignee})`;
        if (item.dueDate) text += ` - Due: ${item.dueDate}`;
        text += '\n';
      });
      text += '\n';
    }

    if (summary.nextSteps?.length > 0) {
      text += `NEXT STEPS:\n`;
      summary.nextSteps.forEach((step, index) => {
        text += `${index + 1}. ${step}\n`;
      });
      text += '\n';
    }

    if (summary.agendaItems?.length > 0) {
      text += `AGENDA ITEMS STATUS:\n`;
      summary.agendaItems.forEach((item) => {
        text += `• ${item.title}: ${item.status === 'completed' ? 'Discussed' : 'Not Discussed'}\n`;
        if (item.summary) {
          text += `  ${item.summary}\n`;
        }
      });
    }

    return text;
  };

  /**
   * Render section with expand/collapse
   */
  const renderSection = (title, items, sectionKey, renderItem = (item) => item) => {
    if (!items || items.length === 0) return null;

    const isExpanded = expandedSections.has(sectionKey);

    return (
      <div className="summary-section">
        <div 
          className="section-header"
          onClick={() => toggleSection(sectionKey)}
        >
          <h4>{title}</h4>
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>
        
        {isExpanded && (
          <div className="section-content">
            <ul className="summary-list">
              {items.map((item, index) => (
                <li key={index} className="summary-item">
                  {renderItem(item, index)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  /**
   * Render action item with metadata
   */
  const renderActionItem = (item) => {
    return (
      <div className="action-item">
        <div className="action-task">{item.task || item}</div>
        {(item.assignee || item.dueDate || item.priority) && (
          <div className="action-metadata">
            {item.assignee && (
              <span className="action-assignee">👤 {item.assignee}</span>
            )}
            {item.dueDate && (
              <span className="action-due-date">📅 {item.dueDate}</span>
            )}
            {item.priority && item.priority !== 'normal' && (
              <span className={`action-priority priority-${item.priority}`}>
                {item.priority === 'high' ? '🔴' : '🟡'} {item.priority}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  /**
   * Render agenda item status
   */
  const renderAgendaItem = (item) => {
    return (
      <div className="agenda-item">
        <div className="agenda-title">
          <span className={`status-indicator ${item.status}`}>
            {item.status === 'completed' ? '✅' : '⏸️'}
          </span>
          {item.title}
        </div>
        {item.summary && (
          <div className="agenda-summary">{item.summary}</div>
        )}
      </div>
    );
  };

  if (isGenerating) {
    return (
      <div className="summary-display generating">
        <div className="generating-content">
          <div className="spinner"></div>
          <h3>Generating Summary...</h3>
          <p>AI is analyzing the meeting transcript and creating your summary.</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="summary-display empty">
        <div className="empty-content">
          <h3>No Summary Available</h3>
          <p>Generate a summary after the meeting ends to see AI-powered insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="summary-display">
      <div className="summary-header">
        <div className="summary-title">
          <h3>Meeting Summary</h3>
          {summary.metadata && (
            <div className="summary-metadata">
              <span>Generated: {new Date(summary.metadata.generatedAt).toLocaleString()}</span>
              <span>Provider: {summary.metadata.provider}</span>
              {summary.metadata.meetingDuration && (
                <span>Duration: {summary.metadata.meetingDuration} min</span>
              )}
            </div>
          )}
        </div>

        <div className="summary-actions">
          <button 
            onClick={handleCopyToClipboard}
            className="action-button copy-button"
            title="Copy to clipboard"
          >
            📋 {copyStatus || 'Copy'}
          </button>
          
          {onExportSummary && (
            <button 
              onClick={() => onExportSummary(summary)}
              className="action-button export-button"
              title="Export summary"
            >
              📄 Export
            </button>
          )}
          
          {onSendToChat && (
            <button 
              onClick={() => onSendToChat(summary)}
              className="action-button chat-button"
              title="Send to chat"
            >
              💬 Send to Chat
            </button>
          )}
          
          {onRegenerateSummary && (
            <button 
              onClick={onRegenerateSummary}
              className="action-button regenerate-button"
              title="Regenerate summary"
            >
              🔄 Regenerate
            </button>
          )}
        </div>
      </div>

      <div className="summary-content">
        {/* Participants */}
        {summary.participants && summary.participants.length > 0 && (
          <div className="participants-section">
            <h4>Participants</h4>
            <div className="participants-list">
              {summary.participants.map((participant, index) => (
                <span key={index} className="participant-tag">
                  {participant}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Key Points */}
        {renderSection(
          'Key Discussion Points', 
          summary.keyPoints, 
          'keyPoints'
        )}

        {/* Decisions */}
        {renderSection(
          'Decisions Made', 
          summary.decisions, 
          'decisions'
        )}

        {/* Action Items */}
        {renderSection(
          'Action Items', 
          summary.actionItems, 
          'actionItems',
          renderActionItem
        )}

        {/* Next Steps */}
        {renderSection(
          'Next Steps', 
          summary.nextSteps, 
          'nextSteps'
        )}

        {/* Agenda Items Status */}
        {renderSection(
          'Agenda Items Status', 
          summary.agendaItems, 
          'agendaItems',
          renderAgendaItem
        )}

        {/* Raw Summary (fallback) */}
        {summary.rawSummary && (!summary.keyPoints?.length && !summary.decisions?.length) && (
          <div className="summary-section">
            <div className="section-header">
              <h4>Summary</h4>
            </div>
            <div className="section-content">
              <div className="raw-summary">
                {summary.rawSummary.split('\n').map((paragraph, index) => (
                  paragraph.trim() && <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryDisplay;
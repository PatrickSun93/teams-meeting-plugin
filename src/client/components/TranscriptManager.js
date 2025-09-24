/**
 * TranscriptManager - React component for managing stored transcripts
 * Provides UI for viewing, searching, exporting, and sharing transcripts
 */

import React, { useState, useEffect, useCallback } from 'react';
import TranscriptStorageService from '../services/TranscriptStorageService';
import TranscriptExportService from '../services/TranscriptExportService';
import TranscriptSharingService from '../services/TranscriptSharingService';
import './TranscriptManager.css';

const TranscriptManager = () => {
  const [storageService] = useState(() => new TranscriptStorageService());
  const [exportService] = useState(() => new TranscriptExportService());
  const [sharingService] = useState(() => new TranscriptSharingService(storageService));
  
  const [transcripts, setTranscripts] = useState([]);
  const [filteredTranscripts, setFilteredTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTranscripts, setSelectedTranscripts] = useState(new Set());
  const [storageStats, setStorageStats] = useState(null);
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  
  // Filter state
  const [filters, setFilters] = useState({
    platform: '',
    dateRange: { start: '', end: '' },
    tags: [],
    encrypted: null
  });

  // Initialize services and load data
  useEffect(() => {
    initializeServices();
  }, []);

  const initializeServices = async () => {
    try {
      setLoading(true);
      await storageService.initialize();
      await sharingService.initialize();
      await loadTranscripts();
      await loadStorageStats();
    } catch (err) {
      setError(`Failed to initialize: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTranscripts = async () => {
    try {
      const allTranscripts = await storageService.getAllTranscripts();
      setTranscripts(allTranscripts);
      setFilteredTranscripts(allTranscripts);
    } catch (err) {
      setError(`Failed to load transcripts: ${err.message}`);
    }
  };

  const loadStorageStats = async () => {
    try {
      const stats = await storageService.getStorageStats();
      setStorageStats(stats);
    } catch (err) {
      console.error('Failed to load storage stats:', err);
    }
  };

  // Search and filter functionality
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredTranscripts(transcripts);
      return;
    }

    try {
      const results = await storageService.searchTranscripts(query, { limit: 100 });
      setFilteredTranscripts(results);
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    }
  }, [transcripts, storageService]);

  const applyFilters = useCallback(() => {
    let filtered = transcripts;

    if (filters.platform) {
      filtered = filtered.filter(t => t.platform === filters.platform);
    }

    if (filters.dateRange.start) {
      const startDate = new Date(filters.dateRange.start);
      filtered = filtered.filter(t => new Date(t.createdAt) >= startDate);
    }

    if (filters.dateRange.end) {
      const endDate = new Date(filters.dateRange.end);
      filtered = filtered.filter(t => new Date(t.createdAt) <= endDate);
    }

    if (filters.tags.length > 0) {
      filtered = filtered.filter(t => 
        filters.tags.some(tag => t.tags && t.tags.includes(tag))
      );
    }

    if (filters.encrypted !== null) {
      filtered = filtered.filter(t => t.encrypted === filters.encrypted);
    }

    setFilteredTranscripts(filtered);
  }, [transcripts, filters]);

  useEffect(() => {
    if (!searchQuery) {
      applyFilters();
    }
  }, [filters, applyFilters, searchQuery]);

  // Selection management
  const toggleTranscriptSelection = (transcriptId) => {
    const newSelection = new Set(selectedTranscripts);
    if (newSelection.has(transcriptId)) {
      newSelection.delete(transcriptId);
    } else {
      newSelection.add(transcriptId);
    }
    setSelectedTranscripts(newSelection);
  };

  const selectAllTranscripts = () => {
    setSelectedTranscripts(new Set(filteredTranscripts.map(t => t.id)));
  };

  const clearSelection = () => {
    setSelectedTranscripts(new Set());
  };

  // Export functionality
  const handleExport = async (format, options = {}) => {
    try {
      const transcriptsToExport = selectedTranscripts.size > 0 
        ? transcripts.filter(t => selectedTranscripts.has(t.id))
        : [selectedTranscript];

      if (transcriptsToExport.length === 1) {
        const result = await exportService.exportTranscript(transcriptsToExport[0], format, options);
        exportService.downloadFile(result);
      } else {
        const results = await exportService.exportBatch(transcriptsToExport, format, options);
        
        // Download successful exports
        results.forEach(result => {
          if (result.success) {
            exportService.downloadFile(result.data);
          }
        });

        // Show summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        alert(`Export complete: ${successful} successful, ${failed} failed`);
      }

      setShowExportModal(false);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    }
  };

  // Share functionality
  const handleShare = async (shareOptions) => {
    try {
      const result = await sharingService.createShare(selectedTranscript.id, shareOptions);
      
      // Copy share URL to clipboard
      await navigator.clipboard.writeText(result.shareUrl);
      
      alert(`Share created! URL copied to clipboard.\nExpires: ${result.expiresAt.toLocaleString()}`);
      setShowShareModal(false);
    } catch (err) {
      setError(`Share failed: ${err.message}`);
    }
  };

  // View functionality
  const handleView = (transcript) => {
    setSelectedTranscript(transcript);
    setShowViewModal(true);
  };

  // Edit functionality
  const handleEdit = (transcript) => {
    setSelectedTranscript(transcript);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (editedTranscript) => {
    try {
      await storageService.updateTranscript(editedTranscript.id, editedTranscript);
      await loadTranscripts();
      setShowEditModal(false);
      setSelectedTranscript(null);
    } catch (err) {
      setError(`Save failed: ${err.message}`);
    }
  };

  // Delete functionality
  const handleDelete = async (transcriptIds) => {
    if (!confirm(`Delete ${transcriptIds.length} transcript(s)? This cannot be undone.`)) {
      return;
    }

    try {
      const results = await storageService.deleteTranscripts(transcriptIds);
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (failed > 0) {
        alert(`Deletion complete: ${successful} successful, ${failed} failed`);
      }

      await loadTranscripts();
      await loadStorageStats();
      clearSelection();
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    }
  };

  // Cleanup functionality
  const handleCleanup = async () => {
    const retentionDays = prompt('Delete transcripts older than how many days?', '90');
    if (!retentionDays) return;

    try {
      const results = await storageService.cleanupOldTranscripts(parseInt(retentionDays));
      alert(`Cleanup complete: ${results.length} old transcripts deleted`);
      await loadTranscripts();
      await loadStorageStats();
    } catch (err) {
      setError(`Cleanup failed: ${err.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return <div className="transcript-manager loading">Loading transcripts...</div>;
  }

  return (
    <div className="transcript-manager">
      <div className="transcript-manager-header">
        <h2>Transcript Manager</h2>
        
        {/* Storage Stats */}
        {storageStats && (
          <div className="storage-stats">
            <span>{storageStats.totalTranscripts} transcripts</span>
            <span>{formatFileSize(storageStats.totalSize)}</span>
            <span>{storageStats.encryptedCount} encrypted</span>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="search-filters">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search transcripts..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="filter-toggle"
          >
            Filters {showFilters ? '▼' : '▶'}
          </button>
        </div>

        {showFilters && (
          <div className="filters-panel">
            <select 
              value={filters.platform} 
              onChange={(e) => setFilters({...filters, platform: e.target.value})}
            >
              <option value="">All Platforms</option>
              <option value="teams">Teams</option>
              <option value="zoom">Zoom</option>
              <option value="meet">Google Meet</option>
            </select>

            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => setFilters({
                ...filters, 
                dateRange: {...filters.dateRange, start: e.target.value}
              })}
              placeholder="Start date"
            />

            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => setFilters({
                ...filters, 
                dateRange: {...filters.dateRange, end: e.target.value}
              })}
              placeholder="End date"
            />

            <select 
              value={filters.encrypted === null ? '' : filters.encrypted.toString()} 
              onChange={(e) => setFilters({
                ...filters, 
                encrypted: e.target.value === '' ? null : e.target.value === 'true'
              })}
            >
              <option value="">All Types</option>
              <option value="true">Encrypted</option>
              <option value="false">Not Encrypted</option>
            </select>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="selection-info">
          {selectedTranscripts.size > 0 && (
            <span>{selectedTranscripts.size} selected</span>
          )}
        </div>

        <div className="toolbar-actions">
          <button onClick={selectAllTranscripts}>Select All</button>
          <button onClick={clearSelection}>Clear</button>
          
          <button 
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          >
            {viewMode === 'list' ? 'Grid View' : 'List View'}
          </button>

          {selectedTranscripts.size > 0 && (
            <>
              <button 
                onClick={() => setShowExportModal(true)}
                className="export-btn"
              >
                Export ({selectedTranscripts.size})
              </button>
              <button 
                onClick={() => handleDelete(Array.from(selectedTranscripts))}
                className="delete-btn"
              >
                Delete ({selectedTranscripts.size})
              </button>
            </>
          )}

          <button onClick={handleCleanup} className="cleanup-btn">
            Cleanup Old
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Transcript List */}
      <div className={`transcript-list ${viewMode}`}>
        {filteredTranscripts.length === 0 ? (
          <div className="no-transcripts">
            {searchQuery ? 'No transcripts found matching your search.' : 'No transcripts stored yet.'}
          </div>
        ) : (
          filteredTranscripts.map(transcript => (
            <TranscriptItem
              key={transcript.id}
              transcript={transcript}
              selected={selectedTranscripts.has(transcript.id)}
              onSelect={() => toggleTranscriptSelection(transcript.id)}
              onView={() => handleView(transcript)}
              onEdit={() => handleEdit(transcript)}
              onExport={() => {
                setSelectedTranscript(transcript);
                setShowExportModal(true);
              }}
              onShare={() => {
                setSelectedTranscript(transcript);
                setShowShareModal(true);
              }}
              onDelete={() => handleDelete([transcript.id])}
              viewMode={viewMode}
            />
          ))
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          transcript={selectedTranscript}
          selectedCount={selectedTranscripts.size}
          onExport={handleExport}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Share Modal */}
      {showShareModal && selectedTranscript && (
        <ShareModal
          transcript={selectedTranscript}
          onShare={handleShare}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* View Modal */}
      {showViewModal && selectedTranscript && (
        <TranscriptViewModal
          transcript={selectedTranscript}
          onClose={() => {
            setShowViewModal(false);
            setSelectedTranscript(null);
          }}
          onEdit={() => {
            setShowViewModal(false);
            setShowEditModal(true);
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTranscript && (
        <TranscriptEditModal
          transcript={selectedTranscript}
          onSave={handleSaveEdit}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTranscript(null);
          }}
        />
      )}
    </div>
  );
};

// Individual transcript item component
const TranscriptItem = ({ 
  transcript, 
  selected, 
  onSelect, 
  onView, 
  onExport, 
  onShare, 
  onDelete,
  onEdit,
  viewMode 
}) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`transcript-item ${selected ? 'selected' : ''} ${viewMode}`}>
      <div className="transcript-checkbox">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
        />
      </div>

      <div className="transcript-info" onClick={onView}>
        <div className="transcript-title">
          {transcript.title}
          {transcript.encrypted && <span className="encrypted-badge">🔒</span>}
        </div>
        <div className="transcript-meta">
          <span className="platform">{transcript.platform}</span>
          <span className="date">{formatDate(transcript.createdAt)}</span>
          <span className="size">{formatFileSize(transcript.size || 0)}</span>
          {transcript.segments && (
            <span className="segments">{transcript.segments.length} segments</span>
          )}
        </div>
        {transcript.tags && transcript.tags.length > 0 && (
          <div className="transcript-tags">
            {transcript.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}
        {transcript.summary && (
          <div className="transcript-preview">
            {transcript.summary.substring(0, 100)}...
          </div>
        )}
      </div>

      <div className="transcript-actions">
        <button onClick={onView} title="View">👁</button>
        <button onClick={onEdit} title="Edit">✏️</button>
        <button onClick={onExport} title="Export">📥</button>
        <button onClick={onShare} title="Share">🔗</button>
        <button onClick={onDelete} title="Delete" className="delete">🗑</button>
      </div>
    </div>
  );
};

// Export modal component
const ExportModal = ({ transcript, selectedCount, onExport, onClose }) => {
  const [format, setFormat] = useState('txt');
  const [options, setOptions] = useState({
    includeTimestamps: true,
    allowDownload: true,
    speakerFilter: [],
    timeRange: null
  });

  return (
    <div className="modal-overlay">
      <div className="modal export-modal">
        <div className="modal-header">
          <h3>Export Transcript{selectedCount > 1 ? 's' : ''}</h3>
          <button onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="export-options">
            <div className="option-group">
              <label>Format:</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="txt">Plain Text</option>
                <option value="pdf">PDF (HTML)</option>
                <option value="docx">Word (RTF)</option>
                <option value="json">JSON</option>
              </select>
            </div>

            <div className="option-group">
              <label>
                <input
                  type="checkbox"
                  checked={options.includeTimestamps}
                  onChange={(e) => setOptions({
                    ...options, 
                    includeTimestamps: e.target.checked
                  })}
                />
                Include timestamps
              </label>
            </div>

            {selectedCount === 1 && (
              <div className="option-group">
                <label>Export {selectedCount > 1 ? `${selectedCount} transcripts` : transcript?.title}</label>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose}>Cancel</button>
          <button 
            onClick={() => onExport(format, options)}
            className="primary"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

// Share modal component
const ShareModal = ({ transcript, onShare, onClose }) => {
  const [shareOptions, setShareOptions] = useState({
    allowDownload: true,
    allowComments: false,
    allowEdit: false,
    password: '',
    expiresAt: null,
    allowedEmails: [],
    maxAccesses: null,
    description: ''
  });

  const handleSubmit = () => {
    const options = { ...shareOptions };
    
    if (options.expiresAt) {
      options.expiresAt = new Date(options.expiresAt);
    }
    
    if (options.allowedEmails.length === 0) {
      delete options.allowedEmails;
    }

    onShare(options);
  };

  return (
    <div className="modal-overlay">
      <div className="modal share-modal">
        <div className="modal-header">
          <h3>Share Transcript: {transcript.title}</h3>
          <button onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="share-options">
            <div className="option-group">
              <label>Description (optional):</label>
              <input
                type="text"
                value={shareOptions.description}
                onChange={(e) => setShareOptions({
                  ...shareOptions,
                  description: e.target.value
                })}
                placeholder="Share description"
              />
            </div>

            <div className="option-group">
              <label>Expires on:</label>
              <input
                type="datetime-local"
                value={shareOptions.expiresAt || ''}
                onChange={(e) => setShareOptions({
                  ...shareOptions,
                  expiresAt: e.target.value
                })}
              />
            </div>

            <div className="option-group">
              <label>Password (optional):</label>
              <input
                type="password"
                value={shareOptions.password}
                onChange={(e) => setShareOptions({
                  ...shareOptions,
                  password: e.target.value
                })}
                placeholder="Leave empty for no password"
              />
            </div>

            <div className="permissions">
              <h4>Permissions:</h4>
              <label>
                <input
                  type="checkbox"
                  checked={shareOptions.allowDownload}
                  onChange={(e) => setShareOptions({
                    ...shareOptions,
                    allowDownload: e.target.checked
                  })}
                />
                Allow download
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={shareOptions.allowComments}
                  onChange={(e) => setShareOptions({
                    ...shareOptions,
                    allowComments: e.target.checked
                  })}
                />
                Allow comments
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={shareOptions.allowEdit}
                  onChange={(e) => setShareOptions({
                    ...shareOptions,
                    allowEdit: e.target.checked
                  })}
                />
                Allow editing
              </label>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSubmit} className="primary">
            Create Share Link
          </button>
        </div>
      </div>
    </div>
  );
};

// Transcript view modal component
const TranscriptViewModal = ({ transcript, onClose, onEdit }) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const formatDuration = (segments) => {
    if (!segments || segments.length === 0) return 'Unknown';
    const lastSegment = segments[segments.length - 1];
    const totalSeconds = lastSegment.endTime || 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal view-modal large">
        <div className="modal-header">
          <h3>{transcript.title}</h3>
          <div className="header-actions">
            <button onClick={onEdit} className="edit-btn">✏️ Edit</button>
            <button onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body">
          <div className="transcript-metadata">
            <div className="metadata-grid">
              <div className="metadata-item">
                <label>Platform:</label>
                <span>{transcript.platform}</span>
              </div>
              <div className="metadata-item">
                <label>Date:</label>
                <span>{formatDate(transcript.createdAt)}</span>
              </div>
              <div className="metadata-item">
                <label>Duration:</label>
                <span>{formatDuration(transcript.segments)}</span>
              </div>
              <div className="metadata-item">
                <label>Segments:</label>
                <span>{transcript.segments?.length || 0}</span>
              </div>
              {transcript.encrypted && (
                <div className="metadata-item">
                  <label>Security:</label>
                  <span>🔒 Encrypted</span>
                </div>
              )}
            </div>
          </div>

          {transcript.summary && (
            <div className="transcript-summary">
              <h4>Summary</h4>
              <div className="summary-content">
                {transcript.summary}
              </div>
            </div>
          )}

          <div className="transcript-content">
            <h4>Transcript</h4>
            <div className="segments-container">
              {transcript.segments && transcript.segments.length > 0 ? (
                transcript.segments.map((segment, index) => (
                  <div key={index} className="transcript-segment">
                    <div className="segment-header">
                      <span className="speaker-name">
                        {segment.speakerName || `Speaker ${segment.speakerId || 'Unknown'}`}
                      </span>
                      <span className="segment-time">
                        {new Date(segment.startTime * 1000).toISOString().substr(14, 5)}
                      </span>
                    </div>
                    <div className="segment-text">
                      {segment.text}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-segments">
                  No transcript segments available
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onEdit}>Edit Transcript</button>
          <button onClick={onClose} className="primary">Close</button>
        </div>
      </div>
    </div>
  );
};

// Transcript edit modal component
const TranscriptEditModal = ({ transcript, onSave, onClose }) => {
  const [editedTranscript, setEditedTranscript] = useState({
    ...transcript,
    segments: transcript.segments ? [...transcript.segments] : []
  });
  const [hasChanges, setHasChanges] = useState(false);

  const handleTitleChange = (newTitle) => {
    setEditedTranscript(prev => ({ ...prev, title: newTitle }));
    setHasChanges(true);
  };

  const handleSummaryChange = (newSummary) => {
    setEditedTranscript(prev => ({ ...prev, summary: newSummary }));
    setHasChanges(true);
  };

  const handleSegmentChange = (index, field, value) => {
    const newSegments = [...editedTranscript.segments];
    newSegments[index] = { ...newSegments[index], [field]: value };
    setEditedTranscript(prev => ({ ...prev, segments: newSegments }));
    setHasChanges(true);
  };

  const handleDeleteSegment = (index) => {
    const newSegments = editedTranscript.segments.filter((_, i) => i !== index);
    setEditedTranscript(prev => ({ ...prev, segments: newSegments }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(editedTranscript);
  };

  const handleClose = () => {
    if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal edit-modal large">
        <div className="modal-header">
          <h3>Edit Transcript</h3>
          <button onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="edit-section">
            <label>Title:</label>
            <input
              type="text"
              value={editedTranscript.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="title-input"
            />
          </div>

          <div className="edit-section">
            <label>Summary:</label>
            <textarea
              value={editedTranscript.summary || ''}
              onChange={(e) => handleSummaryChange(e.target.value)}
              className="summary-input"
              rows={4}
              placeholder="Enter meeting summary..."
            />
          </div>

          <div className="edit-section">
            <label>Transcript Segments:</label>
            <div className="segments-editor">
              {editedTranscript.segments && editedTranscript.segments.length > 0 ? (
                editedTranscript.segments.map((segment, index) => (
                  <div key={index} className="segment-editor">
                    <div className="segment-controls">
                      <input
                        type="text"
                        value={segment.speakerName || `Speaker ${segment.speakerId || 'Unknown'}`}
                        onChange={(e) => handleSegmentChange(index, 'speakerName', e.target.value)}
                        className="speaker-input"
                        placeholder="Speaker name"
                      />
                      <span className="segment-time">
                        {new Date(segment.startTime * 1000).toISOString().substr(14, 5)}
                      </span>
                      <button
                        onClick={() => handleDeleteSegment(index)}
                        className="delete-segment"
                        title="Delete segment"
                      >
                        🗑
                      </button>
                    </div>
                    <textarea
                      value={segment.text}
                      onChange={(e) => handleSegmentChange(index, 'text', e.target.value)}
                      className="segment-text-input"
                      rows={2}
                    />
                  </div>
                ))
              ) : (
                <div className="no-segments">
                  No transcript segments to edit
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={handleClose}>Cancel</button>
          <button 
            onClick={handleSave} 
            className="primary"
            disabled={!hasChanges}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranscriptManager;
import React, { useState, useEffect } from 'react';
import './PromptManager.css';

/**
 * Prompt Manager Component - Manages custom AI summary prompts
 * Allows users to create, edit, and manage their custom prompts for AI summary generation
 */
const PromptManager = ({ configManager, onPromptSaved, onClose }) => {
  const [userPrompts, setUserPrompts] = useState([]);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [currentPromptName, setCurrentPromptName] = useState('');
  const [currentPromptDescription, setCurrentPromptDescription] = useState('');
  const [currentPromptTags, setCurrentPromptTags] = useState([]);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showImportExport, setShowImportExport] = useState(false);
  const [importData, setImportData] = useState('');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    loadPrompts();
    loadTemplates();
  }, []);

  /**
   * Load user prompts
   */
  const loadPrompts = async () => {
    setIsLoading(true);
    try {
      const prompts = await configManager.getUserPrompts();
      setUserPrompts(prompts);
      
      // Select the default prompt or first prompt
      const defaultPrompt = prompts.find(p => p.isDefault) || prompts[0];
      if (defaultPrompt) {
        selectPrompt(defaultPrompt);
      }
    } catch (error) {
      console.error('Error loading prompts:', error);
      setError('Failed to load prompts');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Select a prompt for editing
   */
  const selectPrompt = (prompt) => {
    setSelectedPromptId(prompt.id);
    setCurrentPrompt(prompt.prompt);
    setCurrentPromptName(prompt.name);
    setCurrentPromptDescription(prompt.description || '');
    setCurrentPromptTags(prompt.tags || []);
    setIsEditing(false);
    setIsCreatingNew(false);
    setError('');
    setSuccess('');
  };

  /**
   * Load prompt templates
   */
  const loadTemplates = () => {
    const templates = [
      {
        id: 'default',
        name: 'Default Summary',
        description: 'Standard meeting summary format',
        prompt: `Please provide a concise meeting summary that includes:

1. **Key Discussion Points**: Main topics discussed during the meeting
2. **Decisions Made**: Any decisions or conclusions reached
3. **Action Items**: Tasks assigned with responsible parties (if mentioned)
4. **Next Steps**: Follow-up actions or future meetings planned

Focus on the agenda items and important outcomes. Keep the summary professional and actionable.`
      },
      {
        id: 'detailed',
        name: 'Detailed Analysis',
        description: 'Comprehensive meeting analysis with insights',
        prompt: `Please provide a detailed meeting analysis that includes:

1. **Executive Summary**: Brief overview of the meeting's purpose and outcomes
2. **Key Discussion Points**: Detailed breakdown of topics discussed
3. **Decisions and Resolutions**: All decisions made with context and rationale
4. **Action Items**: Specific tasks with assignees, deadlines, and priorities
5. **Risks and Concerns**: Any issues or risks identified during the meeting
6. **Next Steps**: Immediate and long-term follow-up actions
7. **Meeting Effectiveness**: Brief assessment of meeting productivity

Provide insights and analysis beyond just transcription. Focus on strategic implications and business impact.`
      },
      {
        id: 'action_focused',
        name: 'Action-Focused',
        description: 'Emphasizes action items and next steps',
        prompt: `Please create an action-focused summary with emphasis on:

1. **Action Items**: 
   - What needs to be done
   - Who is responsible
   - When it's due
   - Priority level

2. **Decisions Requiring Follow-up**: Decisions that need implementation
3. **Unresolved Issues**: Items that need further discussion
4. **Key Deadlines**: Important dates and milestones mentioned
5. **Resource Requirements**: Any resources or support needed

Format action items as a clear checklist that can be easily tracked and followed up on.`
      },
      {
        id: 'executive',
        name: 'Executive Brief',
        description: 'High-level summary for executives',
        prompt: `Please provide an executive-level brief that includes:

1. **Strategic Overview**: High-level purpose and strategic context
2. **Key Outcomes**: Most important results and decisions
3. **Business Impact**: How decisions affect business objectives
4. **Resource Implications**: Budget, staffing, or resource impacts
5. **Risk Assessment**: Key risks and mitigation strategies
6. **Recommendations**: Strategic recommendations based on discussion

Keep the summary concise and focused on strategic implications. Avoid operational details unless they have strategic significance.`
      },
      {
        id: 'project_status',
        name: 'Project Status',
        description: 'Project-focused meeting summary',
        prompt: `Please provide a project-focused summary that includes:

1. **Project Status**: Current state and progress updates
2. **Milestones**: Completed and upcoming milestones
3. **Blockers and Issues**: Obstacles and how they're being addressed
4. **Resource Updates**: Team changes, budget updates, tool needs
5. **Timeline Changes**: Any schedule adjustments or delays
6. **Quality and Risk**: Quality metrics and risk assessments
7. **Next Sprint/Phase**: Immediate next steps and priorities

Focus on project management aspects and provide clear status indicators.`
      }
    ];

    setPromptTemplates(templates);
  };

  /**
   * Handle prompt text change
   */
  const handlePromptChange = (event) => {
    setCurrentPrompt(event.target.value);
    setError('');
    setSuccess('');
  };

  /**
   * Handle prompt name change
   */
  const handlePromptNameChange = (event) => {
    setCurrentPromptName(event.target.value);
    setError('');
    setSuccess('');
  };

  /**
   * Handle prompt description change
   */
  const handlePromptDescriptionChange = (event) => {
    setCurrentPromptDescription(event.target.value);
    setError('');
    setSuccess('');
  };

  /**
   * Add a tag
   */
  const addTag = () => {
    if (newTag.trim() && !currentPromptTags.includes(newTag.trim())) {
      setCurrentPromptTags([...currentPromptTags, newTag.trim()]);
      setNewTag('');
    }
  };

  /**
   * Remove a tag
   */
  const removeTag = (tagToRemove) => {
    setCurrentPromptTags(currentPromptTags.filter(tag => tag !== tagToRemove));
  };

  /**
   * Start creating a new prompt
   */
  const startNewPrompt = () => {
    setIsCreatingNew(true);
    setIsEditing(true);
    setSelectedPromptId('');
    setCurrentPrompt('');
    setCurrentPromptName('');
    setCurrentPromptDescription('');
    setCurrentPromptTags([]);
    setError('');
    setSuccess('');
  };

  /**
   * Save the current prompt
   */
  const handleSave = async () => {
    if (!currentPrompt.trim()) {
      setError('Prompt content cannot be empty');
      return;
    }

    if (!currentPromptName.trim()) {
      setError('Prompt name cannot be empty');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const promptData = {
        id: selectedPromptId || undefined,
        userId: 'default',
        name: currentPromptName.trim(),
        prompt: currentPrompt.trim(),
        description: currentPromptDescription.trim(),
        tags: currentPromptTags,
        isDefault: userPrompts.length === 0 // First prompt becomes default
      };

      const savedPrompt = await configManager.savePrompt(promptData);
      
      // Update local state
      if (isCreatingNew) {
        setUserPrompts([...userPrompts, savedPrompt]);
      } else {
        setUserPrompts(userPrompts.map(p => p.id === savedPrompt.id ? savedPrompt : p));
      }

      setSelectedPromptId(savedPrompt.id);
      setIsEditing(false);
      setIsCreatingNew(false);
      setSuccess('Prompt saved successfully!');
      
      if (onPromptSaved) {
        onPromptSaved(savedPrompt.prompt);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving prompt:', error);
      setError(error.message || 'Failed to save prompt');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Delete the current prompt
   */
  const handleDelete = async () => {
    if (!selectedPromptId || userPrompts.length <= 1) {
      setError('Cannot delete the last prompt');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this prompt?')) {
      return;
    }

    try {
      await configManager.deletePrompt(selectedPromptId);
      const updatedPrompts = userPrompts.filter(p => p.id !== selectedPromptId);
      setUserPrompts(updatedPrompts);
      
      // Select another prompt
      if (updatedPrompts.length > 0) {
        selectPrompt(updatedPrompts[0]);
      }
      
      setSuccess('Prompt deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting prompt:', error);
      setError('Failed to delete prompt');
    }
  };

  /**
   * Cancel editing
   */
  const handleCancel = () => {
    if (isCreatingNew) {
      // If creating new, go back to selected prompt or first prompt
      const promptToSelect = userPrompts.find(p => p.id === selectedPromptId) || userPrompts[0];
      if (promptToSelect) {
        selectPrompt(promptToSelect);
      }
    } else {
      // If editing existing, reload the original prompt
      const originalPrompt = userPrompts.find(p => p.id === selectedPromptId);
      if (originalPrompt) {
        selectPrompt(originalPrompt);
      }
    }
  };

  /**
   * Apply selected template
   */
  const handleApplyTemplate = () => {
    if (!selectedTemplate) return;

    const template = promptTemplates.find(t => t.id === selectedTemplate);
    if (template) {
      setCurrentPrompt(template.prompt);
      if (isCreatingNew && !currentPromptName.trim()) {
        setCurrentPromptName(template.name);
        setCurrentPromptDescription(template.description);
      }
      setError('');
      setSuccess('');
    }
  };

  /**
   * Export prompts
   */
  const handleExport = async () => {
    try {
      const exportData = await configManager.exportPrompts('default');
      
      // Create and download file
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-prompts-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess('Prompts exported successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error exporting prompts:', error);
      setError('Failed to export prompts');
    }
  };

  /**
   * Import prompts
   */
  const handleImport = async () => {
    if (!importData.trim()) {
      setError('Please paste import data');
      return;
    }

    try {
      const importedPrompts = await configManager.importPrompts('default', importData);
      
      // Refresh prompts list
      await loadPrompts();
      
      setImportData('');
      setShowImportExport(false);
      setSuccess(`Successfully imported ${importedPrompts.length} prompt(s)!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error importing prompts:', error);
      setError(error.message || 'Failed to import prompts');
    }
  };

  /**
   * Handle file import
   */
  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setImportData(e.target.result);
    };
    reader.readAsText(file);
  };

  /**
   * Toggle preview mode
   */
  const togglePreview = () => {
    setPreviewMode(!previewMode);
  };

  /**
   * Format prompt for preview
   */
  const formatPromptPreview = (prompt) => {
    return prompt
      .split('\n')
      .map((line, index) => {
        // Handle headers
        if (line.match(/^\d+\.\s*\*\*.*\*\*:/)) {
          return <div key={index} className="prompt-preview-header">{line}</div>;
        }
        // Handle bullet points
        if (line.trim().startsWith('-')) {
          return <div key={index} className="prompt-preview-bullet">{line}</div>;
        }
        // Handle empty lines
        if (line.trim() === '') {
          return <br key={index} />;
        }
        // Regular text
        return <div key={index} className="prompt-preview-text">{line}</div>;
      });
  };

  /**
   * Get character and word count
   */
  const getPromptStats = () => {
    const chars = currentPrompt.length;
    const words = currentPrompt.trim() ? currentPrompt.trim().split(/\s+/).length : 0;
    const lines = currentPrompt.split('\n').length;
    
    return { chars, words, lines };
  };

  const stats = getPromptStats();

  return (
    <div className="prompt-manager">
      <div className="prompt-manager-header">
        <h3>Custom Summary Prompts</h3>
        <div className="header-actions">
          <button 
            onClick={() => setShowImportExport(!showImportExport)}
            className="import-export-button"
          >
            Import/Export
          </button>
          <button 
            className="close-button"
            onClick={onClose}
            aria-label="Close prompt manager"
          >
            ×
          </button>
        </div>
      </div>

      <div className="prompt-manager-content">
        {isLoading ? (
          <div className="loading-message">Loading prompts...</div>
        ) : (
          <>
            {/* Prompt Selection */}
            <div className="prompt-selection-section">
              <div className="section-header">
                <h4>Your Prompts</h4>
                <button 
                  onClick={startNewPrompt}
                  className="new-prompt-button"
                  disabled={isEditing}
                >
                  + New Prompt
                </button>
              </div>
              
              <div className="prompt-list">
                {userPrompts.map(prompt => (
                  <div 
                    key={prompt.id}
                    className={`prompt-item ${selectedPromptId === prompt.id ? 'selected' : ''}`}
                    onClick={() => !isEditing && selectPrompt(prompt)}
                  >
                    <div className="prompt-item-header">
                      <span className="prompt-name">{prompt.name}</span>
                      {prompt.isDefault && <span className="default-badge">Default</span>}
                    </div>
                    {prompt.description && (
                      <div className="prompt-description">{prompt.description}</div>
                    )}
                    {prompt.tags && prompt.tags.length > 0 && (
                      <div className="prompt-tags">
                        {prompt.tags.map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Import/Export Section */}
            {showImportExport && (
              <div className="import-export-section">
                <h4>Import/Export Prompts</h4>
                <div className="import-export-controls">
                  <button onClick={handleExport} className="export-button">
                    Export All Prompts
                  </button>
                  
                  <div className="import-controls">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileImport}
                      className="file-input"
                      id="import-file"
                    />
                    <label htmlFor="import-file" className="file-input-label">
                      Choose File
                    </label>
                    
                    <textarea
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      placeholder="Or paste import data here..."
                      className="import-textarea"
                      rows={4}
                    />
                    
                    <button 
                      onClick={handleImport}
                      disabled={!importData.trim()}
                      className="import-button"
                    >
                      Import Prompts
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Template Selection */}
            {(isEditing || isCreatingNew) && (
              <div className="template-section">
                <h4>Prompt Templates</h4>
                <div className="template-selector">
                  <select 
                    value={selectedTemplate} 
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="template-dropdown"
                  >
                    <option value="">Select a template...</option>
                    {promptTemplates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name} - {template.description}
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={handleApplyTemplate}
                    disabled={!selectedTemplate}
                    className="apply-template-button"
                  >
                    Apply Template
                  </button>
                </div>
              </div>
            )}

            {/* Prompt Editor */}
            {selectedPromptId || isCreatingNew ? (
              <div className="prompt-editor-section">
                <div className="editor-header">
                  <h4>{isCreatingNew ? 'New Prompt' : 'Edit Prompt'}</h4>
                  <div className="editor-controls">
                    {!isEditing && !isCreatingNew && (
                      <>
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="edit-button"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={handleDelete}
                          className="delete-button"
                          disabled={userPrompts.length <= 1}
                        >
                          Delete
                        </button>
                      </>
                    )}
                    <button 
                      onClick={togglePreview}
                      className={`preview-button ${previewMode ? 'active' : ''}`}
                      disabled={isEditing || isCreatingNew}
                    >
                      {previewMode ? 'Edit' : 'Preview'}
                    </button>
                  </div>
                </div>

                {/* Prompt Metadata */}
                {(isEditing || isCreatingNew) && (
                  <div className="prompt-metadata">
                    <div className="metadata-row">
                      <label htmlFor="prompt-name">Name:</label>
                      <input
                        id="prompt-name"
                        type="text"
                        value={currentPromptName}
                        onChange={handlePromptNameChange}
                        className="prompt-name-input"
                        placeholder="Enter prompt name..."
                        maxLength={100}
                      />
                    </div>
                    
                    <div className="metadata-row">
                      <label htmlFor="prompt-description">Description:</label>
                      <input
                        id="prompt-description"
                        type="text"
                        value={currentPromptDescription}
                        onChange={handlePromptDescriptionChange}
                        className="prompt-description-input"
                        placeholder="Enter prompt description (optional)..."
                        maxLength={500}
                      />
                    </div>

                    <div className="metadata-row">
                      <label>Tags:</label>
                      <div className="tags-input">
                        <div className="current-tags">
                          {currentPromptTags.map(tag => (
                            <span key={tag} className="tag">
                              {tag}
                              <button 
                                onClick={() => removeTag(tag)}
                                className="remove-tag"
                                type="button"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="add-tag">
                          <input
                            type="text"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addTag()}
                            placeholder="Add tag..."
                            className="tag-input"
                          />
                          <button 
                            onClick={addTag}
                            disabled={!newTag.trim()}
                            className="add-tag-button"
                            type="button"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {previewMode ? (
                  <div className="prompt-preview">
                    {formatPromptPreview(currentPrompt)}
                  </div>
                ) : (
                  <textarea
                    value={currentPrompt}
                    onChange={handlePromptChange}
                    className="prompt-textarea"
                    placeholder="Enter your custom prompt for AI summary generation..."
                    rows={15}
                    disabled={!isEditing && !isCreatingNew}
                  />
                )}

                {/* Prompt Statistics */}
                <div className="prompt-stats">
                  <span>Characters: {stats.chars}</span>
                  <span>Words: {stats.words}</span>
                  <span>Lines: {stats.lines}</span>
                </div>
              </div>
            ) : (
              <div className="no-prompt-selected">
                <p>Select a prompt to view or edit, or create a new one.</p>
              </div>
            )}

        {/* Messages */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

            {/* Action Buttons */}
            {(isEditing || isCreatingNew) && (
              <div className="prompt-actions">
                <button 
                  onClick={handleSave}
                  disabled={isSaving || !currentPrompt.trim() || !currentPromptName.trim()}
                  className="save-button primary"
                >
                  {isSaving ? 'Saving...' : 'Save Prompt'}
                </button>
                
                <button 
                  onClick={handleCancel}
                  className="cancel-button"
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Help Text */}
            <div className="prompt-help">
              <h5>Prompt Tips:</h5>
              <ul>
                <li>Use clear, specific instructions for the AI</li>
                <li>Include the format you want (bullet points, sections, etc.)</li>
                <li>Specify what information to focus on or exclude</li>
                <li>Use **bold** text for section headers</li>
                <li>The AI will have access to meeting agenda and speaker information</li>
                <li>Create multiple prompts for different meeting types</li>
                <li>Use tags to organize your prompts</li>
                <li>Export your prompts to share with team members</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PromptManager;
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptManager from '../PromptManager.js';

// Mock ConfigurationManager
const mockConfigManager = {
  getUserPrompt: jest.fn(),
  saveUserPrompt: jest.fn(),
  getDefaultPrompt: jest.fn(),
  getUserPrompts: jest.fn(),
  savePrompt: jest.fn(),
  deletePrompt: jest.fn(),
  getPromptById: jest.fn(),
  exportPrompts: jest.fn(),
  importPrompts: jest.fn(),
  validatePrompt: jest.fn()
};

const mockPrompts = [
  {
    id: 'prompt1',
    userId: 'default',
    name: 'Default Prompt',
    prompt: 'Default prompt content',
    description: 'Default description',
    tags: ['default'],
    isDefault: true,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z'
  },
  {
    id: 'prompt2',
    userId: 'default',
    name: 'Custom Prompt',
    prompt: 'Custom prompt content',
    description: 'Custom description',
    tags: ['custom', 'meeting'],
    isDefault: false,
    createdAt: '2023-01-02T00:00:00.000Z',
    updatedAt: '2023-01-02T00:00:00.000Z'
  }
];

describe('PromptManager', () => {
  const defaultProps = {
    configManager: mockConfigManager,
    onPromptSaved: jest.fn(),
    onClose: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigManager.getUserPrompt.mockResolvedValue('Current user prompt');
    mockConfigManager.getDefaultPrompt.mockReturnValue('Default prompt text');
    mockConfigManager.saveUserPrompt.mockResolvedValue();
    mockConfigManager.getUserPrompts.mockResolvedValue(mockPrompts);
    mockConfigManager.savePrompt.mockResolvedValue(mockPrompts[0]);
    mockConfigManager.deletePrompt.mockResolvedValue(true);
    mockConfigManager.exportPrompts.mockResolvedValue('{"version":"1.0","prompts":[]}');
    mockConfigManager.importPrompts.mockResolvedValue([]);
    mockConfigManager.validatePrompt.mockReturnValue({ isValid: true, errors: [] });
  });

  describe('Rendering', () => {
    test('should render prompt manager with header', async () => {
      render(<PromptManager {...defaultProps} />);

      expect(screen.getByText('Custom Summary Prompts')).toBeInTheDocument();
      expect(screen.getByLabelText('Close prompt manager')).toBeInTheDocument();
      expect(screen.getByText('Import/Export')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByText('Default Prompt')).toBeInTheDocument();
        expect(screen.getByText('Custom Prompt')).toBeInTheDocument();
      });
    });

    test('should render prompt list', async () => {
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Your Prompts')).toBeInTheDocument();
        expect(screen.getByText('+ New Prompt')).toBeInTheDocument();
        expect(screen.getByText('Default Prompt')).toBeInTheDocument();
        expect(screen.getByText('Custom Prompt')).toBeInTheDocument();
      });
    });

    test('should render prompt editor when prompt is selected', async () => {
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Edit Prompt')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
        expect(screen.getByText('Preview')).toBeInTheDocument();
      });
    });

    test('should show import/export section when toggled', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      const importExportButton = screen.getByText('Import/Export');
      await user.click(importExportButton);

      expect(screen.getByText('Import/Export Prompts')).toBeInTheDocument();
      expect(screen.getByText('Export All Prompts')).toBeInTheDocument();
      expect(screen.getByText('Choose File')).toBeInTheDocument();
    });

    test('should render help section', async () => {
      render(<PromptManager {...defaultProps} />);

      expect(screen.getByText('Prompt Tips:')).toBeInTheDocument();
      expect(screen.getByText(/Use clear, specific instructions/)).toBeInTheDocument();
    });
  });

  describe('Template Selection', () => {
    test('should show template options when dropdown is opened', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      const dropdown = screen.getByRole('combobox');
      await user.click(dropdown);

      expect(screen.getByText(/Default Summary/)).toBeInTheDocument();
      expect(screen.getByText(/Detailed Analysis/)).toBeInTheDocument();
      expect(screen.getByText(/Action-Focused/)).toBeInTheDocument();
      expect(screen.getByText(/Executive Brief/)).toBeInTheDocument();
      expect(screen.getByText(/Project Status/)).toBeInTheDocument();
    });

    test('should apply selected template', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      // Select a template
      const dropdown = screen.getByRole('combobox');
      await user.selectOptions(dropdown, 'detailed');

      // Apply the template
      const applyButton = screen.getByText('Apply Template');
      await user.click(applyButton);

      // Check that textarea content changed
      const textarea = screen.getByRole('textbox');
      expect(textarea.value).toContain('detailed meeting analysis');
    });

    test('should disable apply button when no template selected', () => {
      render(<PromptManager {...defaultProps} />);

      const applyButton = screen.getByText('Apply Template');
      expect(applyButton).toBeDisabled();
    });
  });

  describe('Prompt Editing', () => {
    test('should allow editing prompt text', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'New custom prompt text');

      expect(textarea.value).toBe('New custom prompt text');
    });

    test('should reset to default prompt', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      // Change the prompt
      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Modified prompt');

      // Reset to default
      const resetButton = screen.getByText('Reset to Default');
      await user.click(resetButton);

      expect(textarea.value).toBe('Default prompt text');
    });

    test('should toggle preview mode', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      const previewButton = screen.getByText('Preview');
      await user.click(previewButton);

      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

      // Toggle back to edit mode
      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Prompt Statistics', () => {
    test('should display prompt statistics', async () => {
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Characters:/)).toBeInTheDocument();
        expect(screen.getByText(/Words:/)).toBeInTheDocument();
        expect(screen.getByText(/Lines:/)).toBeInTheDocument();
      });
    });

    test('should update statistics when prompt changes', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Short prompt');

      expect(screen.getByText('Characters: 12')).toBeInTheDocument();
      expect(screen.getByText('Words: 2')).toBeInTheDocument();
      expect(screen.getByText('Lines: 1')).toBeInTheDocument();
    });
  });

  describe('Saving Prompts', () => {
    test('should save prompt successfully', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'New custom prompt');

      const saveButton = screen.getByText('Save Prompt');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockConfigManager.saveUserPrompt).toHaveBeenCalledWith('default', 'New custom prompt');
        expect(screen.getByText('Prompt saved successfully!')).toBeInTheDocument();
      });

      expect(defaultProps.onPromptSaved).toHaveBeenCalledWith('New custom prompt');
    });

    test('should show error for empty prompt', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);

      const saveButton = screen.getByText('Save Prompt');
      await user.click(saveButton);

      expect(screen.getByText('Prompt cannot be empty')).toBeInTheDocument();
      expect(mockConfigManager.saveUserPrompt).not.toHaveBeenCalled();
    });

    test('should handle save errors', async () => {
      const user = userEvent.setup();
      mockConfigManager.saveUserPrompt.mockRejectedValue(new Error('Save failed'));
      
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Test prompt');

      const saveButton = screen.getByText('Save Prompt');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to save prompt')).toBeInTheDocument();
      });
    });

    test('should disable save button when saving', async () => {
      const user = userEvent.setup();
      let resolveSave;
      mockConfigManager.saveUserPrompt.mockImplementation(() => 
        new Promise(resolve => { resolveSave = resolve; })
      );

      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Test prompt');

      const saveButton = screen.getByText('Save Prompt');
      await user.click(saveButton);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(screen.getByText('Saving...')).toBeDisabled();

      // Resolve the save
      resolveSave();
    });
  });

  describe('Event Handlers', () => {
    test('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      const closeButton = screen.getByLabelText('Close prompt manager');
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    test('should clear messages when prompt is edited', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      // First trigger an error
      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);

      const saveButton = screen.getByText('Save Prompt');
      await user.click(saveButton);

      expect(screen.getByText('Prompt cannot be empty')).toBeInTheDocument();

      // Now edit the prompt - error should disappear
      await user.type(textarea, 'New text');

      expect(screen.queryByText('Prompt cannot be empty')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    test('should handle loading prompt error', async () => {
      mockConfigManager.getUserPrompt.mockRejectedValue(new Error('Load failed'));
      
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load prompts')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels', () => {
      render(<PromptManager {...defaultProps} />);

      expect(screen.getByLabelText('Close prompt manager')).toBeInTheDocument();
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByRole('combobox')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Apply Template')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Preview')).toHaveFocus();
    });
  });
});

  describe('Prompt Management', () => {
    test('should create new prompt', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('+ New Prompt')).toBeInTheDocument();
      });

      const newPromptButton = screen.getByText('+ New Prompt');
      await user.click(newPromptButton);

      expect(screen.getByText('New Prompt')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter prompt name...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter prompt description (optional)...')).toBeInTheDocument();
    });

    test('should save new prompt with validation', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        const newPromptButton = screen.getByText('+ New Prompt');
        expect(newPromptButton).toBeInTheDocument();
      });

      const newPromptButton = screen.getByText('+ New Prompt');
      await user.click(newPromptButton);

      // Try to save without name - should show error
      const saveButton = screen.getByText('Save Prompt');
      await user.click(saveButton);

      expect(screen.getByText('Prompt name cannot be empty')).toBeInTheDocument();

      // Add name and content
      const nameInput = screen.getByPlaceholderText('Enter prompt name...');
      const contentTextarea = screen.getByPlaceholderText('Enter your custom prompt for AI summary generation...');

      await user.type(nameInput, 'Test Prompt');
      await user.type(contentTextarea, 'Test prompt content');

      await user.click(saveButton);

      await waitFor(() => {
        expect(mockConfigManager.savePrompt).toHaveBeenCalledWith({
          userId: 'default',
          name: 'Test Prompt',
          prompt: 'Test prompt content',
          description: '',
          tags: [],
          isDefault: false
        });
      });
    });

    test('should delete prompt with confirmation', async () => {
      const user = userEvent.setup();
      
      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = jest.fn(() => true);

      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this prompt?');
      expect(mockConfigManager.deletePrompt).toHaveBeenCalledWith('prompt1');

      // Restore original confirm
      window.confirm = originalConfirm;
    });

    test('should not delete last prompt', async () => {
      const user = userEvent.setup();
      mockConfigManager.getUserPrompts.mockResolvedValue([mockPrompts[0]]); // Only one prompt

      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      const deleteButton = screen.getByText('Delete');
      expect(deleteButton).toBeDisabled();
    });

    test('should select different prompt', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Custom Prompt')).toBeInTheDocument();
      });

      const customPromptItem = screen.getByText('Custom Prompt');
      await user.click(customPromptItem);

      // Should display the custom prompt content
      await waitFor(() => {
        expect(screen.getByDisplayValue('Custom prompt content')).toBeInTheDocument();
      });
    });
  });

  describe('Tags Management', () => {
    test('should add and remove tags', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      // Add a new tag
      const tagInput = screen.getByPlaceholderText('Add tag...');
      await user.type(tagInput, 'newtag');

      const addTagButton = screen.getByText('Add');
      await user.click(addTagButton);

      expect(screen.getByText('newtag')).toBeInTheDocument();

      // Remove a tag
      const removeTagButtons = screen.getAllByText('×');
      const tagRemoveButton = removeTagButtons.find(button => 
        button.closest('.tag')?.textContent.includes('default')
      );
      
      if (tagRemoveButton) {
        await user.click(tagRemoveButton);
      }
    });

    test('should not add duplicate tags', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument();
      });

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      const tagInput = screen.getByPlaceholderText('Add tag...');
      await user.type(tagInput, 'default'); // This tag already exists

      const addTagButton = screen.getByText('Add');
      await user.click(addTagButton);

      // Should still only have one 'default' tag
      const defaultTags = screen.getAllByText('default');
      expect(defaultTags).toHaveLength(1);
    });
  });

  describe('Import/Export', () => {
    test('should export prompts', async () => {
      const user = userEvent.setup();
      
      // Mock URL.createObjectURL and related DOM methods
      const mockCreateObjectURL = jest.fn(() => 'mock-url');
      const mockRevokeObjectURL = jest.fn();
      const mockClick = jest.fn();
      const mockAppendChild = jest.fn();
      const mockRemoveChild = jest.fn();

      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick
      };

      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
      jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

      render(<PromptManager {...defaultProps} />);

      const importExportButton = screen.getByText('Import/Export');
      await user.click(importExportButton);

      const exportButton = screen.getByText('Export All Prompts');
      await user.click(exportButton);

      expect(mockConfigManager.exportPrompts).toHaveBeenCalledWith('default');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();

      // Restore mocks
      jest.restoreAllMocks();
    });

    test('should import prompts from text', async () => {
      const user = userEvent.setup();
      const importData = JSON.stringify({
        version: '1.0',
        prompts: [
          {
            name: 'Imported Prompt',
            prompt: 'Imported content',
            description: 'Imported description',
            tags: ['imported']
          }
        ]
      });

      render(<PromptManager {...defaultProps} />);

      const importExportButton = screen.getByText('Import/Export');
      await user.click(importExportButton);

      const importTextarea = screen.getByPlaceholderText('Or paste import data here...');
      await user.type(importTextarea, importData);

      const importButton = screen.getByText('Import Prompts');
      await user.click(importButton);

      expect(mockConfigManager.importPrompts).toHaveBeenCalledWith('default', importData);
    });

    test('should handle import errors', async () => {
      const user = userEvent.setup();
      mockConfigManager.importPrompts.mockRejectedValue(new Error('Invalid import data'));

      render(<PromptManager {...defaultProps} />);

      const importExportButton = screen.getByText('Import/Export');
      await user.click(importExportButton);

      const importTextarea = screen.getByPlaceholderText('Or paste import data here...');
      await user.type(importTextarea, 'invalid json');

      const importButton = screen.getByText('Import Prompts');
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid import data')).toBeInTheDocument();
      });
    });
  });

  describe('Template Application', () => {
    test('should apply template to new prompt', async () => {
      const user = userEvent.setup();
      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        const newPromptButton = screen.getByText('+ New Prompt');
        expect(newPromptButton).toBeInTheDocument();
      });

      const newPromptButton = screen.getByText('+ New Prompt');
      await user.click(newPromptButton);

      // Select a template
      const templateDropdown = screen.getByRole('combobox');
      await user.selectOptions(templateDropdown, 'detailed');

      const applyButton = screen.getByText('Apply Template');
      await user.click(applyButton);

      const textarea = screen.getByRole('textbox', { name: '' });
      expect(textarea.value).toContain('detailed meeting analysis');

      // Should also populate name if empty
      const nameInput = screen.getByDisplayValue('Detailed Analysis');
      expect(nameInput).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    test('should validate prompt content length', async () => {
      const user = userEvent.setup();
      mockConfigManager.savePrompt.mockRejectedValue(new Error('Prompt content is too long (maximum 10,000 characters)'));

      render(<PromptManager {...defaultProps} />);

      await waitFor(() => {
        const newPromptButton = screen.getByText('+ New Prompt');
        expect(newPromptButton).toBeInTheDocument();
      });

      const newPromptButton = screen.getByText('+ New Prompt');
      await user.click(newPromptButton);

      const nameInput = screen.getByPlaceholderText('Enter prompt name...');
      const contentTextarea = screen.getByPlaceholderText('Enter your custom prompt for AI summary generation...');

      await user.type(nameInput, 'Test Prompt');
      await user.type(contentTextarea, 'x'.repeat(10001)); // Too long

      const saveButton = screen.getByText('Save Prompt');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Prompt content is too long (maximum 10,000 characters)')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    test('should show loading state', async () => {
      let resolvePrompts;
      mockConfigManager.getUserPrompts.mockImplementation(() => 
        new Promise(resolve => { resolvePrompts = resolve; })
      );

      render(<PromptManager {...defaultProps} />);

      expect(screen.getByText('Loading prompts...')).toBeInTheDocument();

      // Resolve the promise
      resolvePrompts(mockPrompts);

      await waitFor(() => {
        expect(screen.queryByText('Loading prompts...')).not.toBeInTheDocument();
      });
    });
  });
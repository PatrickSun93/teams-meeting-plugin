import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptManager from '../PromptManager.js';

// Mock ConfigurationManager
const mockConfigManager = {
  getUserPrompts: jest.fn(),
  savePrompt: jest.fn(),
  deletePrompt: jest.fn(),
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
  }
];

describe('PromptManager Basic Tests', () => {
  const defaultProps = {
    configManager: mockConfigManager,
    onPromptSaved: jest.fn(),
    onClose: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigManager.getUserPrompts.mockResolvedValue(mockPrompts);
    mockConfigManager.savePrompt.mockResolvedValue(mockPrompts[0]);
    mockConfigManager.deletePrompt.mockResolvedValue(true);
    mockConfigManager.exportPrompts.mockResolvedValue('{"version":"1.0","prompts":[]}');
    mockConfigManager.importPrompts.mockResolvedValue([]);
    mockConfigManager.validatePrompt.mockReturnValue({ isValid: true, errors: [] });
  });

  test('should render prompt manager', async () => {
    render(<PromptManager {...defaultProps} />);

    expect(screen.getByText('Custom Summary Prompts')).toBeInTheDocument();
    expect(screen.getByLabelText('Close prompt manager')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Default Prompt')).toBeInTheDocument();
    });
  });

  test('should create new prompt', async () => {
    const user = userEvent.setup();
    render(<PromptManager {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('+ New Prompt')).toBeInTheDocument();
    });

    const newPromptButton = screen.getByText('+ New Prompt');
    await user.click(newPromptButton);

    expect(screen.getByText('New Prompt')).toBeInTheDocument();
  });

  test('should show export functionality', async () => {
    const user = userEvent.setup();
    
    render(<PromptManager {...defaultProps} />);

    const importExportButton = screen.getByText('Import/Export');
    await user.click(importExportButton);

    expect(screen.getByText('Export All Prompts')).toBeInTheDocument();
    expect(screen.getByText('Import Prompts')).toBeInTheDocument();
  });
});
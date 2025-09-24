import ConfigurationManager from '../ConfigurationManager.js';

describe('ConfigurationManager Enhanced Features', () => {
  let configManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
  });

  describe('Prompt Validation', () => {
    test('should validate valid prompt', () => {
      const validPrompt = {
        name: 'Valid Prompt',
        prompt: 'Valid content',
        description: 'Valid description',
        tags: ['tag1', 'tag2']
      };

      const result = configManager.validatePrompt(validPrompt);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject prompt without name', () => {
      const invalidPrompt = {
        prompt: 'Valid content'
      };

      const result = configManager.validatePrompt(invalidPrompt);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt name is required');
    });

    test('should reject prompt without content', () => {
      const invalidPrompt = {
        name: 'Valid Name',
        prompt: ''
      };

      const result = configManager.validatePrompt(invalidPrompt);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt content is required');
    });

    test('should reject prompt with content too long', () => {
      const invalidPrompt = {
        name: 'Valid Name',
        prompt: 'x'.repeat(10001)
      };

      const result = configManager.validatePrompt(invalidPrompt);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt content is too long (maximum 10,000 characters)');
    });

    test('should reject prompt with name too long', () => {
      const invalidPrompt = {
        name: 'x'.repeat(101),
        prompt: 'Valid content'
      };

      const result = configManager.validatePrompt(invalidPrompt);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt name is too long (maximum 100 characters)');
    });
  });

  describe('Import/Export', () => {
    test('should handle invalid import data', async () => {
      // Invalid JSON
      await expect(configManager.importPrompts('testuser', 'invalid json'))
        .rejects.toThrow('Invalid import data format');

      // Missing prompts array
      await expect(configManager.importPrompts('testuser', { version: '1.0' }))
        .rejects.toThrow('Import data must contain a prompts array');
    });

    test('should export prompts with correct format', async () => {
      const mockPrompts = [
        {
          id: 'prompt1',
          userId: 'testuser',
          name: 'Prompt 1',
          prompt: 'Content 1',
          description: 'Description 1',
          tags: ['tag1'],
          createdAt: '2023-01-01T00:00:00.000Z'
        }
      ];

      // Mock getUserPrompts
      configManager.getUserPrompts = jest.fn().mockResolvedValue(mockPrompts);

      const exportData = await configManager.exportPrompts('testuser');
      const parsed = JSON.parse(exportData);

      expect(parsed.version).toBe('1.0');
      expect(parsed.prompts).toHaveLength(1);
      expect(parsed.prompts[0].name).toBe('Prompt 1');
      expect(parsed.prompts[0]).not.toHaveProperty('id');
      expect(parsed.prompts[0]).not.toHaveProperty('userId');
    });
  });
});
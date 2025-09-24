import SummaryService from '../SummaryService.js';
import ConfigurationManager from '../ConfigurationManager.js';
import AgendaService from '../AgendaService.js';

// Mock the AI providers
jest.mock('../ai-providers/OpenAIProvider.js', () => {
  return jest.fn().mockImplementation(() => ({
    configure: jest.fn(),
    generateSummary: jest.fn(),
    testConnection: jest.fn()
  }));
});

jest.mock('../ai-providers/ClaudeProvider.js', () => {
  return jest.fn().mockImplementation(() => ({
    configure: jest.fn(),
    generateSummary: jest.fn(),
    testConnection: jest.fn()
  }));
});

jest.mock('../ai-providers/AzureOpenAIProvider.js', () => {
  return jest.fn().mockImplementation(() => ({
    configure: jest.fn(),
    generateSummary: jest.fn(),
    testConnection: jest.fn()
  }));
});

describe('SummaryService', () => {
  let summaryService;
  let mockConfigManager;
  let mockAgendaService;
  let mockTranscript;

  beforeEach(() => {
    summaryService = new SummaryService();
    
    // Mock configuration manager
    mockConfigManager = {
      getUserConfig: jest.fn(),
      getApiKey: jest.fn(),
      getUserPrompt: jest.fn(),
      getDefaultPrompt: jest.fn()
    };

    // Mock agenda service
    mockAgendaService = {
      getCurrentAgenda: jest.fn(),
      getAgendaTopics: jest.fn()
    };

    // Mock transcript
    mockTranscript = {
      meetingId: 'test-meeting-123',
      segments: [
        {
          id: 'seg1',
          speakerId: 'John Doe',
          text: 'Welcome everyone to our project review meeting.',
          startTime: 0,
          endTime: 5,
          confidence: 0.95
        },
        {
          id: 'seg2',
          speakerId: 'Jane Smith',
          text: 'Thanks John. Let me start with the project status update.',
          startTime: 5,
          endTime: 10,
          confidence: 0.92
        },
        {
          id: 'seg3',
          speakerId: 'John Doe',
          text: 'Great. We need to decide on the next milestone date.',
          startTime: 10,
          endTime: 15,
          confidence: 0.88
        }
      ]
    };

    summaryService.setConfigurationManager(mockConfigManager);
    summaryService.setAgendaService(mockAgendaService);
  });

  describe('Initialization', () => {
    test('should initialize with AI providers', () => {
      expect(summaryService.getAvailableProviders()).toContain('openai_gpt');
      expect(summaryService.getAvailableProviders()).toContain('claude');
      expect(summaryService.getAvailableProviders()).toContain('azure_openai');
    });

    test('should set configuration manager', () => {
      const configManager = new ConfigurationManager();
      summaryService.setConfigurationManager(configManager);
      expect(summaryService.configManager).toBe(configManager);
    });

    test('should set agenda service', () => {
      const agendaService = new AgendaService();
      summaryService.setAgendaService(agendaService);
      expect(summaryService.agendaService).toBe(agendaService);
    });
  });

  describe('Summary Generation', () => {
    beforeEach(() => {
      mockConfigManager.getUserConfig.mockResolvedValue({
        aiProvider: 'openai_gpt'
      });
      mockConfigManager.getApiKey.mockResolvedValue('test-api-key');
      mockConfigManager.getUserPrompt.mockResolvedValue('Test custom prompt');
      mockConfigManager.getDefaultPrompt.mockReturnValue('Default prompt');
    });

    test('should generate summary successfully', async () => {
      const mockProvider = summaryService.providers.get('openai_gpt');
      mockProvider.generateSummary.mockResolvedValue(`
        # Meeting Summary

        ## Key Discussion Points
        - Project status review
        - Milestone planning

        ## Decisions Made
        - Next milestone date set for next Friday

        ## Action Items
        - John will update project timeline
        - Jane will prepare status report
      `);

      const result = await summaryService.generateSummary(mockTranscript);

      expect(result).toBeDefined();
      expect(result.meetingId).toBe('test-meeting-123');
      expect(result.keyPoints).toContain('Project status review');
      expect(result.decisions).toContain('Next milestone date set for next Friday');
      expect(result.actionItems).toHaveLength(2);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.provider).toBe('openai_gpt');
    });

    test('should handle empty transcript', async () => {
      const emptyTranscript = { segments: [] };

      await expect(summaryService.generateSummary(emptyTranscript))
        .rejects.toThrow('Invalid or empty transcript provided');
    });

    test('should handle missing API key', async () => {
      mockConfigManager.getApiKey.mockResolvedValue(null);

      await expect(summaryService.generateSummary(mockTranscript))
        .rejects.toThrow('API key not configured');
    });

    test('should handle unsupported provider', async () => {
      mockConfigManager.getUserConfig.mockResolvedValue({
        aiProvider: 'unsupported_provider'
      });

      await expect(summaryService.generateSummary(mockTranscript))
        .rejects.toThrow('Unsupported AI provider');
    });

    test('should use custom prompt when available', async () => {
      const customPrompt = 'Custom summary prompt';
      mockConfigManager.getUserPrompt.mockResolvedValue(customPrompt);

      const mockProvider = summaryService.providers.get('openai_gpt');
      mockProvider.generateSummary.mockResolvedValue('Test summary');

      await summaryService.generateSummary(mockTranscript);

      expect(mockProvider.generateSummary).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(customPrompt)
      );
    });

    test('should include agenda context when available', async () => {
      const mockAgenda = {
        title: 'Project Review',
        items: [
          { title: 'Status Update', keywords: ['status', 'progress'] },
          { title: 'Milestone Planning', keywords: ['milestone', 'timeline'] }
        ],
        isFallback: false
      };

      mockAgendaService.getCurrentAgenda.mockReturnValue(mockAgenda);

      const mockProvider = summaryService.providers.get('openai_gpt');
      mockProvider.generateSummary.mockResolvedValue('Test summary');

      await summaryService.generateSummary(mockTranscript);

      expect(mockProvider.generateSummary).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Meeting Agenda:')
      );
    });
  });

  describe('Transcript Formatting', () => {
    test('should format transcript for AI processing', () => {
      const formatted = summaryService.formatTranscriptForAI(mockTranscript);

      expect(formatted).toContain('John Doe: Welcome everyone');
      expect(formatted).toContain('Jane Smith: Thanks John');
      expect(formatted).toContain('John Doe: Great. We need to decide');
    });

    test('should handle transcript with unknown speakers', () => {
      const transcriptWithUnknown = {
        segments: [
          { text: 'Hello everyone', speakerId: null },
          { text: 'Good morning', speakerId: 'John' }
        ]
      };

      const formatted = summaryService.formatTranscriptForAI(transcriptWithUnknown);

      expect(formatted).toContain('Unknown Speaker: Hello everyone');
      expect(formatted).toContain('John: Good morning');
    });
  });

  describe('Summary Parsing', () => {
    test('should parse structured AI summary', () => {
      const aiSummary = `
        # Meeting Summary

        ## Key Discussion Points
        - Project timeline review
        - Budget considerations
        - Team resource allocation

        ## Decisions Made
        - Approved additional budget for Q2
        - Extended project deadline by 2 weeks

        ## Action Items
        - John will update project plan by Friday
        - Sarah will coordinate with finance team
        - Team lead will schedule follow-up meeting

        ## Next Steps
        - Review updated timeline
        - Prepare budget proposal
      `;

      const parsed = summaryService.parseAISummary(aiSummary, mockTranscript);

      expect(parsed.keyPoints).toHaveLength(3);
      expect(parsed.keyPoints).toContain('Project timeline review');
      expect(parsed.decisions).toHaveLength(2);
      expect(parsed.decisions).toContain('Approved additional budget for Q2');
      expect(parsed.actionItems).toHaveLength(3);
      expect(parsed.nextSteps).toHaveLength(2);
    });

    test('should extract action items with assignees', () => {
      const aiSummary = `
        ## Action Items
        - John will update the project timeline by next Friday
        - Sarah assigned to coordinate with finance team
        - Review budget proposal (Mike)
        - @alice will prepare the presentation
      `;

      const parsed = summaryService.parseAISummary(aiSummary, mockTranscript);

      expect(parsed.actionItems).toHaveLength(4);
      expect(parsed.actionItems[0].assignee).toBe('John');
      expect(parsed.actionItems[1].assignee).toBe('Sarah');
      expect(parsed.actionItems[2].assignee).toBe('Mike');
      expect(parsed.actionItems[3].assignee).toBe('alice');
    });

    test('should extract due dates from action items', () => {
      const aiSummary = `
        ## Action Items
        - Complete report by next Friday
        - Submit proposal due March 15th
        - Review documents by 3/20/2024
        - Follow up next week
      `;

      const parsed = summaryService.parseAISummary(aiSummary, mockTranscript);

      expect(parsed.actionItems[0].dueDate).toBe('next Friday');
      expect(parsed.actionItems[1].dueDate).toBe('March 15th');
      expect(parsed.actionItems[2].dueDate).toBe('3/20/2024');
      expect(parsed.actionItems[3].dueDate).toBe('next week');
    });

    test('should identify action item priorities', () => {
      const aiSummary = `
        ## Action Items
        - Urgent: Fix critical bug in production
        - Important: Update documentation
        - Complete user testing asap
        - Regular task for next sprint
      `;

      const parsed = summaryService.parseAISummary(aiSummary, mockTranscript);

      expect(parsed.actionItems[0].priority).toBe('high');
      expect(parsed.actionItems[1].priority).toBe('medium');
      expect(parsed.actionItems[2].priority).toBe('high');
      expect(parsed.actionItems[3].priority).toBe('normal');
    });
  });

  describe('Agenda Integration', () => {
    test('should track agenda items in summary', () => {
      const mockAgenda = {
        items: [
          { id: 'item1', title: 'Project Status', keywords: ['project', 'status'] },
          { id: 'item2', title: 'Budget Review', keywords: ['budget', 'finance'] }
        ],
        isFallback: false
      };

      mockAgendaService.getCurrentAgenda.mockReturnValue(mockAgenda);

      const aiSummary = `
        We discussed the project status and current timeline.
        The budget review showed we're on track financially.
      `;

      const parsed = summaryService.parseAISummary(aiSummary, mockTranscript);

      expect(parsed.agendaItems).toHaveLength(2);
      expect(parsed.agendaItems[0].discussed).toBe(true);
      expect(parsed.agendaItems[1].discussed).toBe(true);
    });

    test('should handle agenda items not discussed', () => {
      const mockAgenda = {
        items: [
          { id: 'item1', title: 'Project Status', keywords: ['project', 'status'] },
          { id: 'item2', title: 'Marketing Plan', keywords: ['marketing', 'promotion'] }
        ],
        isFallback: false
      };

      mockAgendaService.getCurrentAgenda.mockReturnValue(mockAgenda);

      const aiSummary = `
        We discussed the project status and current timeline.
        No mention of marketing activities.
      `;

      const parsed = summaryService.parseAISummary(aiSummary, mockTranscript);

      expect(parsed.agendaItems[0].discussed).toBe(true);
      expect(parsed.agendaItems[1].discussed).toBe(false);
    });
  });

  describe('Provider Testing', () => {
    test('should test provider connection', async () => {
      const mockProvider = summaryService.providers.get('openai_gpt');
      mockProvider.testConnection.mockResolvedValue(true);

      const result = await summaryService.testProvider('openai_gpt', 'test-key');

      expect(result).toBe(true);
      expect(mockProvider.configure).toHaveBeenCalledWith({ apiKey: 'test-key' });
      expect(mockProvider.testConnection).toHaveBeenCalled();
    });

    test('should handle provider test failure', async () => {
      const mockProvider = summaryService.providers.get('openai_gpt');
      mockProvider.testConnection.mockRejectedValue(new Error('Connection failed'));

      const result = await summaryService.testProvider('openai_gpt', 'invalid-key');

      expect(result).toBe(false);
    });

    test('should handle invalid provider for testing', async () => {
      const result = await summaryService.testProvider('invalid_provider', 'test-key');

      expect(result).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    test('should extract speakers from transcript', () => {
      const speakers = summaryService.extractSpeakers(mockTranscript);

      expect(speakers).toContain('John Doe');
      expect(speakers).toContain('Jane Smith');
      expect(speakers).toHaveLength(2);
    });

    test('should calculate meeting duration', () => {
      const duration = summaryService.calculateMeetingDuration(mockTranscript);

      expect(duration).toBe(0); // 15 seconds = 0 minutes (rounded)
    });

    test('should get default model for provider', () => {
      expect(summaryService.getDefaultModel('openai_gpt')).toBe('gpt-4');
      expect(summaryService.getDefaultModel('claude')).toBe('claude-3-sonnet-20240229');
      expect(summaryService.getDefaultModel('azure_openai')).toBe('gpt-4');
      expect(summaryService.getDefaultModel('unknown')).toBe('gpt-4');
    });
  });

  describe('Error Handling', () => {
    test('should handle provider configuration errors', async () => {
      const mockProvider = summaryService.providers.get('openai_gpt');
      mockProvider.configure.mockRejectedValue(new Error('Invalid API key'));

      mockConfigManager.getUserConfig.mockResolvedValue({ aiProvider: 'openai_gpt' });
      mockConfigManager.getApiKey.mockResolvedValue('invalid-key');

      await expect(summaryService.generateSummary(mockTranscript))
        .rejects.toThrow('Summary generation failed');
    });

    test('should handle summary generation errors', async () => {
      const mockProvider = summaryService.providers.get('openai_gpt');
      mockProvider.generateSummary.mockRejectedValue(new Error('API rate limit'));

      await expect(summaryService.generateSummary(mockTranscript))
        .rejects.toThrow('Summary generation failed');
    });

    test('should handle parsing errors gracefully', () => {
      const invalidSummary = 'This is not a structured summary';
      
      const parsed = summaryService.parseAISummary(invalidSummary, mockTranscript);

      expect(parsed.rawSummary).toBe(invalidSummary);
      expect(parsed.keyPoints).toEqual([]);
      expect(parsed.decisions).toEqual([]);
      expect(parsed.actionItems).toEqual([]);
    });
  });
});
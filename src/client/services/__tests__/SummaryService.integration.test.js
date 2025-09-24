import SummaryService from '../SummaryService.js';
import ConfigurationManager from '../ConfigurationManager.js';
import AgendaService from '../AgendaService.js';

describe('SummaryService Integration', () => {
  let summaryService;
  let configManager;
  let agendaService;

  beforeEach(() => {
    summaryService = new SummaryService();
    configManager = new ConfigurationManager();
    agendaService = new AgendaService();

    summaryService.setConfigurationManager(configManager);
    summaryService.setAgendaService(agendaService);
  });

  describe('End-to-End Summary Generation', () => {
    test('should integrate all components for summary generation', async () => {
      // Mock the configuration manager methods
      jest.spyOn(configManager, 'getUserConfig').mockResolvedValue({
        aiProvider: 'openai_gpt'
      });
      jest.spyOn(configManager, 'getApiKey').mockResolvedValue('test-api-key');
      jest.spyOn(configManager, 'getUserPrompt').mockResolvedValue(null);
      jest.spyOn(configManager, 'getDefaultPrompt').mockReturnValue('Generate a meeting summary');

      // Mock the agenda service
      jest.spyOn(agendaService, 'getCurrentAgenda').mockReturnValue({
        title: 'Project Review Meeting',
        items: [
          { id: 'item1', title: 'Status Update', keywords: ['status', 'progress'] },
          { id: 'item2', title: 'Budget Review', keywords: ['budget', 'finance'] }
        ],
        isFallback: false
      });

      // Mock the OpenAI provider
      const mockProvider = summaryService.providers.get('openai_gpt');
      jest.spyOn(mockProvider, 'configure').mockResolvedValue();
      jest.spyOn(mockProvider, 'generateSummary').mockResolvedValue(`
        # Meeting Summary

        ## Key Discussion Points
        - Project status update completed
        - Budget review shows we're on track
        - Team discussed upcoming milestones

        ## Decisions Made
        - Approved additional resources for Q2
        - Decided to extend project timeline by 1 week

        ## Action Items
        - John will update project documentation by next Friday
        - Sarah assigned to coordinate with finance team
        - Review budget proposal (Mike)

        ## Next Steps
        - Schedule follow-up meeting
        - Prepare detailed timeline
      `);

      const transcript = {
        meetingId: 'test-meeting-123',
        segments: [
          {
            id: 'seg1',
            speakerId: 'John Doe',
            text: 'Let me give you a status update on our project progress.',
            startTime: 0,
            endTime: 5,
            confidence: 0.95
          },
          {
            id: 'seg2',
            speakerId: 'Sarah Smith',
            text: 'Thanks John. The budget review looks good so far.',
            startTime: 5,
            endTime: 10,
            confidence: 0.92
          }
        ]
      };

      const result = await summaryService.generateSummary(transcript);

      // Verify the result structure
      expect(result).toBeDefined();
      expect(result.meetingId).toBe('test-meeting-123');
      expect(result.keyPoints).toHaveLength(3);
      expect(result.decisions).toHaveLength(2);
      expect(result.actionItems).toHaveLength(3);
      expect(result.nextSteps).toHaveLength(2);
      expect(result.participants).toContain('John Doe');
      expect(result.participants).toContain('Sarah Smith');

      // Verify action items have proper structure
      expect(result.actionItems[0].task).toBe('John will update project documentation by next Friday');
      expect(result.actionItems[0].assignee).toBe('John');
      expect(result.actionItems[0].dueDate).toBe('next Friday');

      // Verify metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.provider).toBe('openai_gpt');
      expect(result.metadata.agendaFocused).toBe(true);

      // Verify provider was configured correctly
      expect(mockProvider.configure).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        model: 'gpt-4',
        temperature: 0.3,
        maxTokens: 2000
      });

      // Verify the prompt included agenda context
      const generateSummaryCall = mockProvider.generateSummary.mock.calls[0];
      expect(generateSummaryCall[1]).toContain('Meeting Agenda:');
      expect(generateSummaryCall[1]).toContain('Status Update');
      expect(generateSummaryCall[1]).toContain('Budget Review');
    });

    test('should handle summary generation without agenda', async () => {
      // Mock configuration
      jest.spyOn(configManager, 'getUserConfig').mockResolvedValue({
        aiProvider: 'claude'
      });
      jest.spyOn(configManager, 'getApiKey').mockResolvedValue('claude-api-key');
      jest.spyOn(configManager, 'getUserPrompt').mockResolvedValue('Custom prompt for Claude');

      // Mock agenda service returning fallback
      jest.spyOn(agendaService, 'getCurrentAgenda').mockReturnValue({
        isFallback: true
      });

      // Mock the Claude provider
      const mockProvider = summaryService.providers.get('claude');
      jest.spyOn(mockProvider, 'configure').mockResolvedValue();
      jest.spyOn(mockProvider, 'generateSummary').mockResolvedValue(`
        Meeting Summary:
        
        The team discussed various project topics and made several important decisions.
        Key action items were identified for follow-up.
      `);

      const transcript = {
        meetingId: 'test-meeting-456',
        segments: [
          {
            id: 'seg1',
            speakerId: 'Alice Johnson',
            text: 'Welcome everyone to our weekly sync.',
            startTime: 0,
            endTime: 3,
            confidence: 0.98
          }
        ]
      };

      const result = await summaryService.generateSummary(transcript);

      expect(result).toBeDefined();
      expect(result.meetingId).toBe('test-meeting-456');
      expect(result.rawSummary).toContain('The team discussed various project topics');
      expect(result.metadata.provider).toBe('claude');
      expect(result.metadata.agendaFocused).toBe(false);

      // Verify custom prompt was used
      const generateSummaryCall = mockProvider.generateSummary.mock.calls[0];
      expect(generateSummaryCall[1]).toContain('Custom prompt for Claude');
    });

    test('should format transcript correctly for AI processing', () => {
      const transcript = {
        segments: [
          { speakerId: 'John', text: 'Hello everyone.', startTime: 0, endTime: 2 },
          { speakerId: 'John', text: 'How is everyone doing today?', startTime: 2, endTime: 5 },
          { speakerId: 'Sarah', text: 'Good morning John.', startTime: 5, endTime: 7 },
          { speakerId: 'Sarah', text: 'I am doing well, thank you.', startTime: 7, endTime: 10 },
          { speakerId: 'Mike', text: 'Great to see everyone.', startTime: 10, endTime: 12 }
        ]
      };

      const formatted = summaryService.formatTranscriptForAI(transcript);

      expect(formatted).toBe(
        'John: Hello everyone. How is everyone doing today?\n\n' +
        'Sarah: Good morning John. I am doing well, thank you.\n\n' +
        'Mike: Great to see everyone.'
      );
    });

    test('should calculate meeting statistics correctly', () => {
      const transcript = {
        segments: [
          { startTime: 0, endTime: 300 }, // 5 minutes
          { startTime: 300, endTime: 600 }, // 5 minutes
          { startTime: 600, endTime: 900 } // 5 minutes
        ]
      };

      const duration = summaryService.calculateMeetingDuration(transcript);
      expect(duration).toBe(15); // 900 seconds = 15 minutes

      const speakers = summaryService.extractSpeakers({
        segments: [
          { speakerId: 'John' },
          { speakerId: 'Sarah' },
          { speakerId: 'John' },
          { speakerId: 'Mike' }
        ]
      });

      expect(speakers).toEqual(['John', 'Sarah', 'Mike']);
    });
  });

  describe('Provider Integration', () => {
    test('should work with different AI providers', async () => {
      const providers = ['openai_gpt', 'claude', 'azure_openai'];
      
      for (const providerName of providers) {
        // Mock configuration for each provider
        jest.spyOn(configManager, 'getUserConfig').mockResolvedValue({
          aiProvider: providerName
        });
        jest.spyOn(configManager, 'getApiKey').mockResolvedValue(`${providerName}-key`);
        jest.spyOn(configManager, 'getUserPrompt').mockResolvedValue(null);
        jest.spyOn(configManager, 'getDefaultPrompt').mockReturnValue('Test prompt');

        // Mock the provider
        const mockProvider = summaryService.providers.get(providerName);
        jest.spyOn(mockProvider, 'configure').mockResolvedValue();
        jest.spyOn(mockProvider, 'generateSummary').mockResolvedValue(`Summary from ${providerName}`);

        const transcript = {
          meetingId: `test-${providerName}`,
          segments: [{ speakerId: 'Test', text: 'Test content' }]
        };

        const result = await summaryService.generateSummary(transcript);

        expect(result.metadata.provider).toBe(providerName);
        expect(mockProvider.configure).toHaveBeenCalledWith(
          expect.objectContaining({
            apiKey: `${providerName}-key`
          })
        );

        // Clean up mocks for next iteration
        jest.restoreAllMocks();
      }
    });
  });
});
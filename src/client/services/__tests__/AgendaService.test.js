/**
 * Tests for AgendaService
 */

import AgendaService from '../AgendaService';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('AgendaService', () => {
  let agendaService;

  beforeEach(() => {
    agendaService = new AgendaService();
    fetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(agendaService.graphApiEndpoint).toBe('https://graph.microsoft.com/v1.0');
      expect(agendaService.accessToken).toBeNull();
      expect(agendaService.currentAgenda).toBeNull();
      expect(agendaService.agendaTopics).toEqual([]);
      expect(agendaService.trackedItems).toBeInstanceOf(Map);
    });
  });

  describe('setAccessToken', () => {
    test('should set access token', () => {
      const token = 'test-token-123';
      agendaService.setAccessToken(token);
      expect(agendaService.accessToken).toBe(token);
    });
  });

  describe('extractAgendaItems', () => {
    test('should extract numbered agenda items', () => {
      const bodyContent = `
        Meeting Agenda:
        1. Welcome and introductions
        2. Project status update
        3. Budget review
        4. Next steps
      `;

      const items = agendaService.extractAgendaItems(bodyContent);
      
      expect(items).toHaveLength(4);
      expect(items[0].title).toBe('Welcome and introductions');
      expect(items[1].title).toBe('Project status update');
      expect(items[2].title).toBe('Budget review');
      expect(items[3].title).toBe('Next steps');
    });

    test('should extract bullet point agenda items', () => {
      const bodyContent = `
        Topics to discuss:
        • Team performance review
        • New hiring plans
        • Office relocation
      `;

      const items = agendaService.extractAgendaItems(bodyContent);
      
      expect(items).toHaveLength(3);
      expect(items[0].title).toBe('Team performance review');
      expect(items[1].title).toBe('New hiring plans');
      expect(items[2].title).toBe('Office relocation');
    });

    test('should extract time-based agenda items', () => {
      const bodyContent = `
        Schedule:
        10:00 - Opening remarks
        10:15 - Product demo
        10:45 - Q&A session
        11:00 - Closing
      `;

      const items = agendaService.extractAgendaItems(bodyContent);
      
      expect(items).toHaveLength(4);
      expect(items[0].title).toBe('Opening remarks');
      expect(items[0].timeSlot).toBe('10:00');
      expect(items[1].title).toBe('Product demo');
      expect(items[1].timeSlot).toBe('10:15');
    });

    test('should handle HTML content', () => {
      const bodyContent = `
        <div>
          <h2>Agenda</h2>
          <ol>
            <li>1. Review last meeting</li>
            <li>2. Discuss new proposals</li>
          </ol>
        </div>
      `;

      const items = agendaService.extractAgendaItems(bodyContent);
      
      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('Review last meeting');
      expect(items[1].title).toBe('Discuss new proposals');
    });

    test('should return empty array for content without agenda items', () => {
      const bodyContent = 'This is just a regular meeting description without agenda.';
      const items = agendaService.extractAgendaItems(bodyContent);
      expect(items).toEqual([]);
    });
  });

  describe('extractKeywords', () => {
    test('should extract meaningful keywords', () => {
      const title = 'Project Status Update and Budget Review';
      const keywords = agendaService.extractKeywords(title);
      
      expect(keywords).toContain('project');
      expect(keywords).toContain('status');
      expect(keywords).toContain('update');
      expect(keywords).toContain('budget');
      expect(keywords).toContain('review');
      expect(keywords).not.toContain('and');
    });

    test('should filter out stop words', () => {
      const title = 'The team will discuss the new project';
      const keywords = agendaService.extractKeywords(title);
      
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('will');
      expect(keywords).toContain('team');
      expect(keywords).toContain('discuss');
      expect(keywords).toContain('new');
      expect(keywords).toContain('project');
    });

    test('should limit to 5 keywords', () => {
      const title = 'Very long agenda item with many different words and topics to discuss';
      const keywords = agendaService.extractKeywords(title);
      expect(keywords.length).toBeLessThanOrEqual(5);
    });
  });

  describe('estimateItemDuration', () => {
    test('should estimate short duration for quick items', () => {
      expect(agendaService.estimateItemDuration('Quick update')).toBe(5);
      expect(agendaService.estimateItemDuration('Brief overview')).toBe(5);
    });

    test('should estimate medium duration for reviews', () => {
      expect(agendaService.estimateItemDuration('Status review')).toBe(10);
      expect(agendaService.estimateItemDuration('Project update')).toBe(10);
    });

    test('should estimate longer duration for discussions', () => {
      expect(agendaService.estimateItemDuration('Team discussion')).toBe(20);
      expect(agendaService.estimateItemDuration('Planning session')).toBe(20);
    });

    test('should estimate presentation duration', () => {
      expect(agendaService.estimateItemDuration('Product presentation')).toBe(25);
      expect(agendaService.estimateItemDuration('Demo session')).toBe(25);
    });

    test('should return default duration for generic items', () => {
      expect(agendaService.estimateItemDuration('General topic')).toBe(15);
    });
  });

  describe('createFallbackAgenda', () => {
    test('should create fallback agenda', () => {
      const fallback = agendaService.createFallbackAgenda();
      
      expect(fallback.meetingId).toBe('unknown');
      expect(fallback.title).toBe('Meeting Discussion');
      expect(fallback.isFallback).toBe(true);
      expect(fallback.items).toHaveLength(1);
      expect(fallback.items[0].title).toBe('General Discussion');
    });
  });

  describe('trackAgendaProgress', () => {
    beforeEach(() => {
      // Set up a test agenda
      agendaService.currentAgenda = {
        meetingId: 'test-meeting',
        title: 'Test Meeting',
        items: [
          {
            id: 'item_1',
            title: 'Project Update',
            keywords: ['project', 'update', 'status']
          },
          {
            id: 'item_2',
            title: 'Budget Review',
            keywords: ['budget', 'review', 'financial']
          }
        ]
      };
      agendaService.agendaTopics = ['project', 'update', 'budget', 'review'];
    });

    test('should track agenda progress with keyword matches', () => {
      const transcription = 'We need to discuss the project status and current update';
      const result = agendaService.trackAgendaProgress(transcription);
      
      expect(result.currentItem).toBeTruthy();
      expect(result.currentItem.title).toBe('Project Update');
      expect(result.matchedTopics).toContain('project');
      expect(result.matchedTopics).toContain('update');
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should track multiple agenda items', () => {
      // First discuss project
      agendaService.trackAgendaProgress('Let\'s start with the project update');
      
      // Then discuss budget
      const result = agendaService.trackAgendaProgress('Now let\'s review the budget');
      
      expect(result.progress).toBe(100); // Both items discussed
      expect(agendaService.trackedItems.size).toBe(2);
    });

    test('should handle fallback agenda', () => {
      agendaService.currentAgenda = { isFallback: true };
      const result = agendaService.trackAgendaProgress('Any discussion');
      
      expect(result.currentItem).toBeNull();
      expect(result.progress).toBe(0);
      expect(result.matchedTopics).toEqual([]);
    });
  });

  describe('filterContentByAgenda', () => {
    beforeEach(() => {
      agendaService.currentAgenda = {
        items: [
          {
            id: 'item_1',
            title: 'Project Update',
            keywords: ['project', 'update']
          }
        ]
      };
      agendaService.agendaTopics = ['project', 'update'];
    });

    test('should identify relevant content', () => {
      const transcription = 'The project update shows good progress';
      const result = agendaService.filterContentByAgenda(transcription);
      
      expect(result.isRelevant).toBe(true);
      expect(result.relevanceScore).toBeGreaterThan(0.2);
      expect(result.matchedTopics).toContain('project');
      expect(result.matchedTopics).toContain('update');
    });

    test('should identify irrelevant content', () => {
      const transcription = 'How was your weekend? Nice weather today.';
      const result = agendaService.filterContentByAgenda(transcription);
      
      expect(result.isRelevant).toBe(false);
      expect(result.relevanceScore).toBeLessThanOrEqual(0.2);
      expect(result.matchedTopics).toEqual([]);
    });

    test('should suggest focus for low relevance', () => {
      const transcription = 'Random off-topic conversation';
      const result = agendaService.filterContentByAgenda(transcription);
      
      expect(result.suggestedFocus).toBeTruthy();
      expect(result.suggestedFocus.title).toBe('Project Update');
    });

    test('should handle fallback agenda', () => {
      agendaService.currentAgenda = { isFallback: true };
      const result = agendaService.filterContentByAgenda('Any content');
      
      expect(result.isRelevant).toBe(true);
      expect(result.relevanceScore).toBe(1.0);
      expect(result.suggestedFocus).toBeNull();
    });
  });

  describe('generateAgendaSummaryPrompt', () => {
    test('should generate agenda-focused prompt', () => {
      agendaService.currentAgenda = {
        items: [
          { title: 'Project Update' },
          { title: 'Budget Review' }
        ]
      };

      const prompt = agendaService.generateAgendaSummaryPrompt();
      
      expect(prompt).toContain('Project Update');
      expect(prompt).toContain('Budget Review');
      expect(prompt).toContain('agenda items');
    });

    test('should generate generic prompt for fallback agenda', () => {
      agendaService.currentAgenda = { isFallback: true };
      const prompt = agendaService.generateAgendaSummaryPrompt();
      
      expect(prompt).toContain('comprehensive summary');
      expect(prompt).toContain('Key discussion points');
      expect(prompt).not.toContain('agenda items');
    });

    test('should generate generic prompt when no agenda', () => {
      agendaService.currentAgenda = null;
      const prompt = agendaService.generateAgendaSummaryPrompt();
      
      expect(prompt).toContain('comprehensive summary');
    });
  });

  describe('fetchMeetingAgenda', () => {
    test('should return fallback when no access token', async () => {
      const agenda = await agendaService.fetchMeetingAgenda('test-meeting');
      
      expect(agenda.isFallback).toBe(true);
      expect(agenda.title).toBe('Meeting Discussion');
    });

    test('should handle API errors gracefully', async () => {
      agendaService.setAccessToken('test-token');
      
      // Mock failed API calls
      fetch.mockRejectedValue(new Error('Network error'));
      
      const agenda = await agendaService.fetchMeetingAgenda('test-meeting');
      
      expect(agenda.isFallback).toBe(true);
    });

    test('should parse successful API response', async () => {
      agendaService.setAccessToken('test-token');
      
      const mockMeetingData = {
        id: 'test-meeting',
        subject: 'Team Meeting',
        body: {
          content: '1. Project update\n2. Budget review'
        },
        start: { dateTime: '2023-01-01T10:00:00Z' },
        end: { dateTime: '2023-01-01T11:00:00Z' },
        organizer: { emailAddress: { name: 'John Doe' } }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMeetingData)
      });

      const agenda = await agendaService.fetchMeetingAgenda('test-meeting');
      
      expect(agenda.title).toBe('Team Meeting');
      expect(agenda.items).toHaveLength(2);
      expect(agenda.items[0].title).toBe('Project update');
      expect(agenda.items[1].title).toBe('Budget review');
    });
  });

  describe('calculateSimilarity', () => {
    test('should calculate similarity correctly', () => {
      expect(agendaService.calculateSimilarity('hello', 'hello')).toBe(1.0);
      expect(agendaService.calculateSimilarity('hello', 'helo')).toBeGreaterThan(0.5);
      expect(agendaService.calculateSimilarity('hello', 'world')).toBeLessThan(0.5);
      expect(agendaService.calculateSimilarity('', '')).toBe(1.0);
    });
  });

  describe('removeDuplicateItems', () => {
    test('should remove duplicate items', () => {
      const items = [
        { title: 'Project Update', keywords: [] },
        { title: 'project update', keywords: [] },
        { title: 'Budget Review', keywords: [] },
        { title: 'Project Status', keywords: [] }
      ];

      const unique = agendaService.removeDuplicateItems(items);
      
      expect(unique).toHaveLength(3);
      expect(unique.find(item => item.title === 'Project Update')).toBeTruthy();
      expect(unique.find(item => item.title === 'Budget Review')).toBeTruthy();
      expect(unique.find(item => item.title === 'Project Status')).toBeTruthy();
    });
  });

  describe('resetTracking', () => {
    test('should reset all tracking data', () => {
      // Set up some tracking data
      agendaService.currentAgenda = { title: 'Test' };
      agendaService.agendaTopics = ['test'];
      agendaService.trackedItems.set('item1', {});

      agendaService.resetTracking();

      expect(agendaService.currentAgenda).toBeNull();
      expect(agendaService.agendaTopics).toEqual([]);
      expect(agendaService.trackedItems.size).toBe(0);
    });
  });
});
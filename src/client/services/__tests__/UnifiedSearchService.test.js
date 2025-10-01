/**
 * Tests for UnifiedSearchService
 */

import UnifiedSearchService from '../UnifiedSearchService.js';

// Mock dependencies
const mockTranscriptStorage = {
  searchTranscriptsAcrossPlatforms: jest.fn(),
  getTranscript: jest.fn()
};

const mockSecurityManager = {
  checkSearchPermissions: jest.fn(),
  logActivity: jest.fn()
};

describe('UnifiedSearchService', () => {
  let searchService;

  beforeEach(() => {
    searchService = new UnifiedSearchService(mockTranscriptStorage, mockSecurityManager);
    jest.clearAllMocks();
  });

  describe('searchAcrossAllPlatforms', () => {
    it('should perform cross-platform search with basic query', async () => {
      const mockResults = [
        {
          id: 'transcript1',
          title: 'Teams Meeting',
          platform: 'teams',
          createdAt: new Date(),
          content: { segments: [{ text: 'action items discussion' }] },
          relevanceScore: 10
        },
        {
          id: 'transcript2',
          title: 'Zoom Call',
          platform: 'zoom',
          createdAt: new Date(),
          content: { segments: [{ text: 'project update meeting' }] },
          relevanceScore: 8
        }
      ];

      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue(mockResults);

      const result = await searchService.searchAcrossAllPlatforms('action items');

      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('metadata');
      expect(result.query.keywords).toContain('action');
      expect(result.query.keywords).toContain('items');
      expect(result.results).toHaveLength(2);
      expect(result.metadata.totalResults).toBe(2);
      expect(result.metadata.platforms).toEqual({ teams: 1, zoom: 1 });
    });

    it('should parse complex search query with filters', async () => {
      const query = 'meeting platform:teams date:2024-01-01..2024-01-31 participant:john "action items"';
      
      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue([]);

      const result = await searchService.searchAcrossAllPlatforms(query);

      expect(result.query.keywords).toContain('meeting');
      expect(result.query.keywords).toContain('action items');
      expect(result.query.filters.platforms).toContain('teams');
      expect(result.query.filters.participants).toContain('john');
      expect(result.query.filters.dateRange).toEqual({
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      });
    });

    it('should apply advanced filtering to results', async () => {
      const mockResults = [
        {
          id: 'transcript1',
          platform: 'teams',
          content: { 
            segments: [{ text: 'we need to assign tasks' }],
            participants: [{ name: 'John Doe' }]
          },
          platformMetadata: { duration: 1800 }
        },
        {
          id: 'transcript2',
          platform: 'zoom',
          content: { 
            segments: [{ text: 'general discussion' }],
            participants: [{ name: 'Jane Smith' }]
          },
          platformMetadata: { duration: 600 }
        }
      ];

      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue(mockResults);

      const result = await searchService.searchAcrossAllPlatforms('meeting', {
        participants: ['john'],
        minDuration: 1000,
        contentFilters: { hasActionItems: true }
      });

      // Should filter to only transcript1 (has John and action items, meets duration)
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('transcript1');
    });

    it('should enhance results with search metadata', async () => {
      const mockResults = [
        {
          id: 'transcript1',
          title: 'Project Meeting',
          platform: 'teams',
          content: { segments: [{ text: 'project update and action items' }] },
          platformMetadata: { hasAgenda: true, recordingId: 'rec-123' }
        }
      ];

      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue(mockResults);

      const result = await searchService.searchAcrossAllPlatforms('project action');

      const enhancedResult = result.results[0];
      expect(enhancedResult).toHaveProperty('searchMetadata');
      expect(enhancedResult.searchMetadata.matchedKeywords).toContain('project');
      expect(enhancedResult.searchMetadata.matchedKeywords).toContain('action');
      expect(enhancedResult.searchMetadata.platformSpecific.teamsSpecific.hasRecording).toBe(true);
      expect(enhancedResult.searchMetadata.contentPreview).toHaveProperty('text');
      expect(enhancedResult.searchMetadata.relevanceFactors).toContain('has_agenda');
      expect(enhancedResult.searchMetadata.relevanceFactors).toContain('has_recording');
    });

    it('should handle security permission denial', async () => {
      mockSecurityManager.checkSearchPermissions.mockRejectedValue(new Error('Access denied'));

      await expect(
        searchService.searchAcrossAllPlatforms('test query')
      ).rejects.toThrow('Unified search failed: Access denied');
    });

    it('should log search activity', async () => {
      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue([]);

      await searchService.searchAcrossAllPlatforms('test query', { userId: 'user123' });

      expect(mockSecurityManager.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'search',
          query: 'test query',
          resultCount: 0,
          userId: 'user123'
        })
      );
    });
  });

  describe('searchWithinPlatform', () => {
    it('should search within specific platform', async () => {
      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue([]);

      const result = await searchService.searchWithinPlatform('teams', 'meeting notes');

      expect(mockTranscriptStorage.searchTranscriptsAcrossPlatforms).toHaveBeenCalledWith(
        'meeting notes',
        expect.objectContaining({
          platforms: ['teams']
        })
      );
    });

    it('should throw error for unsupported platform', async () => {
      await expect(
        searchService.searchWithinPlatform('unsupported-platform', 'query')
      ).rejects.toThrow('Unsupported platform: unsupported-platform');
    });
  });

  describe('advancedSearch', () => {
    it('should perform advanced search with multiple criteria', async () => {
      const criteria = {
        keywords: 'project update',
        platforms: ['teams', 'zoom'],
        dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        participants: ['john', 'jane'],
        meetingTypes: ['scheduled'],
        hasRecording: true,
        hasAgenda: true,
        minDuration: 1800,
        actionItemsOnly: true
      };

      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue([]);

      const result = await searchService.advancedSearch(criteria);

      expect(mockTranscriptStorage.searchTranscriptsAcrossPlatforms).toHaveBeenCalledWith(
        expect.stringContaining('project update action items'),
        expect.objectContaining({
          platforms: ['teams', 'zoom'],
          dateRange: criteria.dateRange,
          participants: ['john', 'jane'],
          hasRecording: true,
          hasAgenda: true,
          minDuration: 1800
        })
      );
    });

    it('should add implicit keywords for action items search', async () => {
      const criteria = {
        keywords: 'meeting',
        actionItemsOnly: true
      };

      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue([]);

      await searchService.advancedSearch(criteria);

      expect(mockTranscriptStorage.searchTranscriptsAcrossPlatforms).toHaveBeenCalledWith(
        expect.stringContaining('action items decisions tasks'),
        expect.any(Object)
      );
    });

    it('should add implicit keywords for decisions search', async () => {
      const criteria = {
        keywords: 'meeting',
        decisionsOnly: true
      };

      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue([]);

      await searchService.advancedSearch(criteria);

      expect(mockTranscriptStorage.searchTranscriptsAcrossPlatforms).toHaveBeenCalledWith(
        expect.stringContaining('decision decided conclusion'),
        expect.any(Object)
      );
    });
  });

  describe('semanticSearch', () => {
    it('should perform semantic search with natural language query', async () => {
      const naturalQuery = 'Show me meetings from last week where we discussed action items';
      
      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue([
        {
          id: 'transcript1',
          title: 'Weekly Standup',
          platform: 'teams',
          relevanceScore: 10
        }
      ]);

      const result = await searchService.semanticSearch(naturalQuery);

      expect(result).toHaveProperty('searchType', 'semantic');
      expect(result).toHaveProperty('naturalLanguageQuery', naturalQuery);
      expect(result.results[0]).toHaveProperty('semanticScore');
    });

    it('should parse natural language for date ranges', async () => {
      const naturalQuery = 'meetings from last week';
      
      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue([]);

      await searchService.semanticSearch(naturalQuery);

      // Should have parsed "last week" into a date range
      const searchCall = mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mock.calls[0][1];
      expect(searchCall).toHaveProperty('dateRange');
      expect(searchCall.dateRange.start).toBeInstanceOf(Date);
    });

    it('should parse natural language for platform preferences', async () => {
      const naturalQuery = 'teams meetings about project updates';
      
      mockSecurityManager.checkSearchPermissions.mockResolvedValue(true);
      mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mockResolvedValue([]);

      await searchService.semanticSearch(naturalQuery);

      const searchCall = mockTranscriptStorage.searchTranscriptsAcrossPlatforms.mock.calls[0][1];
      expect(searchCall.platforms).toEqual(['teams']);
    });
  });

  describe('getSearchSuggestions', () => {
    beforeEach(() => {
      // Add some search history
      searchService.searchHistory = [
        { query: 'project meeting', timestamp: new Date(), resultCount: 5 },
        { query: 'action items review', timestamp: new Date(), resultCount: 3 },
        { query: 'team standup', timestamp: new Date(), resultCount: 8 }
      ];
    });

    it('should return keyword suggestions', async () => {
      const suggestions = await searchService.getSearchSuggestions('proj');

      expect(suggestions.keywords).toContain('project');
      expect(suggestions.platforms).toEqual([]);
      expect(suggestions.recentSearches).toContain('project meeting');
    });

    it('should return platform suggestions', async () => {
      const suggestions = await searchService.getSearchSuggestions('tea');

      expect(suggestions.platforms).toContain('teams');
      expect(suggestions.recentSearches).toContain('team standup');
    });

    it('should return recent searches matching query', async () => {
      const suggestions = await searchService.getSearchSuggestions('action');

      expect(suggestions.recentSearches).toContain('action items review');
      expect(suggestions.recentSearches).not.toContain('project meeting');
    });

    it('should limit suggestions appropriately', async () => {
      // Add many search history items
      const manySearches = Array.from({ length: 20 }, (_, i) => ({
        query: `search query ${i}`,
        timestamp: new Date(),
        resultCount: 1
      }));
      searchService.searchHistory = manySearches;

      const suggestions = await searchService.getSearchSuggestions('search');

      expect(suggestions.recentSearches.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getSearchAnalytics', () => {
    beforeEach(() => {
      const now = new Date();
      searchService.searchHistory = [
        { query: 'project meeting', timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000), resultCount: 5 },
        { query: 'action items', timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000), resultCount: 3 },
        { query: 'project meeting', timestamp: new Date(now - 1 * 24 * 60 * 60 * 1000), resultCount: 7 },
        { query: 'team standup', timestamp: new Date(now - 35 * 24 * 60 * 60 * 1000), resultCount: 0 }
      ];
    });

    it('should return search analytics for default time range', async () => {
      const analytics = await searchService.getSearchAnalytics();

      expect(analytics.totalSearches).toBe(4);
      expect(analytics.popularQueries).toContainEqual({ query: 'project meeting', count: 2 });
      expect(analytics.averageResultsPerSearch).toBeGreaterThan(0);
      expect(analytics.searchSuccessRate).toBeGreaterThan(0);
    });

    it('should filter analytics by time range', async () => {
      const analytics = await searchService.getSearchAnalytics('7d');

      // Should only include searches from last 7 days (3 searches)
      const recentSearches = searchService._getRecentSearches('7d');
      expect(recentSearches.length).toBe(3);
      expect(analytics.averageResultsPerSearch).toBe((5 + 3 + 7) / 3);
      expect(analytics.searchSuccessRate).toBe(1); // All recent searches had results
    });

    it('should handle empty search history', async () => {
      searchService.searchHistory = [];
      
      const analytics = await searchService.getSearchAnalytics();

      expect(analytics.totalSearches).toBe(0);
      expect(analytics.averageResultsPerSearch).toBe(0);
      expect(analytics.searchSuccessRate).toBe(0);
    });
  });

  describe('exportSearchResults', () => {
    it('should export search results as JSON', async () => {
      const searchResults = {
        query: { keywords: ['test'] },
        results: [
          {
            id: 'transcript1',
            title: 'Test Meeting',
            platform: 'teams',
            createdAt: new Date(),
            relevanceScore: 10,
            content: { summary: 'Meeting summary' },
            platformMetadata: { participantCount: 5, duration: 3600 }
          }
        ],
        metadata: { totalResults: 1 }
      };

      const exported = await searchService.exportSearchResults(searchResults, 'json');

      expect(exported.mimeType).toBe('application/json');
      expect(exported.filename).toMatch(/search-results-\d+\.json/);
      
      const data = JSON.parse(exported.data);
      expect(data.query).toEqual(searchResults.query);
      expect(data.results).toHaveLength(1);
      expect(data.results[0].title).toBe('Test Meeting');
      expect(data).toHaveProperty('exportedAt');
    });

    it('should export search results as CSV', async () => {
      const searchResults = {
        query: { keywords: ['test'] },
        results: [
          {
            id: 'transcript1',
            title: 'Test Meeting',
            platform: 'teams',
            createdAt: new Date('2024-01-01'),
            relevanceScore: 10,
            platformMetadata: { participantCount: 5, duration: 3600 }
          }
        ],
        metadata: { totalResults: 1 }
      };

      const exported = await searchService.exportSearchResults(searchResults, 'csv');

      expect(exported.mimeType).toBe('text/csv');
      expect(exported.filename).toMatch(/search-results-\d+\.csv/);
      expect(exported.data).toContain('Title,Platform,Date,Participants,Duration,Relevance Score');
      expect(exported.data).toContain('"Test Meeting","teams","2024-01-01",5,3600,10');
    });

    it('should handle CSV export with special characters', async () => {
      const searchResults = {
        query: { keywords: ['test'] },
        results: [
          {
            id: 'transcript1',
            title: 'Meeting with "quotes" and, commas',
            platform: 'teams',
            createdAt: new Date('2024-01-01'),
            relevanceScore: 8
          }
        ],
        metadata: { totalResults: 1 }
      };

      const exported = await searchService.exportSearchResults(searchResults, 'csv');

      expect(exported.data).toContain('"Meeting with ""quotes"" and, commas"');
    });

    it('should throw error for unsupported export format', async () => {
      const searchResults = { query: {}, results: [], metadata: {} };

      await expect(
        searchService.exportSearchResults(searchResults, 'unsupported')
      ).rejects.toThrow('Unsupported export format: unsupported');
    });
  });

  describe('Query parsing', () => {
    it('should parse quoted phrases correctly', () => {
      const query = 'meeting "action items" discussion "next steps"';
      const parsed = searchService._parseSearchQuery(query);

      expect(parsed.keywords).toContain('action items');
      expect(parsed.keywords).toContain('next steps');
      expect(parsed.keywords).toContain('meeting');
      expect(parsed.keywords).toContain('discussion');
    });

    it('should parse platform filters', () => {
      const query = 'meeting platform:teams platform:zoom';
      const parsed = searchService._parseSearchQuery(query);

      expect(parsed.filters.platforms).toContain('teams');
      expect(parsed.filters.platforms).toContain('zoom');
      expect(parsed.keywords).toContain('meeting');
    });

    it('should parse date range filters', () => {
      const query = 'meeting date:2024-01-01..2024-01-31';
      const parsed = searchService._parseSearchQuery(query);

      expect(parsed.filters.dateRange).toEqual({
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      });
      expect(parsed.keywords).toContain('meeting');
    });

    it('should parse participant filters', () => {
      const query = 'meeting participant:john participant:jane';
      const parsed = searchService._parseSearchQuery(query);

      expect(parsed.filters.participants).toContain('john');
      expect(parsed.filters.participants).toContain('jane');
      expect(parsed.keywords).toContain('meeting');
    });

    it('should handle complex queries with multiple filter types', () => {
      const query = 'project "action items" platform:teams date:2024-01-01..2024-01-31 participant:john';
      const parsed = searchService._parseSearchQuery(query);

      expect(parsed.keywords).toContain('project');
      expect(parsed.keywords).toContain('action items');
      expect(parsed.filters.platforms).toContain('teams');
      expect(parsed.filters.dateRange.start).toEqual(new Date('2024-01-01'));
      expect(parsed.filters.participants).toContain('john');
    });
  });

  describe('Content filtering', () => {
    it('should filter results for action items', async () => {
      const results = [
        {
          id: 'transcript1',
          content: { segments: [{ text: 'we need to assign tasks and follow up' }] }
        },
        {
          id: 'transcript2',
          content: { segments: [{ text: 'general discussion about weather' }] }
        }
      ];

      const filtered = await searchService._applyContentFilters(results, { hasActionItems: true });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('transcript1');
    });

    it('should filter results for decisions', async () => {
      const results = [
        {
          id: 'transcript1',
          content: { segments: [{ text: 'we decided to proceed with the project' }] }
        },
        {
          id: 'transcript2',
          content: { segments: [{ text: 'general discussion without conclusions' }] }
        }
      ];

      const filtered = await searchService._applyContentFilters(results, { hasDecisions: true });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('transcript1');
    });

    it('should filter results for questions', async () => {
      const results = [
        {
          id: 'transcript1',
          content: { segments: [{ text: 'What should we do next?' }] }
        },
        {
          id: 'transcript2',
          content: { segments: [{ text: 'I have a question about the timeline' }] }
        },
        {
          id: 'transcript3',
          content: { segments: [{ text: 'This is just a statement' }] }
        }
      ];

      const filtered = await searchService._applyContentFilters(results, { hasQuestions: true });

      expect(filtered).toHaveLength(2);
      expect(filtered.map(r => r.id)).toContain('transcript1');
      expect(filtered.map(r => r.id)).toContain('transcript2');
    });
  });

  describe('Search history management', () => {
    it('should add searches to history', () => {
      searchService._addToSearchHistory('test query', { userId: 'user123' }, 5);

      expect(searchService.searchHistory).toHaveLength(1);
      expect(searchService.searchHistory[0].query).toBe('test query');
      expect(searchService.searchHistory[0].resultCount).toBe(5);
      expect(searchService.searchHistory[0].options.userId).toBe('user123');
    });

    it('should limit search history size', () => {
      // Add more than 100 searches
      for (let i = 0; i < 105; i++) {
        searchService._addToSearchHistory(`query ${i}`, {}, 1);
      }

      expect(searchService.searchHistory).toHaveLength(100);
      expect(searchService.searchHistory[0].query).toBe('query 104'); // Most recent first
    });

    it('should sanitize sensitive options in history', () => {
      searchService._addToSearchHistory('test', {
        userId: 'user123',
        apiKey: 'secret',
        accessToken: 'token'
      }, 1);

      const historyEntry = searchService.searchHistory[0];
      expect(historyEntry.options).not.toHaveProperty('apiKey');
      expect(historyEntry.options).not.toHaveProperty('accessToken');
      expect(historyEntry.options).toHaveProperty('userId', 'user123');
    });
  });

  describe('Platform-specific search filters', () => {
    it('should apply Teams-specific enhancements', () => {
      const teamsFilter = searchService.searchFilters.get('teams');
      const enhancements = teamsFilter.getSearchEnhancements('query', { organizationId: 'org123' });

      expect(enhancements.includeChat).toBe(true);
      expect(enhancements.includeAgenda).toBe(true);
      expect(enhancements.organizationScope).toBe('org123');
    });

    it('should apply Zoom-specific enhancements', () => {
      const zoomFilter = searchService.searchFilters.get('zoom');
      const enhancements = zoomFilter.getSearchEnhancements('query', { includeBreakouts: true });

      expect(enhancements.includeRecordings).toBe(true);
      expect(enhancements.includeBreakoutRooms).toBe(true);
    });

    it('should apply Google Meet-specific enhancements', () => {
      const meetFilter = searchService.searchFilters.get('meet');
      const enhancements = meetFilter.getSearchEnhancements('query', {});

      expect(enhancements.includeCalendarData).toBe(true);
      expect(enhancements.driveIntegration).toBe(true);
    });

    it('should apply generic enhancements', () => {
      const genericFilter = searchService.searchFilters.get('generic');
      const enhancements = genericFilter.getSearchEnhancements('query', {});

      expect(enhancements.basicSearch).toBe(true);
    });
  });
});
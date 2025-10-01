/**
 * UnifiedSearchService - Provides unified search capabilities across all platforms
 * Enables searching transcripts from Teams, Zoom, Google Meet, and other platforms
 */

class UnifiedSearchService {
  constructor(transcriptStorageService, securityManager) {
    this.transcriptStorage = transcriptStorageService;
    this.securityManager = securityManager;
    this.searchFilters = new Map();
    this.searchHistory = [];
    this._initializeSearchFilters();
  }

  /**
   * Initialize platform-specific search filters
   */
  _initializeSearchFilters() {
    this.searchFilters.set('teams', new TeamsSearchFilter());
    this.searchFilters.set('zoom', new ZoomSearchFilter());
    this.searchFilters.set('meet', new MeetSearchFilter());
    this.searchFilters.set('generic', new GenericSearchFilter());
  }

  /**
   * Perform unified search across all platforms
   */
  async searchAcrossAllPlatforms(query, options = {}) {
    try {
      // Validate search permissions
      await this.securityManager.checkSearchPermissions(query, options);

      // Parse and enhance query
      const parsedQuery = this._parseSearchQuery(query);
      const searchOptions = this._buildSearchOptions(parsedQuery, options);

      // Perform cross-platform search
      const results = await this.transcriptStorage.searchTranscriptsAcrossPlatforms(
        parsedQuery.keywords.join(' '),
        searchOptions
      );

      // Apply advanced filtering
      const filteredResults = await this._applyAdvancedFiltering(results, parsedQuery, options);

      // Enhance results with search metadata
      const enhancedResults = await this._enhanceSearchResults(filteredResults, parsedQuery);

      // Log search activity
      await this._logSearchActivity(query, options, enhancedResults.length);

      // Store search in history
      this._addToSearchHistory(query, options, enhancedResults.length);

      return {
        query: parsedQuery,
        results: enhancedResults,
        metadata: {
          totalResults: enhancedResults.length,
          searchTime: Date.now() - searchOptions.startTime,
          platforms: this._getPlatformDistribution(enhancedResults),
          filters: searchOptions.activeFilters
        }
      };
    } catch (error) {
      throw new Error(`Unified search failed: ${error.message}`);
    }
  }

  /**
   * Search within specific platform
   */
  async searchWithinPlatform(platform, query, options = {}) {
    const platformFilter = this.searchFilters.get(platform);
    if (!platformFilter) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const enhancedOptions = {
      ...options,
      platforms: [platform],
      platformSpecific: platformFilter.getSearchEnhancements(query, options)
    };

    return this.searchAcrossAllPlatforms(query, enhancedOptions);
  }

  /**
   * Advanced search with multiple criteria
   */
  async advancedSearch(criteria) {
    const searchOptions = {
      platforms: criteria.platforms || ['teams', 'zoom', 'meet', 'generic'],
      dateRange: criteria.dateRange,
      participants: criteria.participants,
      meetingTypes: criteria.meetingTypes,
      hasRecording: criteria.hasRecording,
      hasAgenda: criteria.hasAgenda,
      organizationId: criteria.organizationId,
      tags: criteria.tags,
      minDuration: criteria.minDuration,
      maxDuration: criteria.maxDuration,
      speakerCount: criteria.speakerCount,
      contentFilters: criteria.contentFilters
    };

    let query = criteria.keywords || '';
    
    // Add implicit keywords from criteria
    if (criteria.actionItemsOnly) {
      query += ' action items decisions tasks';
    }
    if (criteria.decisionsOnly) {
      query += ' decision decided conclusion';
    }

    return this.searchAcrossAllPlatforms(query, searchOptions);
  }

  /**
   * Semantic search using AI-powered understanding
   */
  async semanticSearch(naturalLanguageQuery, options = {}) {
    try {
      // Convert natural language to search criteria
      const searchCriteria = await this._parseNaturalLanguageQuery(naturalLanguageQuery);
      
      // Perform advanced search with AI-enhanced criteria
      const results = await this.advancedSearch({
        ...searchCriteria,
        ...options,
        semanticSearch: true
      });

      // Re-rank results based on semantic relevance
      const rerankedResults = await this._reRankBySemantic(results.results, naturalLanguageQuery);

      return {
        ...results,
        results: rerankedResults,
        searchType: 'semantic',
        naturalLanguageQuery
      };
    } catch (error) {
      throw new Error(`Semantic search failed: ${error.message}`);
    }
  }

  /**
   * Get search suggestions based on query
   */
  async getSearchSuggestions(partialQuery, options = {}) {
    const suggestions = {
      keywords: [],
      platforms: [],
      participants: [],
      meetingTypes: [],
      recentSearches: []
    };

    // Keyword suggestions from search history
    suggestions.keywords = this._getKeywordSuggestions(partialQuery);

    // Platform suggestions
    suggestions.platforms = ['teams', 'zoom', 'meet'].filter(p => 
      p.includes(partialQuery.toLowerCase())
    );

    // Recent searches
    suggestions.recentSearches = this.searchHistory
      .filter(h => h.query.toLowerCase().includes(partialQuery.toLowerCase()))
      .slice(0, 5)
      .map(h => h.query);

    // Participant suggestions (from recent transcripts)
    if (partialQuery.length > 2) {
      suggestions.participants = await this._getParticipantSuggestions(partialQuery);
    }

    return suggestions;
  }

  /**
   * Get search analytics and insights
   */
  async getSearchAnalytics(timeRange = '30d') {
    const analytics = {
      totalSearches: this.searchHistory.length,
      popularQueries: this._getPopularQueries(timeRange),
      platformUsage: this._getPlatformSearchUsage(timeRange),
      searchTrends: this._getSearchTrends(timeRange),
      averageResultsPerSearch: 0,
      searchSuccessRate: 0
    };

    // Calculate averages
    const recentSearches = this._getRecentSearches(timeRange);
    if (recentSearches.length > 0) {
      analytics.averageResultsPerSearch = recentSearches.reduce((sum, s) => sum + s.resultCount, 0) / recentSearches.length;
      analytics.searchSuccessRate = recentSearches.filter(s => s.resultCount > 0).length / recentSearches.length;
    }

    return analytics;
  }

  /**
   * Export search results
   */
  async exportSearchResults(searchResults, format = 'json', options = {}) {
    const exportData = {
      query: searchResults.query,
      results: searchResults.results.map(result => ({
        id: result.id,
        title: result.title,
        platform: result.platform,
        createdAt: result.createdAt,
        relevanceScore: result.relevanceScore,
        summary: result.content?.summary || '',
        participants: result.platformMetadata?.participantCount || 0,
        duration: result.platformMetadata?.duration || 0
      })),
      metadata: searchResults.metadata,
      exportedAt: new Date()
    };

    switch (format) {
      case 'json':
        return {
          data: JSON.stringify(exportData, null, 2),
          mimeType: 'application/json',
          filename: `search-results-${Date.now()}.json`
        };
      
      case 'csv':
        return this._exportSearchResultsAsCSV(exportData);
      
      case 'xlsx':
        return this._exportSearchResultsAsExcel(exportData);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Parse search query into components
   */
  _parseSearchQuery(query) {
    const parsed = {
      keywords: [],
      operators: [],
      filters: {},
      modifiers: []
    };

    // Extract quoted phrases
    const quotedPhrases = query.match(/"([^"]+)"/g) || [];
    quotedPhrases.forEach(phrase => {
      parsed.keywords.push(phrase.replace(/"/g, ''));
      query = query.replace(phrase, '');
    });

    // Extract platform filters (platform:teams)
    const platformMatches = query.match(/platform:(\w+)/g) || [];
    platformMatches.forEach(match => {
      const platform = match.split(':')[1];
      parsed.filters.platforms = parsed.filters.platforms || [];
      parsed.filters.platforms.push(platform);
      query = query.replace(match, '');
    });

    // Extract date filters (date:2024-01-01..2024-01-31)
    const dateMatches = query.match(/date:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/g) || [];
    dateMatches.forEach(match => {
      const [, startDate, endDate] = match.match(/date:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/);
      parsed.filters.dateRange = { start: new Date(startDate), end: new Date(endDate) };
      query = query.replace(match, '');
    });

    // Extract participant filters (participant:john)
    const participantMatches = query.match(/participant:(\w+)/g) || [];
    participantMatches.forEach(match => {
      const participant = match.split(':')[1];
      parsed.filters.participants = parsed.filters.participants || [];
      parsed.filters.participants.push(participant);
      query = query.replace(match, '');
    });

    // Extract remaining keywords
    const remainingKeywords = query.trim().split(/\s+/).filter(k => k.length > 0);
    parsed.keywords.push(...remainingKeywords);

    return parsed;
  }

  /**
   * Build search options from parsed query
   */
  _buildSearchOptions(parsedQuery, options) {
    return {
      ...options,
      startTime: Date.now(),
      platforms: parsedQuery.filters.platforms || options.platforms || ['teams', 'zoom', 'meet', 'generic'],
      dateRange: parsedQuery.filters.dateRange || options.dateRange,
      participants: parsedQuery.filters.participants || options.participants,
      limit: options.limit || 50,
      activeFilters: Object.keys(parsedQuery.filters)
    };
  }

  /**
   * Apply advanced filtering to search results
   */
  async _applyAdvancedFiltering(results, parsedQuery, options) {
    let filtered = results;

    // Apply participant filtering
    if (parsedQuery.filters.participants) {
      filtered = filtered.filter(result => {
        const participants = result.content?.participants || [];
        return parsedQuery.filters.participants.some(p => 
          participants.some(participant => 
            participant.name?.toLowerCase().includes(p.toLowerCase())
          )
        );
      });
    }

    // Apply content-based filtering
    if (options.contentFilters) {
      filtered = await this._applyContentFilters(filtered, options.contentFilters);
    }

    // Apply duration filtering
    if (options.minDuration || options.maxDuration) {
      filtered = filtered.filter(result => {
        const duration = result.platformMetadata?.duration || 0;
        if (options.minDuration && duration < options.minDuration) return false;
        if (options.maxDuration && duration > options.maxDuration) return false;
        return true;
      });
    }

    return filtered;
  }

  /**
   * Apply content-based filters
   */
  async _applyContentFilters(results, contentFilters) {
    return results.filter(result => {
      const content = result.content;
      if (!content || !content.segments) return false;

      const text = content.segments.map(s => s.text).join(' ').toLowerCase();

      // Check for action items
      if (contentFilters.hasActionItems) {
        const actionKeywords = ['action', 'task', 'todo', 'follow up', 'assign', 'responsible'];
        if (!actionKeywords.some(keyword => text.includes(keyword))) return false;
      }

      // Check for decisions
      if (contentFilters.hasDecisions) {
        const decisionKeywords = ['decide', 'decision', 'conclude', 'agree', 'approve'];
        if (!decisionKeywords.some(keyword => text.includes(keyword))) return false;
      }

      // Check for questions
      if (contentFilters.hasQuestions) {
        if (!text.includes('?') && !text.includes('question')) return false;
      }

      return true;
    });
  }

  /**
   * Enhance search results with additional metadata
   */
  async _enhanceSearchResults(results, parsedQuery) {
    return results.map(result => ({
      ...result,
      searchMetadata: {
        matchedKeywords: this._getMatchedKeywords(result, parsedQuery.keywords),
        platformSpecific: this._getPlatformSpecificMetadata(result),
        contentPreview: this._generateContentPreview(result, parsedQuery.keywords),
        relevanceFactors: this._getRelevanceFactors(result, parsedQuery)
      }
    }));
  }

  /**
   * Get matched keywords in result
   */
  _getMatchedKeywords(result, keywords) {
    const text = [
      result.title,
      result.content?.segments?.map(s => s.text).join(' ') || ''
    ].join(' ').toLowerCase();

    return keywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );
  }

  /**
   * Get platform-specific metadata for search result
   */
  _getPlatformSpecificMetadata(result) {
    const metadata = {
      platform: result.platform,
      capabilities: result.sharingCapabilities || {}
    };

    switch (result.platform) {
      case 'teams':
        metadata.teamsSpecific = {
          hasChat: !!result.platformMetadata?.chatThreadId,
          hasRecording: !!result.platformMetadata?.recordingId,
          organizationId: result.platformMetadata?.organizationId
        };
        break;
      
      case 'zoom':
        metadata.zoomSpecific = {
          hasRecording: !!result.platformMetadata?.recordingId,
          isBreakout: result.platformMetadata?.isBreakoutRoom || false,
          meetingId: result.platformMetadata?.zoomMeetingId
        };
        break;
      
      case 'meet':
        metadata.meetSpecific = {
          hasCalendar: !!result.platformMetadata?.calendarEventId,
          meetCode: result.platformMetadata?.meetCode
        };
        break;
    }

    return metadata;
  }

  /**
   * Generate content preview with highlighted keywords
   */
  _generateContentPreview(result, keywords) {
    if (!result.content || !result.content.segments) {
      return { text: '', highlights: [] };
    }

    const text = result.content.segments.map(s => s.text).join(' ');
    const maxLength = 200;
    
    // Find best snippet containing keywords
    let bestSnippet = text.substring(0, maxLength);
    let bestScore = 0;

    for (let i = 0; i < text.length - maxLength; i += 50) {
      const snippet = text.substring(i, i + maxLength);
      const score = keywords.reduce((sum, keyword) => {
        return sum + (snippet.toLowerCase().includes(keyword.toLowerCase()) ? 1 : 0);
      }, 0);
      
      if (score > bestScore) {
        bestScore = score;
        bestSnippet = snippet;
      }
    }

    // Add ellipsis if truncated
    if (bestSnippet.length < text.length) {
      bestSnippet = '...' + bestSnippet + '...';
    }

    return {
      text: bestSnippet,
      highlights: keywords.filter(k => 
        bestSnippet.toLowerCase().includes(k.toLowerCase())
      )
    };
  }

  /**
   * Get relevance factors for result
   */
  _getRelevanceFactors(result, parsedQuery) {
    const factors = [];

    if (result.title.toLowerCase().includes(parsedQuery.keywords.join(' ').toLowerCase())) {
      factors.push('title_match');
    }

    if (result.platformMetadata?.hasAgenda) {
      factors.push('has_agenda');
    }

    if (result.platformMetadata?.recordingId) {
      factors.push('has_recording');
    }

    const daysSinceCreation = (Date.now() - new Date(result.createdAt)) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 7) {
      factors.push('recent');
    }

    if (result.size > 10000) {
      factors.push('substantial_content');
    }

    return factors;
  }

  /**
   * Parse natural language query using AI
   */
  async _parseNaturalLanguageQuery(query) {
    // This would integrate with an AI service to understand natural language
    // For now, return a basic interpretation
    const criteria = {
      keywords: query.toLowerCase().split(' ').filter(w => w.length > 2)
    };

    // Simple pattern matching for common phrases
    if (query.toLowerCase().includes('last week')) {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      criteria.dateRange = { start: lastWeek, end: new Date() };
    }

    if (query.toLowerCase().includes('action items')) {
      criteria.actionItemsOnly = true;
    }

    if (query.toLowerCase().includes('decisions')) {
      criteria.decisionsOnly = true;
    }

    if (query.toLowerCase().includes('teams')) {
      criteria.platforms = ['teams'];
    } else if (query.toLowerCase().includes('zoom')) {
      criteria.platforms = ['zoom'];
    } else if (query.toLowerCase().includes('meet')) {
      criteria.platforms = ['meet'];
    }

    return criteria;
  }

  /**
   * Re-rank results based on semantic relevance
   */
  async _reRankBySemantic(results, naturalLanguageQuery) {
    // This would use AI to understand semantic similarity
    // For now, return results with adjusted scores
    return results.map(result => ({
      ...result,
      semanticScore: result.relevanceScore * (1 + Math.random() * 0.2) // Placeholder
    })).sort((a, b) => b.semanticScore - a.semanticScore);
  }

  /**
   * Get platform distribution of results
   */
  _getPlatformDistribution(results) {
    const distribution = {};
    results.forEach(result => {
      distribution[result.platform] = (distribution[result.platform] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Log search activity
   */
  async _logSearchActivity(query, options, resultCount) {
    const logEntry = {
      type: 'search',
      query,
      options: this._sanitizeOptions(options),
      resultCount,
      timestamp: new Date(),
      userId: options.userId
    };

    if (this.securityManager && this.securityManager.logActivity) {
      await this.securityManager.logActivity(logEntry);
    }
  }

  /**
   * Add search to history
   */
  _addToSearchHistory(query, options, resultCount) {
    this.searchHistory.unshift({
      query,
      options: this._sanitizeOptions(options),
      resultCount,
      timestamp: new Date()
    });

    // Keep only last 100 searches
    if (this.searchHistory.length > 100) {
      this.searchHistory = this.searchHistory.slice(0, 100);
    }
  }

  /**
   * Get keyword suggestions from search history
   */
  _getKeywordSuggestions(partialQuery) {
    const suggestions = new Set();
    
    this.searchHistory.forEach(search => {
      const words = search.query.toLowerCase().split(' ');
      words.forEach(word => {
        if (word.startsWith(partialQuery.toLowerCase()) && word.length > partialQuery.length) {
          suggestions.add(word);
        }
      });
    });

    return Array.from(suggestions).slice(0, 10);
  }

  /**
   * Get participant suggestions
   */
  async _getParticipantSuggestions(partialQuery) {
    // This would query the transcript storage for participant names
    // For now, return empty array
    return [];
  }

  /**
   * Export search results as CSV
   */
  _exportSearchResultsAsCSV(exportData) {
    let csv = 'Title,Platform,Date,Participants,Duration,Relevance Score\n';
    
    exportData.results.forEach(result => {
      const title = (result.title || '').replace(/"/g, '""');
      const platform = result.platform || '';
      const date = new Date(result.createdAt).toISOString().split('T')[0];
      const participants = result.participants || 0;
      const duration = result.duration || 0;
      const score = result.relevanceScore || 0;
      
      csv += `"${title}","${platform}","${date}",${participants},${duration},${score}\n`;
    });

    return {
      data: csv,
      mimeType: 'text/csv',
      filename: `search-results-${Date.now()}.csv`
    };
  }

  /**
   * Export search results as Excel (placeholder)
   */
  _exportSearchResultsAsExcel(exportData) {
    // Would use a library like xlsx to create Excel file
    // For now, return CSV format
    return this._exportSearchResultsAsCSV(exportData);
  }

  /**
   * Sanitize options for logging
   */
  _sanitizeOptions(options) {
    const sanitized = { ...options };
    delete sanitized.apiKey;
    delete sanitized.accessToken;
    delete sanitized.password;
    return sanitized;
  }

  /**
   * Get popular queries from search history
   */
  _getPopularQueries(timeRange) {
    const cutoffDate = this._getTimeRangeCutoff(timeRange);
    const recentSearches = this.searchHistory.filter(s => new Date(s.timestamp) > cutoffDate);
    
    const queryCount = {};
    recentSearches.forEach(search => {
      queryCount[search.query] = (queryCount[search.query] || 0) + 1;
    });

    return Object.entries(queryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
  }

  /**
   * Get platform search usage
   */
  _getPlatformSearchUsage(timeRange) {
    const cutoffDate = this._getTimeRangeCutoff(timeRange);
    const recentSearches = this.searchHistory.filter(s => new Date(s.timestamp) > cutoffDate);
    
    const platformUsage = {};
    recentSearches.forEach(search => {
      const platforms = search.options.platforms || ['all'];
      platforms.forEach(platform => {
        platformUsage[platform] = (platformUsage[platform] || 0) + 1;
      });
    });

    return platformUsage;
  }

  /**
   * Get search trends over time
   */
  _getSearchTrends(timeRange) {
    const cutoffDate = this._getTimeRangeCutoff(timeRange);
    const recentSearches = this.searchHistory.filter(s => new Date(s.timestamp) > cutoffDate);
    
    // Group by day
    const dailySearches = {};
    recentSearches.forEach(search => {
      const day = new Date(search.timestamp).toISOString().split('T')[0];
      dailySearches[day] = (dailySearches[day] || 0) + 1;
    });

    return Object.entries(dailySearches)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }

  /**
   * Get recent searches within time range
   */
  _getRecentSearches(timeRange) {
    const cutoffDate = this._getTimeRangeCutoff(timeRange);
    return this.searchHistory.filter(s => new Date(s.timestamp) > cutoffDate);
  }

  /**
   * Get cutoff date for time range
   */
  _getTimeRangeCutoff(timeRange) {
    const now = new Date();
    const days = parseInt(timeRange.replace('d', ''));
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff;
  }
}

/**
 * Base search filter for platform-specific enhancements
 */
class BaseSearchFilter {
  getSearchEnhancements(query, options) {
    return {};
  }
}

/**
 * Teams-specific search filter
 */
class TeamsSearchFilter extends BaseSearchFilter {
  getSearchEnhancements(query, options) {
    return {
      includeChat: true,
      includeAgenda: true,
      organizationScope: options.organizationId
    };
  }
}

/**
 * Zoom-specific search filter
 */
class ZoomSearchFilter extends BaseSearchFilter {
  getSearchEnhancements(query, options) {
    return {
      includeRecordings: true,
      includeBreakoutRooms: options.includeBreakouts || false
    };
  }
}

/**
 * Google Meet-specific search filter
 */
class MeetSearchFilter extends BaseSearchFilter {
  getSearchEnhancements(query, options) {
    return {
      includeCalendarData: true,
      driveIntegration: true
    };
  }
}

/**
 * Generic search filter
 */
class GenericSearchFilter extends BaseSearchFilter {
  getSearchEnhancements(query, options) {
    return {
      basicSearch: true
    };
  }
}

export default UnifiedSearchService;
/**
 * Agenda Service - Handles meeting agenda integration with Microsoft Graph API
 * Provides agenda fetching, parsing, topic extraction, and content filtering
 */

class AgendaService {
  constructor() {
    this.graphApiEndpoint = 'https://graph.microsoft.com/v1.0';
    this.accessToken = null;
    this.currentAgenda = null;
    this.agendaTopics = [];
    this.trackedItems = new Map();
  }

  /**
   * Set access token for Microsoft Graph API
   * @param {string} token - Access token for Graph API
   */
  setAccessToken(token) {
    this.accessToken = token;
  }

  /**
   * Fetch meeting agenda from Microsoft Graph API
   * @param {string} meetingId - Teams meeting ID
   * @returns {Promise<Object|null>} Meeting agenda or null if not available
   */
  async fetchMeetingAgenda(meetingId) {
    try {
      if (!this.accessToken) {
        console.warn('No access token available for Graph API');
        return this.createFallbackAgenda();
      }

      // First try to get the meeting details
      const meetingDetails = await this.getMeetingDetails(meetingId);
      if (!meetingDetails) {
        return this.createFallbackAgenda();
      }

      // Extract agenda from meeting body or description
      const agenda = this.parseAgendaFromMeetingDetails(meetingDetails);
      
      if (agenda && agenda.items.length > 0) {
        this.currentAgenda = agenda;
        this.agendaTopics = this.extractTopicsFromAgenda(agenda);
        console.log('Meeting agenda fetched successfully:', agenda);
        return agenda;
      }

      return this.createFallbackAgenda();
    } catch (error) {
      console.error('Error fetching meeting agenda:', error);
      return this.createFallbackAgenda();
    }
  }

  /**
   * Get meeting details from Microsoft Graph API
   * @param {string} meetingId - Teams meeting ID
   * @returns {Promise<Object|null>} Meeting details
   */
  async getMeetingDetails(meetingId) {
    try {
      // Try different Graph API endpoints to get meeting information
      const endpoints = [
        `/me/events/${meetingId}`,
        `/me/calendar/events/${meetingId}`,
        `/me/onlineMeetings/${meetingId}`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${this.graphApiEndpoint}${endpoint}`, {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const meetingData = await response.json();
            console.log('Meeting details fetched from:', endpoint);
            return meetingData;
          }
        } catch (endpointError) {
          console.warn(`Failed to fetch from ${endpoint}:`, endpointError.message);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting meeting details:', error);
      return null;
    }
  }

  /**
   * Parse agenda from meeting details
   * @param {Object} meetingDetails - Meeting details from Graph API
   * @returns {Object} Parsed agenda
   */
  parseAgendaFromMeetingDetails(meetingDetails) {
    try {
      const agenda = {
        meetingId: meetingDetails.id,
        title: meetingDetails.subject || 'Meeting',
        description: meetingDetails.body?.content || '',
        startTime: new Date(meetingDetails.start?.dateTime),
        endTime: new Date(meetingDetails.end?.dateTime),
        organizer: meetingDetails.organizer?.emailAddress?.name,
        items: []
      };

      // Extract agenda items from meeting body/description
      const bodyContent = meetingDetails.body?.content || '';
      agenda.items = this.extractAgendaItems(bodyContent);

      // If no agenda items found in body, try to extract from subject
      if (agenda.items.length === 0) {
        agenda.items = this.extractAgendaFromSubject(meetingDetails.subject);
      }

      return agenda;
    } catch (error) {
      console.error('Error parsing agenda from meeting details:', error);
      return this.createFallbackAgenda();
    }
  }

  /**
   * Extract agenda items from meeting body content
   * @param {string} bodyContent - Meeting body content (HTML or text)
   * @returns {Array} Array of agenda items
   */
  extractAgendaItems(bodyContent) {
    const items = [];
    
    try {
      // Remove HTML tags if present
      const textContent = bodyContent.replace(/<[^>]*>/g, '');
      
      let itemIndex = 1;
      
      // Try numbered lists first: 1. Item, 2. Item
      const numberedMatches = [...textContent.matchAll(/(?:^|\n)\s*(\d+)[\.\)]\s*([^\n\r]+)/gm)];
      if (numberedMatches.length > 0) {
        for (const match of numberedMatches) {
          const title = match[2]?.trim();
          if (title && title.length > 3) {
            items.push({
              id: `item_${itemIndex}`,
              title: title,
              description: '',
              estimatedDuration: this.estimateItemDuration(title),
              timeSlot: undefined,
              keywords: this.extractKeywords(title),
              status: 'pending'
            });
            itemIndex++;
          }
        }
      }
      
      // If no numbered items, try bullet points: • Item, - Item, * Item
      if (items.length === 0) {
        const bulletMatches = [...textContent.matchAll(/(?:^|\n)\s*[•\-\*]\s*([^\n\r]+)/gm)];
        for (const match of bulletMatches) {
          const title = match[1]?.trim();
          if (title && title.length > 3) {
            items.push({
              id: `item_${itemIndex}`,
              title: title,
              description: '',
              estimatedDuration: this.estimateItemDuration(title),
              timeSlot: undefined,
              keywords: this.extractKeywords(title),
              status: 'pending'
            });
            itemIndex++;
          }
        }
      }
      
      // If still no items, try time-based items: 10:00 - Topic
      if (items.length === 0) {
        const timeMatches = [...textContent.matchAll(/(?:^|\n)\s*(\d{1,2}:\d{2})\s*[-–]\s*([^\n\r]+)/gm)];
        for (const match of timeMatches) {
          const timeSlot = match[1]?.trim();
          const title = match[2]?.trim();
          if (title && title.length > 3) {
            items.push({
              id: `item_${itemIndex}`,
              title: title,
              description: '',
              estimatedDuration: this.estimateItemDuration(title),
              timeSlot: timeSlot,
              keywords: this.extractKeywords(title),
              status: 'pending'
            });
            itemIndex++;
          }
        }
      }

      // Remove duplicates based on title similarity
      return this.removeDuplicateItems(items);
    } catch (error) {
      console.error('Error extracting agenda items:', error);
      return [];
    }
  }

  /**
   * Extract agenda from meeting subject if no body content
   * @param {string} subject - Meeting subject
   * @returns {Array} Array of agenda items
   */
  extractAgendaFromSubject(subject) {
    if (!subject) return [];

    // Create a single agenda item from the subject
    return [{
      id: 'item_1',
      title: subject,
      description: 'Main meeting topic',
      estimatedDuration: 30,
      keywords: this.extractKeywords(subject),
      status: 'pending'
    }];
  }

  /**
   * Extract keywords from agenda item title
   * @param {string} title - Agenda item title
   * @returns {Array} Array of keywords
   */
  extractKeywords(title) {
    // Remove common stop words and extract meaningful keywords
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
    ]);

    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5); // Limit to top 5 keywords
  }

  /**
   * Estimate duration for agenda item based on content
   * @param {string} title - Agenda item title
   * @returns {number} Estimated duration in minutes
   */
  estimateItemDuration(title) {
    const keywords = title.toLowerCase();
    
    // Duration hints in the title
    if (keywords.includes('quick') || keywords.includes('brief')) return 5;
    if (keywords.includes('review') || keywords.includes('update')) return 10;
    if (keywords.includes('discussion') || keywords.includes('planning')) return 20;
    if (keywords.includes('presentation') || keywords.includes('demo')) return 25;
    if (keywords.includes('workshop') || keywords.includes('training')) return 45;
    
    // Default duration
    return 15;
  }

  /**
   * Remove duplicate agenda items based on title similarity
   * @param {Array} items - Array of agenda items
   * @returns {Array} Deduplicated items
   */
  removeDuplicateItems(items) {
    const uniqueItems = [];
    const seenTitles = new Set();

    for (const item of items) {
      const normalizedTitle = item.title.toLowerCase().trim();
      
      // Check for exact matches or very similar titles
      let isDuplicate = false;
      for (const seenTitle of seenTitles) {
        if (this.calculateSimilarity(normalizedTitle, seenTitle) > 0.8) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueItems.push(item);
        seenTitles.add(normalizedTitle);
      }
    }

    return uniqueItems;
  }

  /**
   * Calculate similarity between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Extract topics from agenda for content filtering
   * @param {Object} agenda - Meeting agenda
   * @returns {Array} Array of topics/keywords
   */
  extractTopicsFromAgenda(agenda) {
    const topics = new Set();
    
    // Add keywords from agenda title
    if (agenda.title) {
      this.extractKeywords(agenda.title).forEach(keyword => topics.add(keyword));
    }

    // Add keywords from each agenda item
    agenda.items.forEach(item => {
      item.keywords.forEach(keyword => topics.add(keyword));
      
      // Add the item title as a topic
      topics.add(item.title.toLowerCase());
    });

    return Array.from(topics);
  }

  /**
   * Create fallback agenda when no agenda is available
   * @returns {Object} Fallback agenda
   */
  createFallbackAgenda() {
    return {
      meetingId: 'unknown',
      title: 'Meeting Discussion',
      description: 'No agenda available',
      items: [{
        id: 'fallback_1',
        title: 'General Discussion',
        description: 'Open discussion topics',
        estimatedDuration: 30,
        keywords: ['discussion', 'meeting', 'topics'],
        status: 'pending'
      }],
      isFallback: true
    };
  }

  /**
   * Track agenda item progress during transcription
   * @param {string} transcriptionText - Current transcription text
   * @returns {Object} Tracking results
   */
  trackAgendaProgress(transcriptionText) {
    if (!this.currentAgenda || this.currentAgenda.isFallback) {
      return { currentItem: null, progress: 0, matchedTopics: [] };
    }

    const text = transcriptionText.toLowerCase();
    const matchedTopics = [];
    let bestMatch = null;
    let highestScore = 0;

    // Check which agenda topics are being discussed
    for (const topic of this.agendaTopics) {
      if (text.includes(topic)) {
        matchedTopics.push(topic);
      }
    }

    // Find the agenda item with the highest keyword match
    for (const item of this.currentAgenda.items) {
      let score = 0;
      
      for (const keyword of item.keywords) {
        if (text.includes(keyword)) {
          score += 1;
        }
      }

      // Check for title match
      if (text.includes(item.title.toLowerCase())) {
        score += 2;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }
    }

    // Update tracking
    if (bestMatch) {
      this.trackedItems.set(bestMatch.id, {
        item: bestMatch,
        lastMentioned: new Date(),
        mentionCount: (this.trackedItems.get(bestMatch.id)?.mentionCount || 0) + 1
      });
    }

    return {
      currentItem: bestMatch,
      progress: this.calculateAgendaProgress(),
      matchedTopics: matchedTopics,
      confidence: highestScore
    };
  }

  /**
   * Calculate overall agenda progress
   * @returns {number} Progress percentage (0-100)
   */
  calculateAgendaProgress() {
    if (!this.currentAgenda || this.currentAgenda.isFallback) {
      return 0;
    }

    const totalItems = this.currentAgenda.items.length;
    const discussedItems = this.trackedItems.size;
    
    return Math.round((discussedItems / totalItems) * 100);
  }

  /**
   * Filter transcription content based on agenda relevance
   * @param {string} transcriptionText - Transcription text to filter
   * @returns {Object} Filtering results
   */
  filterContentByAgenda(transcriptionText) {
    if (!this.currentAgenda || this.currentAgenda.isFallback) {
      return {
        isRelevant: true,
        relevanceScore: 1.0,
        matchedTopics: [],
        suggestedFocus: null
      };
    }

    const text = transcriptionText.toLowerCase();
    const matchedTopics = [];
    let relevanceScore = 0;

    // Check relevance against agenda topics
    for (const topic of this.agendaTopics) {
      if (text.includes(topic)) {
        matchedTopics.push(topic);
        relevanceScore += 0.2;
      }
    }

    // Check relevance against agenda items
    for (const item of this.currentAgenda.items) {
      for (const keyword of item.keywords) {
        if (text.includes(keyword)) {
          relevanceScore += 0.1;
        }
      }
    }

    // Cap relevance score at 1.0
    relevanceScore = Math.min(relevanceScore, 1.0);

    // Suggest focus if relevance is low
    let suggestedFocus = null;
    if (relevanceScore < 0.3 && this.currentAgenda.items.length > 0) {
      // Find the next untracked item
      const untrackedItem = this.currentAgenda.items.find(item => 
        !this.trackedItems.has(item.id)
      );
      suggestedFocus = untrackedItem || this.currentAgenda.items[0];
    }

    return {
      isRelevant: relevanceScore > 0.2,
      relevanceScore: relevanceScore,
      matchedTopics: matchedTopics,
      suggestedFocus: suggestedFocus
    };
  }

  /**
   * Get current agenda
   * @returns {Object|null} Current agenda
   */
  getCurrentAgenda() {
    return this.currentAgenda;
  }

  /**
   * Get agenda topics for content filtering
   * @returns {Array} Array of agenda topics
   */
  getAgendaTopics() {
    return [...this.agendaTopics];
  }

  /**
   * Get tracked agenda items
   * @returns {Map} Map of tracked items
   */
  getTrackedItems() {
    return new Map(this.trackedItems);
  }

  /**
   * Reset agenda tracking
   */
  resetTracking() {
    this.currentAgenda = null;
    this.agendaTopics = [];
    this.trackedItems.clear();
  }

  /**
   * Generate agenda-focused summary prompt
   * @returns {string} Summary prompt focused on agenda items
   */
  generateAgendaSummaryPrompt() {
    if (!this.currentAgenda || this.currentAgenda.isFallback) {
      return `Please provide a comprehensive summary of this meeting, including:
- Key discussion points
- Decisions made
- Action items identified
- Next steps planned`;
    }

    const agendaItemsList = this.currentAgenda.items
      .map(item => `- ${item.title}`)
      .join('\n');

    return `Please provide a summary of this meeting focused on the following agenda items:

${agendaItemsList}

For each agenda item that was discussed, please include:
- Key points discussed
- Decisions made
- Action items identified
- Any unresolved issues

Also include:
- Overall meeting outcomes
- Next steps and follow-up actions
- Any topics discussed that were not on the original agenda`;
  }
}

export default AgendaService;
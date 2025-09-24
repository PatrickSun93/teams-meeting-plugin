import OpenAIProvider from './ai-providers/OpenAIProvider.js';
import ClaudeProvider from './ai-providers/ClaudeProvider.js';
import AzureOpenAIProvider from './ai-providers/AzureOpenAIProvider.js';

/**
 * Summary Service - AI-powered meeting summary generation
 * Supports OpenAI GPT, Claude, and Azure OpenAI for generating intelligent meeting summaries
 */

class SummaryService {
  constructor() {
    this.configManager = null;
    this.agendaService = null;
    this.currentProvider = null;
    this.providers = new Map();
    
    // Initialize AI providers
    this.initializeProviders();
  }

  /**
   * Set configuration manager instance
   * @param {ConfigurationManager} configManager - Configuration manager instance
   */
  setConfigurationManager(configManager) {
    this.configManager = configManager;
  }

  /**
   * Set agenda service instance
   * @param {AgendaService} agendaService - Agenda service instance
   */
  setAgendaService(agendaService) {
    this.agendaService = agendaService;
  }

  /**
   * Initialize AI service providers
   */
  initializeProviders() {
    // Import and register AI providers
    this.providers.set('openai_gpt', new OpenAIProvider());
    this.providers.set('claude', new ClaudeProvider());
    this.providers.set('azure_openai', new AzureOpenAIProvider());
  }

  /**
   * Generate meeting summary using configured AI service
   * @param {Object} transcript - Meeting transcript with segments and speakers
   * @param {Object} options - Summary generation options
   * @returns {Promise<Object>} Generated summary
   */
  async generateSummary(transcript, options = {}) {
    try {
      if (!transcript || !transcript.segments || transcript.segments.length === 0) {
        throw new Error('Invalid or empty transcript provided');
      }

      // Get user configuration
      const config = await this.configManager.getUserConfig();
      const provider = this.providers.get(config.aiProvider);
      
      if (!provider) {
        throw new Error(`Unsupported AI provider: ${config.aiProvider}`);
      }

      // Get API key for the provider
      const apiKey = await this.configManager.getApiKey(config.aiProvider);
      if (!apiKey) {
        throw new Error(`API key not configured for ${config.aiProvider}`);
      }

      // Set provider configuration
      await provider.configure({
        apiKey: apiKey,
        model: options.model || this.getDefaultModel(config.aiProvider),
        temperature: options.temperature || 0.3,
        maxTokens: options.maxTokens || 2000
      });

      // Get user's custom prompt or use default
      const userPrompt = await this.configManager.getUserPrompt();
      const systemPrompt = this.buildSystemPrompt(transcript, userPrompt, options);

      // Format transcript for AI processing
      const formattedTranscript = this.formatTranscriptForAI(transcript);

      // Generate summary using the AI provider
      const summaryText = await provider.generateSummary(formattedTranscript, systemPrompt);

      // Parse and structure the summary
      const structuredSummary = this.parseAISummary(summaryText, transcript);

      // Add metadata
      structuredSummary.metadata = {
        generatedAt: new Date().toISOString(),
        provider: config.aiProvider,
        model: options.model || this.getDefaultModel(config.aiProvider),
        transcriptLength: transcript.segments.length,
        meetingDuration: this.calculateMeetingDuration(transcript),
        agendaFocused: !!this.agendaService?.getCurrentAgenda()
      };

      return structuredSummary;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error(`Summary generation failed: ${error.message}`);
    }
  }

  /**
   * Build system prompt for AI summary generation
   * @param {Object} transcript - Meeting transcript
   * @param {string} userPrompt - User's custom prompt
   * @param {Object} options - Generation options
   * @returns {string} Complete system prompt
   */
  buildSystemPrompt(transcript, userPrompt, options) {
    let prompt = userPrompt || this.configManager.getDefaultPrompt();

    // Add agenda context if available
    if (this.agendaService) {
      const agenda = this.agendaService.getCurrentAgenda();
      if (agenda && !agenda.isFallback) {
        const agendaContext = this.buildAgendaContext(agenda);
        prompt = `${prompt}\n\n${agendaContext}`;
      }
    }

    // Add speaker context
    const speakers = this.extractSpeakers(transcript);
    if (speakers.length > 1) {
      const speakerContext = `\n\nSpeakers in this meeting: ${speakers.join(', ')}`;
      prompt += speakerContext;
    }

    // Add formatting instructions
    prompt += `\n\nPlease format your response as a structured summary with clear sections and bullet points where appropriate.`;

    return prompt;
  }

  /**
   * Build agenda context for the prompt
   * @param {Object} agenda - Meeting agenda
   * @returns {string} Agenda context string
   */
  buildAgendaContext(agenda) {
    const agendaItems = agenda.items.map(item => `- ${item.title}`).join('\n');
    
    return `Meeting Agenda:
${agendaItems}

Please focus your summary on these agenda items and note which topics were discussed and which may have been skipped.`;
  }

  /**
   * Format transcript for AI processing
   * @param {Object} transcript - Raw transcript object
   * @returns {string} Formatted transcript text
   */
  formatTranscriptForAI(transcript) {
    const segments = transcript.segments || [];
    
    // Group segments by speaker for better readability
    const speakerSegments = new Map();
    
    segments.forEach(segment => {
      const speakerId = segment.speakerId || 'Unknown Speaker';
      if (!speakerSegments.has(speakerId)) {
        speakerSegments.set(speakerId, []);
      }
      speakerSegments.get(speakerId).push(segment);
    });

    // Format as conversation
    let formattedText = '';
    let currentSpeaker = null;
    
    segments.forEach(segment => {
      const speakerId = segment.speakerId || 'Unknown Speaker';
      
      if (currentSpeaker !== speakerId) {
        if (formattedText) formattedText += '\n\n';
        formattedText += `${speakerId}: `;
        currentSpeaker = speakerId;
      } else {
        formattedText += ' ';
      }
      
      formattedText += segment.text;
    });

    return formattedText;
  }

  /**
   * Parse AI-generated summary into structured format
   * @param {string} summaryText - Raw AI summary text
   * @param {Object} transcript - Original transcript
   * @returns {Object} Structured summary object
   */
  parseAISummary(summaryText, transcript) {
    const summary = {
      meetingId: transcript.meetingId,
      rawSummary: summaryText,
      keyPoints: [],
      decisions: [],
      actionItems: [],
      nextSteps: [],
      agendaItems: [],
      participants: this.extractSpeakers(transcript)
    };

    try {
      // Try to parse structured sections from the AI response
      const sections = this.extractSections(summaryText);
      
      // Extract key points
      summary.keyPoints = this.extractListItems(sections, [
        'key points', 'key discussion points', 'main topics', 'discussion points'
      ]);

      // Extract decisions
      summary.decisions = this.extractListItems(sections, [
        'decisions', 'decisions made', 'conclusions', 'resolutions'
      ]);

      // Extract action items
      summary.actionItems = this.extractActionItems(sections, summaryText);

      // Extract next steps
      summary.nextSteps = this.extractListItems(sections, [
        'next steps', 'follow-up', 'follow up', 'future actions'
      ]);

      // Extract agenda-specific items if agenda was available
      if (this.agendaService) {
        summary.agendaItems = this.extractAgendaItems(sections, summaryText);
      }

    } catch (error) {
      console.warn('Error parsing structured summary, using raw text:', error);
    }

    return summary;
  }

  /**
   * Extract sections from AI summary text
   * @param {string} text - AI summary text
   * @returns {Object} Sections mapped by title
   */
  extractSections(text) {
    const sections = {};
    const lines = text.split('\n');
    let currentSection = null;
    let currentContent = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this is a section header (starts with #, **, or is all caps)
      if (this.isSectionHeader(trimmedLine)) {
        // Save previous section
        if (currentSection) {
          sections[currentSection.toLowerCase()] = currentContent.join('\n');
        }
        
        // Start new section
        currentSection = this.cleanSectionTitle(trimmedLine);
        currentContent = [];
      } else if (trimmedLine && currentSection) {
        currentContent.push(trimmedLine);
      }
    }

    // Save last section
    if (currentSection) {
      sections[currentSection.toLowerCase()] = currentContent.join('\n');
    }

    return sections;
  }

  /**
   * Check if a line is a section header
   * @param {string} line - Text line to check
   * @returns {boolean} True if it's a section header
   */
  isSectionHeader(line) {
    // Markdown headers
    if (line.startsWith('#')) return true;
    
    // Bold text
    if (line.startsWith('**') && line.endsWith('**')) return true;
    
    // All caps (at least 3 characters)
    if (line.length >= 3 && line === line.toUpperCase() && /^[A-Z\s]+$/.test(line)) return true;
    
    // Ends with colon
    if (line.endsWith(':') && line.length > 3) return true;
    
    return false;
  }

  /**
   * Clean section title for mapping
   * @param {string} title - Raw section title
   * @returns {string} Cleaned title
   */
  cleanSectionTitle(title) {
    return title
      .replace(/^#+\s*/, '') // Remove markdown headers
      .replace(/^\*\*|\*\*$/g, '') // Remove bold markers
      .replace(/:$/, '') // Remove trailing colon
      .trim();
  }

  /**
   * Extract list items from sections
   * @param {Object} sections - Parsed sections
   * @param {Array} sectionNames - Possible section names to look for
   * @returns {Array} Extracted list items
   */
  extractListItems(sections, sectionNames) {
    const items = [];
    
    for (const sectionName of sectionNames) {
      const content = sections[sectionName];
      if (content) {
        const listItems = this.parseListItems(content);
        items.push(...listItems);
      }
    }

    return items;
  }

  /**
   * Parse list items from text content
   * @param {string} content - Text content to parse
   * @returns {Array} List items
   */
  parseListItems(content) {
    const items = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Match bullet points, numbers, or dashes
      const match = trimmedLine.match(/^(?:[-•*]|\d+\.)\s*(.+)$/);
      if (match) {
        const item = match[1].trim();
        if (item.length > 3) {
          items.push(item);
        }
      }
    }

    return items;
  }

  /**
   * Extract action items with assignees if possible
   * @param {Object} sections - Parsed sections
   * @param {string} fullText - Full summary text
   * @returns {Array} Action items with metadata
   */
  extractActionItems(sections, fullText) {
    const actionItems = [];
    const actionSections = ['action items', 'actions', 'tasks', 'todo', 'to do'];
    
    for (const sectionName of actionSections) {
      const content = sections[sectionName];
      if (content) {
        const items = this.parseListItems(content);
        
        for (const item of items) {
          const actionItem = {
            task: item,
            assignee: this.extractAssignee(item),
            dueDate: this.extractDueDate(item),
            priority: this.extractPriority(item)
          };
          
          actionItems.push(actionItem);
        }
      }
    }

    return actionItems;
  }

  /**
   * Extract assignee from action item text
   * @param {string} text - Action item text
   * @returns {string|null} Assignee name or null
   */
  extractAssignee(text) {
    // Look for patterns like "John will...", "assigned to Mary", "@username"
    const patterns = [
      /(\w+)\s+will\s+/i,
      /(\w+)\s+assigned\s+to\s+/i,
      /assigned\s+to\s+(\w+)/i,
      /@(\w+)/,
      /\((\w+)\)$/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract due date from action item text
   * @param {string} text - Action item text
   * @returns {string|null} Due date or null
   */
  extractDueDate(text) {
    // Look for date patterns
    const datePatterns = [
      /by\s+(next\s+\w+)/i,
      /by\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i,
      /due\s+(next\s+\w+)/i,
      /due\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      /(next\s+week|this\s+week|tomorrow)/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Extract priority from action item text
   * @param {string} text - Action item text
   * @returns {string} Priority level
   */
  extractPriority(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('urgent') || lowerText.includes('asap') || lowerText.includes('critical')) {
      return 'high';
    }
    
    if (lowerText.includes('important') || lowerText.includes('priority')) {
      return 'medium';
    }
    
    return 'normal';
  }

  /**
   * Extract agenda-specific items from summary
   * @param {Object} sections - Parsed sections
   * @param {string} fullText - Full summary text
   * @returns {Array} Agenda items with discussion status
   */
  extractAgendaItems(sections, fullText) {
    const agendaItems = [];
    const agenda = this.agendaService?.getCurrentAgenda();
    
    if (!agenda || agenda.isFallback) {
      return agendaItems;
    }

    // Check which agenda items were discussed
    for (const item of agenda.items) {
      const discussed = this.checkAgendaItemDiscussion(item, fullText);
      
      agendaItems.push({
        id: item.id,
        title: item.title,
        discussed: discussed.wasDiscussed,
        summary: discussed.summary,
        status: discussed.wasDiscussed ? 'completed' : 'not_discussed'
      });
    }

    return agendaItems;
  }

  /**
   * Check if an agenda item was discussed in the meeting
   * @param {Object} agendaItem - Agenda item to check
   * @param {string} summaryText - Full summary text
   * @returns {Object} Discussion status and summary
   */
  checkAgendaItemDiscussion(agendaItem, summaryText) {
    const lowerSummary = summaryText.toLowerCase();
    const lowerTitle = agendaItem.title.toLowerCase();
    
    // Check for direct title mention
    if (lowerSummary.includes(lowerTitle)) {
      return {
        wasDiscussed: true,
        summary: this.extractItemSummary(agendaItem.title, summaryText)
      };
    }

    // Check for keyword matches
    let keywordMatches = 0;
    for (const keyword of agendaItem.keywords || []) {
      if (lowerSummary.includes(keyword.toLowerCase())) {
        keywordMatches++;
      }
    }

    const wasDiscussed = keywordMatches >= Math.min(2, agendaItem.keywords?.length || 0);
    
    return {
      wasDiscussed,
      summary: wasDiscussed ? this.extractItemSummary(agendaItem.title, summaryText) : null
    };
  }

  /**
   * Extract summary for specific agenda item
   * @param {string} itemTitle - Agenda item title
   * @param {string} summaryText - Full summary text
   * @returns {string|null} Item-specific summary
   */
  extractItemSummary(itemTitle, summaryText) {
    const sentences = summaryText.split(/[.!?]+/);
    const relevantSentences = [];
    
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(itemTitle.toLowerCase())) {
        relevantSentences.push(sentence.trim());
      }
    }

    return relevantSentences.length > 0 ? relevantSentences.join('. ') : null;
  }

  /**
   * Extract speakers from transcript
   * @param {Object} transcript - Meeting transcript
   * @returns {Array} List of speaker names
   */
  extractSpeakers(transcript) {
    const speakers = new Set();
    
    if (transcript.segments) {
      transcript.segments.forEach(segment => {
        if (segment.speakerId) {
          speakers.add(segment.speakerId);
        }
      });
    }

    return Array.from(speakers);
  }

  /**
   * Calculate meeting duration from transcript
   * @param {Object} transcript - Meeting transcript
   * @returns {number} Duration in minutes
   */
  calculateMeetingDuration(transcript) {
    if (!transcript.segments || transcript.segments.length === 0) {
      return 0;
    }

    const firstSegment = transcript.segments[0];
    const lastSegment = transcript.segments[transcript.segments.length - 1];
    
    if (firstSegment.startTime && lastSegment.endTime) {
      return Math.round((lastSegment.endTime - firstSegment.startTime) / 60);
    }

    return 0;
  }

  /**
   * Get default model for AI provider
   * @param {string} provider - AI provider name
   * @returns {string} Default model name
   */
  getDefaultModel(provider) {
    const defaultModels = {
      'openai_gpt': 'gpt-4',
      'claude': 'claude-3-sonnet-20240229',
      'azure_openai': 'gpt-4'
    };

    return defaultModels[provider] || 'gpt-4';
  }

  /**
   * Get available AI providers
   * @returns {Array} List of available providers
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Test AI provider connection
   * @param {string} provider - Provider to test
   * @param {string} apiKey - API key to test
   * @returns {Promise<boolean>} True if connection successful
   */
  async testProvider(provider, apiKey) {
    try {
      const providerInstance = this.providers.get(provider);
      if (!providerInstance) {
        return false;
      }

      await providerInstance.configure({ apiKey });
      return await providerInstance.testConnection();
    } catch (error) {
      console.error(`Provider test failed for ${provider}:`, error);
      return false;
    }
  }
}

export default SummaryService;
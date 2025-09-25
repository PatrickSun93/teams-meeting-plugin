// Setup for integration tests
import { mockApiResponse } from './test-helpers';

// Mock external APIs for integration tests
beforeAll(() => {
  // Mock OpenAI API
  mockApiResponse('/api/openai', {
    choices: [{ message: { content: 'Mock AI response' } }]
  });
  
  // Mock Azure Speech API
  mockApiResponse('/api/azure-speech', {
    DisplayText: 'Mock transcription result',
    Confidence: 0.95
  });
  
  // Mock Teams Graph API
  mockApiResponse('/api/graph', {
    value: [
      { id: 'meeting-123', subject: 'Test Meeting' }
    ]
  });
});

// Extended timeout for integration tests
jest.setTimeout(60000);
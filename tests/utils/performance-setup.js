// Setup for performance tests
import { createMemorySnapshot } from './test-helpers';

// Performance monitoring setup
let initialMemory;

beforeEach(() => {
  // Take initial memory snapshot
  initialMemory = createMemorySnapshot();
  
  // Clear performance marks
  if (typeof performance !== 'undefined' && performance.clearMarks) {
    performance.clearMarks();
    performance.clearMeasures();
  }
});

afterEach(() => {
  // Check for memory leaks
  const finalMemory = createMemorySnapshot();
  if (initialMemory && finalMemory) {
    const memoryIncrease = finalMemory.used - initialMemory.used;
    if (memoryIncrease > 50 * 1024 * 1024) { // 50MB threshold
      console.warn(`Potential memory leak detected: ${memoryIncrease / 1024 / 1024}MB increase`);
    }
  }
});

// Extended timeout for performance tests
jest.setTimeout(120000);

// Mock performance.now for consistent timing in tests
const mockPerformanceNow = (() => {
  let time = 0;
  return () => {
    time += 16.67; // Simulate 60fps
    return time;
  };
})();

if (typeof performance === 'undefined') {
  global.performance = {
    now: mockPerformanceNow,
    mark: jest.fn(),
    measure: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn()
  };
}
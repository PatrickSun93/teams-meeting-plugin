# Technology Stack & Build System

## Core Technologies
- **Frontend**: React 18.2.0 with functional components and hooks
- **Backend**: Express.js 4.18.2 with Node.js
- **Build System**: Webpack 5.89.0 with Babel transpilation
- **Testing**: Jest 29.7.0 with multiple test environments (jsdom, integration, performance)
- **Teams Integration**: Microsoft Teams SDK (@microsoft/teams-js 2.19.0)

## Key Libraries & Dependencies
- **AI/ML**: @xenova/transformers 2.17.2 for local Whisper processing
- **HTTP Client**: Axios 1.6.0 for API communications
- **Storage**: IndexedDB for local data persistence
- **Security**: Custom encryption services with secure storage
- **Testing**: @testing-library/react, Playwright for E2E, jest-axe for accessibility

## Development Tools
- **Linting**: ESLint with custom rules (2-space indentation, single quotes, semicolons)
- **Formatting**: Prettier with consistent code style
- **Package Manager**: npm with package-lock.json
- **Environment**: dotenv for configuration management

## Build Commands
```bash
# Development
npm run dev              # Start development server with hot reload
npm run build:dev        # Build for development

# Production
npm start               # Start production server
npm run build           # Build for production

# Testing
npm test                # Run all unit tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests with Playwright
npm run test:performance # Performance tests
npm run test:accessibility # Accessibility tests
npm run test:security   # Security tests
npm run test:all        # Comprehensive test suite
npm run test:coverage   # Coverage report

# Teams App
npm run package:teams   # Build and package Teams app
npm run generate:icons  # Generate app icons
npm run test:teams-integration # Test Teams integration

# Code Quality
npm run lint            # ESLint
npm run format          # Prettier formatting
```

## Architecture Patterns
- **Service Layer**: Centralized business logic in `/services` directory
- **Component-Service Separation**: React components consume services, not direct APIs
- **Security-First**: SecurityManager integration across all services
- **Configuration Management**: Centralized config with validation and encryption
- **Error Handling**: Comprehensive error boundaries and recovery strategies
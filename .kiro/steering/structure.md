# Project Structure & Organization

## Root Directory Structure
```
├── src/                    # Source code
│   ├── client/            # React frontend application
│   ├── server/            # Express.js backend
│   └── teams/             # Teams-specific integration code
├── tests/                 # Test suites organized by type
├── docs/                  # Documentation
├── scripts/               # Build and utility scripts
├── assets/                # App icons and static resources
├── public/                # Static files served by webpack
├── teams-app-package/     # Teams app manifest and assets
└── test-results/          # Generated test reports
```

## Client Application Structure (`src/client/`)
```
├── components/            # React components
│   ├── __tests__/        # Component unit tests
│   └── *.css             # Component-specific styles
├── services/             # Business logic and API services
│   ├── __tests__/        # Service unit tests
│   └── ai-providers/     # AI service implementations
├── hooks/                # Custom React hooks
│   └── __tests__/        # Hook tests
├── App.js                # Main application component
├── index.js              # Application entry point
└── config.html           # Teams configuration page
```

## Testing Organization (`tests/`)
```
├── accessibility/        # Accessibility compliance tests
├── e2e/                 # End-to-end workflow tests
├── integration/         # Cross-service integration tests
├── performance/         # Performance and load tests
├── security/            # Security validation tests
└── utils/               # Test utilities and setup
```

## Naming Conventions

### Files & Directories
- **Components**: PascalCase (e.g., `ConfigurationPanel.js`)
- **Services**: PascalCase (e.g., `TranscriptionEngine.js`)
- **Hooks**: camelCase starting with 'use' (e.g., `useConfiguration.js`)
- **Tests**: Match source file + `.test.js` or `.spec.js`
- **Styles**: Match component name + `.css`

### Code Conventions
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Functions**: camelCase with descriptive verbs
- **Classes**: PascalCase
- **Private methods**: Prefix with underscore `_methodName`

## Component Architecture Patterns

### Service Integration
- Components receive services via props (dependency injection)
- Services are instantiated in parent components or App.js
- SecurityManager integration is consistent across all services

### State Management
- Local state with useState for component-specific data
- Custom hooks for shared state logic
- Configuration managed through ConfigurationManager service

### Error Handling
- Error boundaries for component-level error catching
- Service-level error handling with recovery strategies
- User-friendly error messages in UI components

## File Organization Rules

### Component Files
Each component should have:
- Main component file (`.js`)
- Stylesheet (`.css`) 
- Test file (`__tests__/ComponentName.test.js`)

### Service Files
Each service should have:
- Main service class file
- Comprehensive test coverage
- Clear public API with JSDoc comments
- Error handling and validation

### Import Conventions
- Relative imports for local files (`./`, `../`)
- Absolute imports for external packages
- Services imported at component level, not globally
- CSS imports after JS imports in components
# Contributing to Docker Hub MCP Server

Thank you for your interest in contributing to the Docker Hub MCP Server! We welcome contributions from the community and are pleased to have you join us.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Style Guidelines](#style-guidelines)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it are governed by our Code of Conduct. By participating, you are expected to uphold this code.

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- Docker (optional, for testing)
- Docker Hub account (optional, for testing with authentication)

### First Time Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/dockerhub-mcp-server.git
   cd dockerhub-mcp-server
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/original-owner/dockerhub-mcp-server.git
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Build the project:
   ```bash
   npm run build
   ```
6. Run tests to ensure everything works:
   ```bash
   npm test
   ```

## Development Setup

### Environment Configuration

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Configure your Docker Hub credentials (optional):
   ```bash
   DOCKERHUB_USERNAME=your_username
   DOCKERHUB_ACCESS_TOKEN=your_token
   ```

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Clean build artifacts
npm run clean
```

### Project Structure

```
src/
├── auth/           # Authentication management
├── cache/          # Caching infrastructure
├── clients/        # API clients (Docker Hub)
├── tools/          # MCP tool implementations
├── utils/          # Utility functions
├── types.ts        # TypeScript type definitions
├── config.ts       # Configuration management
├── server.ts       # MCP server implementation
└── index.ts        # Application entry point

tests/              # Test files
docs/               # Documentation
examples/           # Example configurations
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-vulnerability-scanning`
- `fix/rate-limit-handling`
- `docs/update-api-documentation`
- `refactor/improve-error-handling`

### Workflow

1. **Create a branch** from main:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the style guidelines

3. **Add tests** for new functionality

4. **Update documentation** if needed

5. **Test your changes**:
   ```bash
   npm test
   npm run lint
   ```

6. **Commit your changes** with clear messages:
   ```bash
   git commit -m "feat: add vulnerability scanning tool

   - Implement docker_get_vulnerabilities tool
   - Add security analysis and recommendations
   - Include comprehensive error handling
   - Add unit tests with 95% coverage
   
   Closes #123"
   ```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(tools): add image comparison functionality
fix(auth): handle expired access tokens properly
docs(api): update tool documentation with examples
test(client): add integration tests for Docker Hub API
```

## Testing

### Writing Tests

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test API interactions and workflows
- **E2E Tests**: Test complete user scenarios

### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup for each test
  });

  describe('when condition', () => {
    it('should do something', async () => {
      // Arrange
      const input = { /* test data */ };
      
      // Act
      const result = await functionUnderTest(input);
      
      // Assert
      expect(result).toEqual(expectedOutput);
    });

    it('should handle errors gracefully', async () => {
      // Test error conditions
      await expect(functionUnderTest(invalidInput))
        .rejects.toThrow('Expected error message');
    });
  });
});
```

### Test Coverage

- Maintain minimum 80% test coverage
- New features require comprehensive tests
- Include both happy path and error cases
- Mock external dependencies appropriately

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tools/search-images.test.ts

# Run tests matching pattern
npm test -- --grep "authentication"
```

## Submitting Changes

### Before Submitting

- [ ] All tests pass
- [ ] Code follows style guidelines
- [ ] Documentation is updated
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main

### Creating a Pull Request

1. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a pull request** on GitHub with:
   - Clear title and description
   - Reference to related issues
   - Screenshots/examples if applicable
   - Test results and coverage information

3. **PR Template**:
   ```markdown
   ## Description
   Brief description of changes
   
   ## Changes Made
   - [ ] Feature/fix implemented
   - [ ] Tests added/updated
   - [ ] Documentation updated
   
   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed
   
   ## Related Issues
   Closes #123
   
   ## Screenshots
   (if applicable)
   ```

### Review Process

1. **Automated Checks**: CI will run tests and linting
2. **Code Review**: Maintainers will review your code
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, your PR will be merged

## Style Guidelines

### TypeScript

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

```typescript
/**
 * Search Docker Hub for images matching the query
 * @param query - Search query string
 * @param options - Search options including pagination
 * @returns Promise resolving to search results
 */
async function searchImages(
  query: string, 
  options: SearchOptions
): Promise<SearchResults> {
  // Implementation
}
```

### Code Organization

- One feature per file when possible
- Export only what's necessary
- Use barrel exports for modules
- Keep functions small and focused

### Error Handling

- Use custom error types
- Provide meaningful error messages
- Log errors appropriately
- Handle async operations properly

```typescript
try {
  const result = await apiCall();
  return result;
} catch (error) {
  const dockerHubError = ErrorHandler.handleError(error);
  ErrorHandler.logError(dockerHubError, 'searchImages');
  throw dockerHubError;
}
```

### Documentation

- Update README.md for new features
- Add API documentation for new tools
- Include examples in docs/EXAMPLES.md
- Update troubleshooting guide if needed

## Community

### Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community discussions
- **Discord/Slack**: Real-time community support (if available)

### Ways to Contribute

Beyond code contributions:

- **Documentation**: Improve guides, fix typos, add examples
- **Testing**: Report bugs, test new features
- **Support**: Help other users in discussions
- **Ideas**: Suggest new features and improvements

### Recognition

Contributors are recognized in:
- CONTRIBUTORS.md file
- Release notes for significant contributions
- GitHub contributor statistics
- Community highlights (when applicable)

## Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, backwards compatible

### Release Cycle

- Regular releases every 2-4 weeks
- Hotfixes for critical bugs
- Beta releases for major features

## Questions?

If you have questions about contributing:

1. Check existing issues and discussions
2. Read the documentation thoroughly
3. Ask in GitHub Discussions
4. Reach out to maintainers

Thank you for contributing to Docker Hub MCP Server! 🐳✨

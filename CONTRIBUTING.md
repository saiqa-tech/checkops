# Contributing to CheckOps

Thank you for your interest in contributing to CheckOps! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 24 or higher
- PostgreSQL 18 or higher
- npm or yarn

### Setup Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/checkops.git
cd checkops
```

3. Install dependencies:

```bash
npm install
```

4. Set up PostgreSQL database:

```bash
createdb checkops_test
```

5. Set environment variables:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=checkops_test
export DB_USER=postgres
export DB_PASSWORD=your_password
```

6. Run migrations:

```bash
npm run migrate
```

7. Run tests:

```bash
npm test
```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - Feature branches
- `bugfix/*` - Bug fix branches
- `hotfix/*` - Urgent production fixes

### Making Changes

1. Create a new branch:

```bash
git checkout -b feature/your-feature-name
```

2. Make your changes following our coding standards
3. Write tests for your changes
4. Run tests to ensure everything passes:

```bash
npm test
npm run test:coverage
```

5. Commit your changes with a descriptive message:

```bash
git commit -m "feat: add support for custom validation rules"
```

### Commit Message Format

We follow the Conventional Commits specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example:
```
feat: add email notification service

- Add email service with template support
- Integrate with SendGrid API
- Add tests for email sending
```

## Coding Standards

### JavaScript Style

- Use ES6+ features
- Use camelCase for variables and functions (NEVER snake_case)
- Use PascalCase for classes
- Use UPPER_CASE for constants
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Example:

```javascript
/**
 * Creates a new form with questions
 * @param {Object} options - Form options
 * @param {string} options.title - Form title
 * @param {Array} options.questions - Array of questions
 * @returns {Promise<Form>} Created form object
 */
async function createForm({ title, questions }) {
  validateRequired(title, 'Title');
  validateQuestions(questions);

  const sanitizedTitle = sanitizeString(title);
  const sanitizedQuestions = sanitizeObject(questions);

  return await Form.create({
    title: sanitizedTitle,
    questions: sanitizedQuestions,
  });
}
```

### Testing Standards

- Write unit tests for all utility functions
- Write service tests for business logic
- Write integration tests for end-to-end workflows
- Aim for meaningful test coverage
- Use descriptive test names

Example:

```javascript
describe('FormService', () => {
  describe('createForm', () => {
    it('should create form with valid data', async () => {
      // Test implementation
    });

    it('should throw ValidationError for empty title', async () => {
      // Test implementation
    });
  });
});
```

### Security Standards

- Always use parameterized queries
- Sanitize all user inputs
- Never expose internal errors to users
- Validate all inputs before processing
- Follow OWASP security guidelines

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update CHANGELOG.md with your changes
5. Create a pull request with a clear description:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] Tests pass locally
- [ ] Added tests for new features
- [ ] Updated documentation
- [ ] Followed code style guidelines
- [ ] Updated CHANGELOG.md
```

6. Wait for code review
7. Address any review comments
8. Once approved, your PR will be merged

## Code Review Process

All submissions require review. We look for:

- Code quality and style
- Test coverage
- Documentation updates
- Security considerations
- Performance implications
- Breaking changes

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm run test:coverage
```

### Writing Tests

Place tests in the appropriate directory:

- `tests/unit/` - Unit tests
- `tests/integration/` - Integration tests
- `tests/performance/` - Performance tests

## Documentation

Update documentation when:

- Adding new features
- Changing APIs
- Adding new configuration options
- Fixing bugs that affect usage

Documentation files:

- `README.md` - Main readme
- `docs/API_REFERENCE.md` - API documentation
- `docs/USAGE_GUIDE.md` - Usage examples
- `docs/EXAMPLES.md` - Real-world examples
- `docs/DATABASE_SCHEMA.md` - Database schema
- `docs/ARCHITECTURE.md` - Architecture overview
- `docs/SECURITY.md` - Security guidelines

## Reporting Bugs

Use GitHub Issues to report bugs. Include:

- CheckOps version
- Node.js version
- PostgreSQL version
- Operating system
- Steps to reproduce
- Expected behavior
- Actual behavior
- Error messages/logs

Example:

```markdown
**CheckOps Version:** 1.0.0
**Node.js Version:** 24.0.0
**PostgreSQL Version:** 18.0

**Description:**
Creating a form with special characters in title fails

**Steps to Reproduce:**
1. Initialize CheckOps
2. Call createForm with title containing emoji
3. See error

**Expected:**
Form should be created successfully

**Actual:**
ValidationError thrown

**Error Message:**
```
ValidationError: Invalid characters in title
```
```

## Feature Requests

Use GitHub Issues for feature requests. Include:

- Clear description of the feature
- Use case/motivation
- Example API (if applicable)
- Potential implementation approach

## Community Guidelines

- Be respectful and inclusive
- Provide constructive feedback
- Help others in discussions
- Follow our Code of Conduct

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

## Questions?

- GitHub Issues: For bug reports and feature requests
- GitHub Discussions: For questions and general discussion
- Email: dev@saiqa.tech

## Recognition

Contributors will be acknowledged in:

- CHANGELOG.md
- README.md contributors section
- Release notes

Thank you for contributing to CheckOps! 🎉

# Contributing to Fusion Evaluator

Thank you for your interest in contributing to Fusion Evaluator! We welcome contributions from everyone, whether it's bug reports, feature requests, or code contributions.

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and adhere to our principles of respect and inclusivity.

## How to Contribute

### 1. Reporting Bugs

Before creating a bug report, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Provide a step-by-step reproduction**
- **Provide specific examples**
- **Include screenshots and animations** if possible
- **Include your environment** (OS, Node version, etc.)

### 2. Suggesting Enhancements

When suggesting an enhancement, include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps or point out the part of Fusion Evaluator that the suggestion is related to**
- **Explain why this enhancement would be useful**

### 3. Code Contributions

#### Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/fusion-evaluator.git
   cd fusion-evaluator
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

5. **Start development server**
   ```bash
   npm run dev:full
   ```

#### Code Style Guidelines

- **JavaScript/TypeScript**:
  - Use 2-space indentation
  - Use ES2022+ syntax
  - Use camelCase for variables and functions
  - Use PascalCase for classes and components
  - Use UPPER_SNAKE_CASE for constants

- **React Components**:
  - Functional components with hooks
  - Descriptive component names
  - Proper prop typing with TypeScript
  - Include JSDoc comments for complex components

- **Backend (Express)**:
  - Follow RESTful conventions
  - Use descriptive route names
  - Include proper error handling
  - Use async/await (not callbacks)

- **CSS/Tailwind**:
  - Use Tailwind utility classes
  - Avoid custom CSS when possible
  - Use consistent spacing and sizing scales

#### Commit Message Guidelines

Use clear, descriptive commit messages:

```
type(scope): subject

body

footer
```

**Types**:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring without feature changes
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling

**Examples**:
```
feat(auth): implement refresh token rotation
fix(modules): prevent duplicate module assignments
docs(readme): update installation instructions
```

#### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Run TypeScript type checking:
  ```bash
  npm run lint
  ```

#### Pull Request Process

1. **Before submitting**:
   - Run `npm run lint` to check types
   - Build the project: `npm run build`
   - Test your changes thoroughly

2. **Create your PR**:
   - Use a clear, descriptive title
   - Reference any related issues (#issue-number)
   - Describe your changes in detail
   - Include screenshots or GIFs for UI changes
   - Explain the rationale behind your changes

3. **PR Template** (include in description):
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   How to test the changes

   ## Checklist
   - [ ] TypeScript types are correct
   - [ ] Tests pass
   - [ ] Documentation updated
   - [ ] No console errors or warnings
   - [ ] Changes follow code style guidelines
   ```

4. **Review Process**:
   - Wait for code review
   - Make requested changes
   - Re-request review after updates

### 4. Documentation Contributions

- Update README.md for user-facing changes
- Update CHANGELOG.md for notable changes
- Add inline code comments for complex logic
- Update API documentation for endpoint changes

## Project Structure Reference

```
.
├── src/                  # React frontend
├── lib/                  # Express backend
├── prisma/              # Database schema and migrations
├── README.md            # User documentation
├── CHANGELOG.md         # Version history
├── CONTRIBUTING.md      # This file
├── LICENSE              # Apache 2.0 license
└── package.json         # Dependencies and scripts
```

## Development Workflow

### Frontend Development
```bash
npm run dev              # Start Vite dev server on :3000
```

### Backend Development
```bash
npm run server           # Start Express on :5001
```

### Database Management
```bash
npm run db:migrate      # Create/apply migrations
npm run db:generate     # Regenerate Prisma client
```

### Full Stack Development
```bash
npm run dev:full        # Run frontend and backend concurrently
```

## Git Workflow

1. Create feature branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

3. Keep your branch up-to-date:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

4. Push to your fork:
   ```bash
   git push origin feature/my-feature
   ```

5. Open a Pull Request on GitHub

## Security Considerations

- **Never commit secrets**: `.env.local` is git-ignored for a reason
- **Validate inputs**: All user inputs must be validated
- **Sanitize outputs**: Never output raw user data
- **Use prepared statements**: Prisma handles this automatically
- **Keep dependencies updated**: Run `npm audit` regularly
- **Follow OWASP guidelines**: Check OWASP Top 10

## Performance Guidelines

- **Frontend**:
  - Use React.memo for expensive components
  - Implement proper key props in lists
  - Lazy load routes with React.lazy
  - Optimize images and assets

- **Backend**:
  - Use database indexing appropriately
  - Implement caching where beneficial
  - Avoid N+1 queries
  - Use pagination for large datasets

## Documentation Standards

All code should be self-documenting where possible. Include comments for:
- Complex algorithms
- Non-obvious design decisions
- Business logic rationale
- External API interactions

## Questions or Need Help?

- Check existing issues and discussions
- Review documentation in README.md
- Ask in a new GitHub issue
- Contact the maintainers

## Recognition

Contributors will be recognized in:
- The project README
- Release notes for major contributions
- GitHub contributors page (automatic)

---

## Repository Maintainers

- **Primary Maintainer**: Vikrant
- **Reviewers**: [List of core contributors]

Thank you for contributing to Fusion Evaluator!

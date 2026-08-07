# Contributing to NexusStream

Thank you for your interest in contributing to NexusStream! This document provides guidelines and information for contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/NexusStream.git
   cd NexusStream
   ```
3. **Create a branch** for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Install dependencies**:
   ```bash
   # Frontend
   cd frontend && npm install
   
   # Backend (in a separate terminal)
   cd backend && npm install
   ```

## Development

### Frontend

```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`.

### Backend

```bash
cd backend
npm start
```

The proxy server will run on `http://localhost:5000`.

## Code Style

- Use functional components with hooks
- Follow existing code patterns and conventions
- Use Tailwind CSS for styling
- Keep components modular and reusable
- Add comments only when necessary to explain complex logic

## Submitting Changes

1. **Commit your changes** with a clear message:
   ```bash
   git commit -m "feat: add new video format support"
   ```
   
   Use conventional commit format:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `style:` for code style changes
   - `refactor:` for code refactoring
   - `test:` for adding tests
   - `chore:` for maintenance tasks

2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub with a clear description of your changes.

## Reporting Issues

- Use the GitHub Issues tracker
- Include steps to reproduce the issue
- Include your environment details (OS, browser, Node.js version)
- Include any error messages or screenshots

## Feature Requests

- Open an issue with the `feature-request` label
- Describe the feature and its use case
- Explain why it would be valuable to the project

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment for all contributors

## Questions?

If you have questions about contributing, feel free to open an issue or reach out to the maintainers.

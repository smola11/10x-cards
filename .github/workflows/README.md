# GitHub Actions Workflows

## Pull Request CI (`pull-request.yml`)

This workflow runs automatically on every pull request to the `master` branch.

### Workflow Structure

The workflow consists of three sequential jobs:

#### 1. **Lint** 🔍
- Runs ESLint to check code quality and style
- Must pass before unit tests run
- Uses Node.js version from `.nvmrc` file
- Installs dependencies with `npm ci` for reproducible builds

#### 2. **Unit Tests** 🧪
- Runs after successful linting
- Executes unit tests with coverage reporting
- Generates coverage reports in multiple formats:
  - Text (console output)
  - JSON (machine-readable)
  - JSON Summary (for PR comments)
  - HTML (detailed browsable report)
- Uploads coverage artifacts for 30 days retention

#### 3. **Status Comment** 💬
- Runs only if both lint and unit tests pass
- Posts a success comment to the PR with:
  - Overall status
  - Individual job results
  - Code coverage metrics (lines, statements, functions, branches)
  - Link to the workflow run

### GitHub Actions Used

All actions are using the latest major versions (as of January 2026):

- `actions/checkout@v6` - Checks out repository code
- `actions/setup-node@v6` - Sets up Node.js environment
- `actions/upload-artifact@v6` - Uploads test coverage artifacts
- `actions/download-artifact@v7` - Downloads test coverage artifacts
- `actions/github-script@v8` - Creates PR comments using GitHub API

### Required Permissions

The workflow requires the following permissions:
- `pull-requests: write` - To post comments on pull requests

### Environment Requirements

- Node.js version specified in `.nvmrc` (currently 22.14.0)
- All dependencies listed in `package.json`

### Coverage Configuration

Coverage is configured in `vitest.config.ts`:
- Provider: `v8` (built-in V8 coverage)
- Reporters: text, json, json-summary, html
- Excludes: node_modules, test files, type definitions, config files, mock data

### Workflow Behavior

1. **On PR Creation/Update**: All three jobs run in sequence
2. **If Lint Fails**: Unit tests are skipped, no comment is posted
3. **If Unit Tests Fail**: Status comment is not posted
4. **If All Pass**: Success comment with coverage metrics is posted to the PR

### Local Testing

Before pushing, you can run the same checks locally:

```bash
# Run linter
npm run lint

# Run unit tests with coverage
npm run test:unit -- --coverage
```

### Troubleshooting

**Coverage not showing in PR comment:**
- Ensure `json-summary` reporter is configured in `vitest.config.ts`
- Check that tests are actually running and generating coverage
- Verify the coverage artifact was uploaded successfully

**Workflow not triggering:**
- Ensure the PR targets the `master` branch
- Check repository settings for Actions permissions

**Permission errors on PR comments:**
- Verify the workflow has `pull-requests: write` permission
- Check repository Actions settings allow workflows to create comments


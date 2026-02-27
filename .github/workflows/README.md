# GitHub Actions Workflows

## AI Changelog (`ai-changelog.yml`)

This workflow runs **manually** on demand and uses **Gemini Flash** to analyze the last N commits and generate a changelog summary. It updates `CHANGELOG.md` and opens a Pull Request with the changes.

### Prerequisites

1. **Repository secret `GOOGLE_API_KEY`**:
   - Go to [Google AI Studio](https://aistudio.google.com/apikey) and create an API key.
   - In your repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Name: `GOOGLE_API_KEY`, value: your API key.

2. **How to run**:
   - Go to **Actions** tab → select **AI Changelog (Gemini)** workflow.
   - Click **Run workflow**, optionally choose branch and **commits to analyze** (default: 10).
   - Click **Run workflow** again to confirm.

### Workflow Structure

1. **Gather commit context** – fetches the last N commits from `master` (SHA, author, date, subject, body).
2. **Idempotency check** – skips if the same commit range was already processed (marker in `CHANGELOG.md`).
3. **Call Gemini API** – sends commits to Gemini Flash and receives a bullet-list summary.
4. **Update CHANGELOG.md** – inserts a new section at the top and creates the file if missing.
5. **Create Pull Request** – opens a PR to `master` with the changelog changes (branch: `chore/ai-changelog`).

### Required Permissions

- `contents: write` – to commit changes.
- `pull-requests: write` – to create PRs.

### Troubleshooting

**"GOOGLE_API_KEY secret is not set"** – add the secret in repo Settings → Secrets and variables → Actions.

**Workflow does nothing** – ensure the idempotency marker is not already present for the same commit range.

---

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

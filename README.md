# GitHub CDN Worker

A Cloudflare Worker that serves as a CDN for GitHub repositories, enabling access to both public and private repositories even in wonderland.

## Features

- Access files from both public and private GitHub repositories
- Access GitHub release downloads
- Works in wonderland
- Multiple URL formats for flexibility
- Per-user / per-organization token routing via a single JSON environment variable
- Performance benefits of Cloudflare's global edge network
- Proper caching for improved performance
- Handles binary files correctly

## Token Configuration

The worker resolves the GitHub token in this order:

1. **`GITHUB_TOKENS`** (recommended) – a JSON string mapping each GitHub username or organization to its own token.
2. **`GITHUB_TOKEN`** – single-token fallback used when no per-user match is found.

### Using `GITHUB_TOKENS` (multi-account, recommended)

In the Cloudflare Worker dashboard go to **Settings → Variables** and add:

| Variable name   | Type   | Value                                      |
|-----------------|--------|--------------------------------------------|
| `GITHUB_TOKENS` | Secret | *(JSON string, see below)*                 |

Value example:

```json
{
  "user1": "ghp_token_for_user1",
  "user2": "ghp_token_for_user2",
  "my-organization": "ghp_token_for_org"
}
```

The worker extracts the username from every incoming request path and looks it up in this map automatically. If the username is not found in the map, it falls back to `GITHUB_TOKEN`.

### Using `GITHUB_TOKEN` (single-account fallback)

| Variable name  | Type   | Value                          |
|----------------|--------|--------------------------------|
| `GITHUB_TOKEN` | Secret | `ghp_your_personal_access_token` |

## URL Formats

### 1. Short Format (via /gh/)

```
https://your-worker.domain/gh/username/repo/branch/path/to/file
```

Example:
```
https://cdn.example.com/gh/username/repo-name/main/config.ini
```

### 2. Raw File Format (via /raw/)

```
https://your-worker.domain/raw/username/repo/branch/path/to/file
```

Example:
```
https://cdn.example.com/raw/username/repo-name/main/config.ini
```

### 3. GitHub Releases Download Format

```
https://your-worker.domain/releases/username/repo/download/tag/filename
```

Example:
```
https://cdn.example.com/releases/username/repo-name/download/v1.0.0/app.zip
```

### 4. Direct Raw GitHub URL

Simply prepend your worker domain to any GitHub raw URL:

```
https://your-worker.domain/https://raw.githubusercontent.com/username/repo/branch/path/to/file
```

Example:
```
https://cdn.example.com/https://raw.githubusercontent.com/username/repo-name/main/config.ini
```

### 5. URL with Blob (GitHub Web UI Format)

This format supports URLs copied directly from GitHub's web interface:

```
https://your-worker.domain/gh/username/repo/blob/branch/path/to/file
```

Example:
```
https://cdn.example.com/gh/username/repo-name/blob/main/config.ini
```

## Deployment Options

### Option 1: Manual Deployment via Cloudflare Dashboard

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to "Workers & Pages"
3. Click "Create Application" and select "Worker"
4. Replace the code with the content of `src/index.js`
5. Click "Save and Deploy"
6. Go to **Settings → Variables** and add `GITHUB_TOKENS` (JSON) and/or `GITHUB_TOKEN`
7. Click "Save and Deploy" again

### Option 2: Wrangler CLI

1. Install Wrangler:
   ```
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```
   wrangler login
   ```

3. Set secrets:
   ```
   wrangler secret put GITHUB_TOKENS
   # paste the JSON string when prompted

   # optional single-token fallback
   wrangler secret put GITHUB_TOKEN
   ```

4. Deploy:
   ```
   wrangler deploy
   ```

## Usage Examples

### For Web Resources

```html
<script src="https://cdn.example.com/gh/username/repo/main/script.js"></script>
<link rel="stylesheet" href="https://cdn.example.com/gh/username/repo/main/styles.css">
```

### For GitHub Releases

```
https://cdn.example.com/releases/electron/electron/download/v28.1.0/electron-v28.1.0-win32-x64.zip
```

### Direct Linking in Documentation

```markdown
Download the file from [here](https://cdn.example.com/raw/username/repo/main/filename.ext)
```

## Security Considerations

- Tokens are stored as encrypted secrets, never in plain text
- Grant only `read` (contents) permission to each token
- Consider setting an expiration date on your GitHub tokens
- Rotate tokens periodically

## Limitations

- Maximum file size: 25 MB (Cloudflare Worker limit)
- Request timeout: 30 seconds

## Troubleshooting

- **404** – verify the repository path, branch name, and that the token has access
- **401** – the token for that username is missing or invalid; check `GITHUB_TOKENS`
- **JSON parse error in logs** – `GITHUB_TOKENS` value is not valid JSON

## License

MIT

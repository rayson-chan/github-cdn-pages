# GitHub CDN Worker

A Cloudflare Worker that serves as a CDN for GitHub repositories, enabling access to both public and private repositories even in wonderland.

## Features

- Access files from both public and private GitHub repositories
- Access GitHub release downloads
- Works in wonderland
- Multiple URL formats for flexibility
- Performance benefits of Cloudflare's global edge network
- Proper caching for improved performance
- Handles binary files correctly

## URL Formats

This CDN supports the following URL formats:

### 1. Short Format (via /gh/)

```
https://your-worker.domain/gh/username/repo/branch/path/to/file
```

Example:
```
https://cdn.example.com/gh/rayson-chan/repo-name/main/config.ini
```

### 2. Raw File Format (via /raw/)

```
https://your-worker.domain/raw/username/repo/branch/path/to/file
```

Example:
```
https://cdn.example.com/raw/rayson-chan/repo-name/main/config.ini
```

### 3. GitHub Releases Download Format

```
https://your-worker.domain/releases/username/repo/download/tag/filename
```

Example:
```
https://cdn.example.com/releases/rayson-chan/repo-name/download/v1.0.0/app.zip
```

### 4. Direct Raw GitHub URL

Simply prepend your worker domain to any GitHub raw URL:

```
https://your-worker.domain/https://raw.githubusercontent.com/username/repo/branch/path/to/file
```

Example:
```
https://cdn.example.com/https://raw.githubusercontent.com/rayson-chan/repo-name/main/config.ini
```

### 5. URL with Blob (GitHub Web UI Format)

This format supports URLs copied directly from GitHub's web interface:

```
https://your-worker.domain/gh/username/repo/blob/branch/path/to/file
```

Example:
```
https://cdn.example.com/gh/rayson-chan/repo-name/blob/main/config.ini
```

## Deployment Options

### Option 1: Manual Deployment via Cloudflare Dashboard

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to "Workers & Pages"
3. Click "Create Application" and select "Worker"
4. Click "Create Worker" and give it a name
5. Replace the code with the content of `src/index.js`
6. Click "Save and Deploy"
7. After deployment, go to "Settings" → "Variables"
8. Add a secret variable named `GITHUB_TOKEN` with your GitHub personal access token as the value
9. Click "Save and Deploy" again

### Option 2: Manual Deployment via Cloudflare Pages

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to "Workers & Pages"
3. Click "Create Application" and select "Pages"
4. Connect to your GitHub repository
5. Configure build settings:
   - Build command: `npm run build` 
   - Build output directory: `public`
   - Root directory: `/` (default)
6. Under "Environment variables", add a secret variable:
   - Variable name: `GITHUB_TOKEN`
   - Value: Your GitHub personal access token
7. Click "Save and Deploy"
8. After deployment, go to "Functions" tab
9. Enable "Pages Functions" if not already enabled
10. Verify that your static site exists at your Pages URL, but the real functionality 
    will be through the Worker Function code in `src/index.js`

### Option 3: Manual Deployment via Wrangler CLI

1. Install Wrangler CLI:
   ```
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```
   wrangler login
   ```

3. Set up your GitHub token as a secret:
   ```
   wrangler secret put GITHUB_TOKEN
   ```
   (You'll be prompted to enter your token)

4. Deploy to Cloudflare:
   ```
   wrangler publish
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

The raw format is convenient for documentation:

```markdown
Download the file from [here](https://cdn.example.com/raw/username/repo/main/filename.ext)
```

## Security Considerations

- Your GitHub token is stored securely as an encrypted environment variable
- Only grant read permissions to your token
- Consider setting an expiration date on your GitHub token
- Rotate your token periodically

## Limitations

- Maximum file size: 25MB (Cloudflare Worker limit)
- Request timeout: 30 seconds

## Troubleshooting

If you encounter a 404 error:
- Verify that the repository path is correct
- Check that your token has access to the repository
- Ensure the branch name is correct

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
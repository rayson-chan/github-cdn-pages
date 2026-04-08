// /src/index.js

/**
 * GitHub CDN Worker
 *
 * A Cloudflare Worker that serves as a CDN for GitHub repositories,
 * allowing access to both public and private repositories, release files,
 * and raw content even in wonderland.
 *
 * Token resolution order:
 *   1. GITHUB_TOKENS (JSON env var): { "username": "ghp_token", ... }
 *   2. GITHUB_TOKEN  (single token fallback)
 */

/**
 * Resolve the best GitHub token for a given username.
 * @param {object} env - Worker environment bindings
 * @param {string|null} username - GitHub username / org name extracted from the request path
 * @returns {string|undefined}
 */
function resolveToken(env, username) {
  if (env.GITHUB_TOKENS && username) {
    try {
      const map = JSON.parse(env.GITHUB_TOKENS);
      if (map[username]) return map[username];
    } catch (_) {
      // malformed JSON – fall through to single token
    }
  }
  return env.GITHUB_TOKEN;
}

/** Build the Authorization header value (or undefined if no token). */
function authHeader(token) {
  return token ? `token ${token}` : undefined;
}

/** Common fetch helper – returns a Response. */
async function fetchFromGitHub(githubUrl, token, cacheMaxAge, defaultContentType) {
  const headers = { 'User-Agent': 'GitHub-CDN-Worker' };
  const auth = authHeader(token);
  if (auth) headers['Authorization'] = auth;

  const response = await fetch(githubUrl, { headers });

  if (!response.ok) {
    return new Response(`GitHub API error: ${response.status} ${response.statusText}`, {
      status: response.status,
    });
  }

  const content = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || defaultContentType;

  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${cacheMaxAge}`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    console.log('Requested path:', path);

    // ── 1. Direct raw.githubusercontent.com URL ──────────────────────────────
    // Format: /https://raw.githubusercontent.com/username/repo/branch/filepath
    if (path.includes('/https://raw.githubusercontent.com/')) {
      const githubUrl = path.substring(path.indexOf('/https://') + 1);
      console.log('Extracted GitHub URL:', githubUrl);

      // Extract username from raw URL: raw.githubusercontent.com/{username}/...
      const rawMatch = githubUrl.match(/raw\.githubusercontent\.com\/([^/]+)/);
      const username = rawMatch ? rawMatch[1] : null;
      const token = resolveToken(env, username);

      try {
        return await fetchFromGitHub(githubUrl, token, 1800, 'text/plain');
      } catch (error) {
        return new Response(
          `Error fetching content: ${error.message}\nPath: ${path}\nExtracted URL: ${githubUrl}`,
          { status: 500 }
        );
      }
    }

    // ── 2. GitHub Releases download ──────────────────────────────────────────
    // Format: /releases/username/repo/download/tag/filename
    const releaseMatch = path.match(/^\/releases\/([^/]+)\/([^/]+)\/download\/(.+)/);
    if (releaseMatch) {
      const [, username, repo, releasePathAndFile] = releaseMatch;
      const githubUrl = `https://github.com/${username}/${repo}/releases/download/${releasePathAndFile}`;
      const token = resolveToken(env, username);

      try {
        return await fetchFromGitHub(githubUrl, token, 86400, 'application/octet-stream');
      } catch (error) {
        return new Response(`Error fetching release content: ${error.message}`, { status: 500 });
      }
    }

    // ── 3. Raw file shorthand ────────────────────────────────────────────────
    // Format: /raw/username/repo/branch/filepath
    if (path.startsWith('/raw/')) {
      const parts = path.slice(5).split('/');
      if (parts.length >= 3) {
        const [username, repo, branch, ...rest] = parts;
        const filePath = rest.join('/');
        const githubUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${filePath}`;
        const token = resolveToken(env, username);

        try {
          return await fetchFromGitHub(githubUrl, token, 1800, 'text/plain');
        } catch (error) {
          return new Response(`Error fetching raw content: ${error.message}`, { status: 500 });
        }
      }
    }

    // ── 4. /gh/ short format ─────────────────────────────────────────────────
    // Format: /gh/username/repo/branch/filepath
    //         /gh/username/repo/blob/branch/filepath  (GitHub web UI copy-paste)
    if (path.startsWith('/gh/')) {
      const parts = path.slice(4).split('/');
      if (parts.length < 3) {
        return new Response('Invalid path format. Use /gh/username/repo/branch/file_path', {
          status: 400,
        });
      }

      let [username, repo, branch, ...rest] = parts;

      // Handle GitHub web UI "blob/" segment
      if (branch === 'blob' && rest.length > 0) {
        branch = rest[0];
        rest = rest.slice(1);
      }

      const filePath = rest.join('/');
      const githubUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${filePath}`;
      const token = resolveToken(env, username);

      try {
        return await fetchFromGitHub(githubUrl, token, 1800, 'text/plain');
      } catch (error) {
        return new Response(`Error fetching content: ${error.message}`, { status: 500 });
      }
    }

    // ── 5. Root – usage page ─────────────────────────────────────────────────
    if (path === '/' || path === '') {
      return new Response(
        `<html>
  <head>
    <title>GitHub CDN Worker</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
      code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
      pre  { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
      h1, h2 { border-bottom: 1px solid #eee; padding-bottom: 10px; }
    </style>
  </head>
  <body>
    <h1>GitHub CDN Worker</h1>
    <p>A proxy service for GitHub content that works in wonderland.</p>

    <h2>Supported URL Formats:</h2>

    <h3>1. Short Format:</h3>
    <pre><code>https://${url.hostname}/gh/username/repo/branch/file_path</code></pre>

    <h3>2. Raw File Format:</h3>
    <pre><code>https://${url.hostname}/raw/username/repo/branch/file_path</code></pre>

    <h3>3. GitHub Releases Download Format:</h3>
    <pre><code>https://${url.hostname}/releases/username/repo/download/tag/filename</code></pre>

    <h3>4. Direct Raw GitHub URL:</h3>
    <pre><code>https://${url.hostname}/https://raw.githubusercontent.com/username/repo/branch/file_path</code></pre>

    <p>For more information, visit the GitHub repository for this project.</p>
  </body>
</html>`,
        {
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=86400',
          },
        }
      );
    }

    // ── 6. No match ──────────────────────────────────────────────────────────
    return new Response(
      `Invalid path: ${path}\n\nUse one of the following formats:\n` +
        '1. /gh/username/repo/branch/file_path\n' +
        '2. /raw/username/repo/branch/file_path\n' +
        '3. /releases/username/repo/download/tag/filename\n' +
        '4. /https://raw.githubusercontent.com/username/repo/branch/file_path',
      { status: 400 }
    );
  },
};

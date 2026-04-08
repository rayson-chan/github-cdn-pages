// /functions/_middleware.js

// Cloudflare Pages Function - Middleware to handle all GitHub CDN requests
// This file must be placed in a "functions" directory at the project root

function resolveToken(env, username) {
  if (env.GITHUB_TOKENS && username) {
    try {
      const map = JSON.parse(env.GITHUB_TOKENS);
      if (map[username]) return map[username];
    } catch (_) {}
  }
  return env.GITHUB_TOKEN;
}

function authHeaders(token) {
  return {
    ...(token ? { 'Authorization': `token ${token}` } : {}),
    'User-Agent': 'GitHub-CDN-Worker',
  };
}

async function proxyGitHub(githubUrl, token, cacheControl, defaultContentType) {
  const response = await fetch(githubUrl, { headers: authHeaders(token) });

  if (!response.ok) {
    const debugInfo = [
      `GitHub API error: ${response.status} ${response.statusText}`,
      `URL: ${githubUrl}`,
      `Token present: ${!!token}`,
      `Response headers: ${JSON.stringify(Object.fromEntries(response.headers))}`,
    ].join('\n');
    return new Response(debugInfo, { status: response.status });
  }

  const contentType = response.headers.get('content-type') || defaultContentType;
  return new Response(response.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  console.log("Middleware - Requested path:", path);

  if (path === "/" || path === "") {
    return context.next();
  }

  // 1. Direct raw.githubusercontent.com URL
  if (path.includes('/https://raw.githubusercontent.com/')) {
    const githubUrl = path.substring(path.indexOf('/https://') + 1);
    console.log("Middleware - Extracted GitHub URL:", githubUrl);
    const match = githubUrl.match(/raw\.githubusercontent\.com\/([^/]+)/);
    const token = resolveToken(env, match ? match[1] : null);
    try {
      return await proxyGitHub(githubUrl, token, 'no-store, no-cache, must-revalidate', 'text/plain');
    } catch (error) {
      return new Response(`Error fetching content: ${error.message}\nPath: ${path}\nExtracted URL: ${githubUrl}`, { status: 500 });
    }
  }

  // 2. GitHub Releases
  const releaseMatch = path.match(/^\/releases\/([^/]+)\/([^/]+)\/download\/(.+)/);
  if (releaseMatch) {
    const [, username, repo, releasePathAndFile] = releaseMatch;
    const githubUrl = `https://github.com/${username}/${repo}/releases/download/${releasePathAndFile}`;
    const token = resolveToken(env, username);
    try {
      return await proxyGitHub(githubUrl, token, 'no-store, no-cache, must-revalidate', 'application/octet-stream');
    } catch (error) {
      return new Response(`Error fetching release content: ${error.message}`, { status: 500 });
    }
  }

  // 3. /raw/ shorthand
  if (path.startsWith('/raw/')) {
    const parts = path.slice(5).split('/');
    if (parts.length >= 3) {
      const [username, repo, branch, ...rest] = parts;
      const githubUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${rest.join('/')}`;
      const token = resolveToken(env, username);
      try {
        return await proxyGitHub(githubUrl, token, 'public, max-age=1800', 'text/plain');
      } catch (error) {
        return new Response(`Error fetching raw content: ${error.message}`, { status: 500 });
      }
    }
  }

  // 4. /gh/ shorthand
  if (path.startsWith('/gh/')) {
    const parts = path.slice(4).split('/');
    if (parts.length < 3) {
      return new Response('Invalid path format. Use /gh/username/repo/branch/file_path', { status: 400 });
    }
    let [username, repo, branch, ...rest] = parts;
    if (branch === 'blob' && rest.length > 0) {
      branch = rest[0];
      rest = rest.slice(1);
    }
    const githubUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${rest.join('/')}`;
    const token = resolveToken(env, username);
    try {
      return await proxyGitHub(githubUrl, token, 'public, max-age=1800', 'text/plain');
    } catch (error) {
      return new Response(`Error fetching content: ${error.message}`, { status: 500 });
    }
  }

  return new Response(
    `Invalid path: ${path}\n\nUse one of the following formats:\n` +
    '1. /gh/username/repo/branch/file_path\n' +
    '2. /raw/username/repo/branch/file_path\n' +
    '3. /releases/username/repo/download/tag/filename\n' +
    '4. /https://raw.githubusercontent.com/username/repo/branch/file_path',
    { status: 400 }
  );
}

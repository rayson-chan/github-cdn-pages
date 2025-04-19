// /src/index.js

/**
 * GitHub CDN Worker
 * 
 * A Cloudflare Worker that serves as a CDN for GitHub repositories,
 * allowing access to both public and private repositories, release files,
 * and raw content even in wonderland.
 */

export default {
  async fetch(request, env) {
    // Access token from environment variable
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Debug log
    console.log("Requested path:", path);
    
    // Special case for the specific URL pattern that's failing
    if (path.includes('/https://raw.githubusercontent.com/')) {
      // Extract full GitHub URL - directly taking everything from '/https://' onwards
      let githubUrl = path.substring(path.indexOf('/https://') + 1);
      
      console.log("Extracted GitHub URL:", githubUrl);
      
      try {
        // Fetch from GitHub with auth token
        const response = await fetch(githubUrl, {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'User-Agent': 'GitHub-CDN-Worker'
          }
        });
        
        if (!response.ok) {
          return new Response(`GitHub API error: ${response.status} ${response.statusText}`, { 
            status: response.status 
          });
        }
        
        // Get file content and content type
        const content = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'text/plain';
        
        // Set cache headers
        const headers = new Headers({
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
          'Access-Control-Allow-Origin': '*'
        });
        
        return new Response(content, { headers });
      } catch (error) {
        return new Response(`Error fetching content: ${error.message}\nPath: ${path}\nExtracted URL: ${githubUrl}`, { status: 500 });
      }
    }
    
    // Handle GitHub release download URLs
    // Format: /releases/username/repo/download/tag/filename
    if (path.match(/^\/releases\/([^\/]+)\/([^\/]+)\/download\/.+/)) {
      const matches = path.match(/^\/releases\/([^\/]+)\/([^\/]+)\/download\/(.+)/);
      if (matches && matches.length === 4) {
        const [_, username, repo, releasePathAndFile] = matches;
        const githubUrl = `https://github.com/${username}/${repo}/releases/download/${releasePathAndFile}`;
        
        try {
          // Fetch from GitHub with auth token
          const response = await fetch(githubUrl, {
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'User-Agent': 'GitHub-CDN-Worker'
            }
          });
          
          if (!response.ok) {
            return new Response(`GitHub API error: ${response.status} ${response.statusText}`, { 
              status: response.status 
            });
          }
          
          // Get file content and content type
          const content = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || 'application/octet-stream';
          
          // Set cache headers
          const headers = new Headers({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'Access-Control-Allow-Origin': '*'
          });
          
          return new Response(content, { headers });
        } catch (error) {
          return new Response(`Error fetching release content: ${error.message}`, { status: 500 });
        }
      }
    }
    
    // Handle raw file URLs with simplified format
    // Format: /raw/username/repo/branch/filepath
    if (path.startsWith('/raw/')) {
      const parts = path.slice(5).split('/');
      if (parts.length >= 3) {
        const username = parts[0];
        const repo = parts[1];
        const branch = parts[2];
        const filePath = parts.slice(3).join('/');
        
        const githubUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${filePath}`;
        
        try {
          // Fetch from GitHub with auth token
          const response = await fetch(githubUrl, {
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'User-Agent': 'GitHub-CDN-Worker'
            }
          });
          
          if (!response.ok) {
            return new Response(`GitHub API error: ${response.status} ${response.statusText}`, { 
              status: response.status 
            });
          }
          
          // Get file content and content type
          const content = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || 'text/plain';
          
          // Set cache headers
          const headers = new Headers({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
            'Access-Control-Allow-Origin': '*'
          });
          
          return new Response(content, { headers });
        } catch (error) {
          return new Response(`Error fetching raw content: ${error.message}`, { status: 500 });
        }
      }
    }
    
    // Original /gh/ format
    if (path.startsWith('/gh/')) {
      // Extract repo details from path
      const parts = path.slice(4).split('/');
      if (parts.length < 3) {
        return new Response('Invalid path format. Use /gh/username/repo/branch/file_path', { status: 400 });
      }
      
      const username = parts[0];
      const repo = parts[1];
      let branch = parts[2];
      let filePath = parts.slice(3).join('/');
      
      // Handle case where user included "blob/" in the URL (GitHub web UI format)
      if (branch === "blob" && parts.length > 3) {
        branch = parts[3];
        filePath = parts.slice(4).join('/');
      }
      
      // Construct GitHub raw URL
      const githubUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${filePath}`;
      
      try {
        // Fetch from GitHub with auth token for private repos
        const response = await fetch(githubUrl, {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'User-Agent': 'GitHub-CDN-Worker'
          }
        });
        
        if (!response.ok) {
          return new Response(`GitHub API error: ${response.status} ${response.statusText}`, { 
            status: response.status 
          });
        }
        
        // Get file content and content type
        const content = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'text/plain';
        
        // Set cache headers
        const headers = new Headers({
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
          'Access-Control-Allow-Origin': '*'
        });
        
        return new Response(content, { headers });
      } catch (error) {
        return new Response(`Error fetching content: ${error.message}`, { status: 500 });
      }
    }
    
    // Handle root path - show usage information
    if (path === "/" || path === "") {
      return new Response(`
        <html>
          <head>
            <title>GitHub CDN Worker</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
              code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
              pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
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
            
            <p>For more information, visit <a href="https://github.com/rayson-chan/github-cdn-worker">the GitHub repository</a>.</p>
          </body>
        </html>
      `, { 
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=86400'
        } 
      });
    }
    
    // If no format matches, return error with usage instructions and debug info
    return new Response(`Invalid path: ${path}\n\nUse one of the following formats:\n` +
      '1. /gh/username/repo/branch/file_path\n' +
      '2. /raw/username/repo/branch/file_path\n' +
      '3. /releases/username/repo/download/tag/filename\n' +
      '4. /https://raw.githubusercontent.com/username/repo/branch/file_path', 
      { status: 400 });
  }
};
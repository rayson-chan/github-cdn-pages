// /functions/_middleware.js

// Cloudflare Pages Function - Middleware to handle all GitHub CDN requests
// This file must be placed in a "functions" directory at the project root

export async function onRequest(context) {
  const request = context.request;
  // Get the GitHub token from environment variables
  const GITHUB_TOKEN = context.env.GITHUB_TOKEN;
  
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Debug log
  console.log("Middleware - Requested path:", path);
  
  // If path is just "/" or empty, serve the static page
  if (path === "/" || path === "") {
    return context.next();
  }
  
  // Special case for the specific URL pattern that's failing
  if (path.includes('/https://raw.githubusercontent.com/')) {
    // Extract full GitHub URL - directly taking everything from '/https://' onwards
    let githubUrl = path.substring(path.indexOf('/https://') + 1);
    
    console.log("Middleware - Extracted GitHub URL:", githubUrl);
    
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
      
      // Get the response as a stream instead of buffering (more efficient)
      const contentType = response.headers.get('content-type') || 'text/plain';
      
      // Set cache headers
      const headers = new Headers({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
        'Access-Control-Allow-Origin': '*'
      });
      
      // Important: Use the response body directly to stream the content
      return new Response(response.body, { headers });
    } catch (error) {
      return new Response(`Error fetching content: ${error.message}\nPath: ${path}\nExtracted URL: ${githubUrl}`, { status: 500 });
    }
  }
  
  // Rest of the handlers remain the same...
  
  // Handle GitHub release download URLs
  if (path.match(/^\/releases\/([^\/]+)\/([^\/]+)\/download\/.+/)) {
    const matches = path.match(/^\/releases\/([^\/]+)\/([^\/]+)\/download\/(.+)/);
    if (matches && matches.length === 4) {
      const [_, username, repo, releasePathAndFile] = matches;
      const githubUrl = `https://github.com/${username}/${repo}/releases/download/${releasePathAndFile}`;
      
      try {
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
        
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        
        const headers = new Headers({
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });
        
        return new Response(response.body, { headers });
      } catch (error) {
        return new Response(`Error fetching release content: ${error.message}`, { status: 500 });
      }
    }
  }
  
  // Handle raw file URLs
  if (path.startsWith('/raw/')) {
    const parts = path.slice(5).split('/');
    if (parts.length >= 3) {
      const username = parts[0];
      const repo = parts[1];
      const branch = parts[2];
      const filePath = parts.slice(3).join('/');
      
      const githubUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${filePath}`;
      
      try {
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
        
        const contentType = response.headers.get('content-type') || 'text/plain';
        
        const headers = new Headers({
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=1800',
          'Access-Control-Allow-Origin': '*'
        });
        
        return new Response(response.body, { headers });
      } catch (error) {
        return new Response(`Error fetching raw content: ${error.message}`, { status: 500 });
      }
    }
  }
  
  // Original /gh/ format
  if (path.startsWith('/gh/')) {
    const parts = path.slice(4).split('/');
    if (parts.length < 3) {
      return new Response('Invalid path format. Use /gh/username/repo/branch/file_path', { status: 400 });
    }
    
    const username = parts[0];
    const repo = parts[1];
    let branch = parts[2];
    let filePath = parts.slice(3).join('/');
    
    if (branch === "blob" && parts.length > 3) {
      branch = parts[3];
      filePath = parts.slice(4).join('/');
    }
    
    const githubUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch}/${filePath}`;
    
    try {
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
      
      const contentType = response.headers.get('content-type') || 'text/plain';
      
      const headers = new Headers({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=1800',
        'Access-Control-Allow-Origin': '*'
      });
      
      return new Response(response.body, { headers });
    } catch (error) {
      return new Response(`Error fetching content: ${error.message}`, { status: 500 });
    }
  }
  
  // If no format matches, return error with usage instructions
  return new Response(`Invalid path: ${path}\n\nUse one of the following formats:\n` +
    '1. /gh/username/repo/branch/file_path\n' +
    '2. /raw/username/repo/branch/file_path\n' +
    '3. /releases/username/repo/download/tag/filename\n' +
    '4. /https://raw.githubusercontent.com/username/repo/branch/file_path', 
    { status: 400 });
}
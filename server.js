const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cheerio = require('cheerio');

const PORT = Number(process.env.PORT || process.env.SYNC_SERVER_PORT || 3333);
const DB_PATH = path.join(__dirname, 'data', 'sync-db.json');
const FEED_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const ARTICLE_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const feedCache = new Map();
const articleCache = new Map();

function ensureDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function send(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function safeString(value) {
  return String(value || '').trim();
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
}

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function authUser(db, req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return null;
  }

  return db.users.find((user) => user.token === token) || null;
}

function normalizeFeed(feed) {
  const id = safeString(feed.id) || crypto.randomUUID();
  const name = safeString(feed.name);
  const sourceUrl = safeString(feed.sourceUrl) || safeString(feed.url);
  const url = safeString(feed.url) || sourceUrl;
  const createdAt = Number.isFinite(feed.createdAt) ? Number(feed.createdAt) : Date.now();

  if (!name || !sourceUrl || !url) {
    return null;
  }

  return { id, name, sourceUrl, url, createdAt };
}

function dedupeFeeds(feeds) {
  const seen = new Set();
  const unique = [];

  for (const feed of feeds) {
    const normalized = normalizeFeed(feed);
    if (!normalized) {
      continue;
    }

    const key = `${normalized.url.toLowerCase()}|${normalized.sourceUrl.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          resolve(data);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    }).on('error', reject);
  });
}

async function fetchFeedWithCache(feedUrl) {
  const cacheKey = feedUrl.toLowerCase();
  const cached = feedCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < FEED_CACHE_TTL) {
    return cached.data;
  }
  
  const RSS2JSON_ENDPOINT = 'https://api.rss2json.com/v1/api.json?rss_url=';
  const url = `${RSS2JSON_ENDPOINT}${encodeURIComponent(feedUrl)}`;
  const data = await fetchUrl(url);
  
  feedCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
  
  return data;
}

/**
 * Extrait les images d'un article avec plusieurs stratégies
 */
function extractArticleImages($, url, contentSelector = null) {
  const images = new Set();
  const hostname = new URL(url).hostname.toLowerCase();
  
  // Stratégies spécifiques par site
  let $container = null;
  
  // 1. Wallpaper Magazine
  if (hostname.includes('wallpaper.com')) {
    $container = $('.article-wrapper, .wcp-item-content');
  }
  // 2. Creative Review
  else if (hostname.includes('creativereview.co.uk')) {
    $container = $('.article__content, .post-content, article');
  }
  // 3. Web Designer Depot
  else if (hostname.includes('webdesignerdepot.com')) {
    $container = $('article .entry-content, .post-content');
  }
  // 4. Design Week
  else if (hostname.includes('designweek.co.uk')) {
    $container = $('article .article-content, .entry-content');
  }
  // Générique : utiliser le contentSelector ou chercher article
  else if (contentSelector) {
    $container = $(contentSelector);
  } else {
    $container = $('article, .article-content, .post-content, main');
  }
  
  if (!$container || $container.length === 0) {
    $container = $('body');
  }
  
  // Extraire toutes les images du conteneur
  $container.find('img').each((i, img) => {
    const $img = $(img);
    let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
    
    // Aussi vérifier srcset pour les images de meilleure qualité
    const srcset = $img.attr('srcset') || $img.attr('data-srcset');
    if (srcset) {
      // Extraire la plus grande image du srcset
      const srcsetUrls = srcset.split(',').map(s => s.trim().split(' ')[0]);
      if (srcsetUrls.length > 0) {
        src = srcsetUrls[srcsetUrls.length - 1]; // Prendre la dernière (plus grande)
      }
    }
    
    if (src) {
      // Convertir URL relative en absolue
      try {
        const absoluteUrl = new URL(src, url).toString();
        
        // Filtrer les images trop petites (icônes, ads, etc.)
        const width = parseInt($img.attr('width')) || 0;
        const height = parseInt($img.attr('height')) || 0;
        
        // Filtrer par URL (éviter logos, icônes, placeholders)
        const shouldSkip = 
          src.includes('logo') ||
          src.includes('icon') ||
          src.includes('avatar') ||
          src.includes('no_thumb') ||
          src.includes('placeholder') ||
          src.includes('default_thumb') ||
          src.includes('1x1') ||
          (width > 0 && width < 200) ||
          (height > 0 && height < 200);
        
        if (!shouldSkip) {
          images.add(absoluteUrl);
        }
      } catch (e) {
        // URL invalide, ignorer
      }
    }
  });
  
  // Aussi extraire les images de background-image dans les éléments de galerie
  $container.find('[style*="background-image"]').each((i, el) => {
    const style = $(el).attr('style') || '';
    const match = style.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/);
    if (match && match[1]) {
      try {
        const absoluteUrl = new URL(match[1], url).toString();
        if (!absoluteUrl.includes('logo') && !absoluteUrl.includes('icon')) {
          images.add(absoluteUrl);
        }
      } catch (e) {
        // URL invalide, ignorer
      }
    }
  });
  
  return [...images];
}

/**
 * Extrait le contenu principal d'une page HTML avec plusieurs stratégies
 */
function extractArticleContent(html, url) {
  const $ = cheerio.load(html);
  
  // Stratégies d'extraction par site connu
  const hostname = new URL(url).hostname.toLowerCase();
  
  // 1. Wallpaper Magazine
  if (hostname.includes('wallpaper.com')) {
    const $article = $('.article-wrapper, .wcp-item-content');
    if ($article.length > 0) {
      $article.find('script, style, .ad, .advertisement, .social-share, .newsletter-signup').remove();
      const content = $article.html();
      const images = extractArticleImages($, url, '.article-wrapper, .wcp-item-content');
      if (content && content.length > 300) {
        return { content, images, method: 'wallpaper-specific' };
      }
    }
  }
  
  // 2. Web Designer Depot
  if (hostname.includes('webdesignerdepot.com')) {
    const content = $('article .entry-content, .post-content').html();
    const images = extractArticleImages($, url, 'article .entry-content, .post-content');
    if (content) return { content, images, method: 'wdd-specific' };
  }
  
  // 3. Design Week
  if (hostname.includes('designweek.co.uk')) {
    const content = $('article .article-content, .entry-content').html();
    const images = extractArticleImages($, url, 'article .article-content, .entry-content');
    if (content) return { content, images, method: 'designweek-specific' };
  }
  
  // 4. Creative Review
  if (hostname.includes('creativereview.co.uk')) {
    const content = $('.article__content, .post-content, article').html();
    const images = extractArticleImages($, url, '.article__content, .post-content, article');
    if (content) return { content, images, method: 'creativereview-specific' };
  }
  
  // Stratégie générique : Sélecteurs courants
  const commonSelectors = [
    'article',
    '[role="article"]',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.article-body',
    'main article',
    'main .content',
    '.single-post',
    '#article-body',
    '#content article',
  ];
  
  for (const selector of commonSelectors) {
    const $article = $(selector).first();
    if ($article.length > 0) {
      // Nettoyer les éléments indésirables
      $article.find('script, style, iframe[src*="ad"], .ad, .advertisement, .social-share, .related-posts, nav, aside').remove();
      
      const content = $article.html();
      if (content && content.length > 200) {
        const images = extractArticleImages($, url, selector);
        return { content, images, method: `generic-${selector}` };
      }
    }
  }
  
  // Fallback : Chercher le plus grand bloc de texte
  const paragraphs = $('p');
  if (paragraphs.length > 3) {
    let maxParent = null;
    let maxLength = 0;
    
    paragraphs.each((i, p) => {
      const $parent = $(p).parent();
      const text = $parent.text();
      if (text.length > maxLength) {
        maxLength = text.length;
        maxParent = $parent;
      }
    });
    
    if (maxParent && maxLength > 300) {
      const content = maxParent.html();
      const images = extractArticleImages($, url, null);
      return { content, images, method: 'heuristic-text-block' };
    }
  }
  
  return { content: null, images: [], method: 'failed' };
}

/**
 * Récupère et extrait le contenu complet d'un article avec cache
 */
async function fetchArticleContent(articleUrl) {
  const cacheKey = articleUrl.toLowerCase();
  const cached = articleCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < ARTICLE_CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const html = await fetchHtml(articleUrl);
    const extracted = extractArticleContent(html, articleUrl);
    
    const result = {
      url: articleUrl,
      content: extracted.content,
      images: extracted.images || [],
      extractionMethod: extracted.method,
      success: !!extracted.content,
      timestamp: Date.now(),
    };
    
    articleCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });
    
    return result;
  } catch (error) {
    return {
      url: articleUrl,
      content: null,
      images: [],
      success: false,
      error: error.message,
      timestamp: Date.now(),
    };
  }
}

async function main() {
  ensureDb();

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      send(res, 404, { error: 'NOT_FOUND' });
      return;
    }

    if (req.method === 'OPTIONS') {
      send(res, 204, {});
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/auth/register') {
      try {
        const body = await parseBody(req);
        const email = normalizeEmail(body.email);
        const password = safeString(body.password);

        if (!email || !password) {
          send(res, 400, { error: 'INVALID_PAYLOAD' });
          return;
        }

        const db = readDb();
        const existing = db.users.find((user) => user.email === email);
        if (existing) {
          send(res, 409, { error: 'ACCOUNT_EXISTS' });
          return;
        }

        const now = Date.now();
        const user = {
          id: crypto.randomUUID(),
          email,
          salt: crypto.randomBytes(16).toString('hex'),
          passwordHash: '',
          token: createToken(),
          feeds: [],
          createdAt: now,
          updatedAt: now,
        };
        user.passwordHash = hashPassword(password, user.salt);
        db.users.push(user);
        writeDb(db);

        send(res, 200, { token: user.token, user: publicUser(user), feeds: user.feeds });
      } catch {
        send(res, 400, { error: 'INVALID_JSON' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/auth/login') {
      try {
        const body = await parseBody(req);
        const email = normalizeEmail(body.email);
        const password = safeString(body.password);

        if (!email || !password) {
          send(res, 400, { error: 'INVALID_PAYLOAD' });
          return;
        }

        const db = readDb();
        const user = db.users.find((item) => item.email === email);
        if (!user) {
          send(res, 401, { error: 'INVALID_CREDENTIALS' });
          return;
        }

        const hash = hashPassword(password, user.salt);
        if (hash !== user.passwordHash) {
          send(res, 401, { error: 'INVALID_CREDENTIALS' });
          return;
        }

        user.token = createToken();
        user.updatedAt = Date.now();
        writeDb(db);

        send(res, 200, { token: user.token, user: publicUser(user), feeds: user.feeds });
      } catch {
        send(res, 400, { error: 'INVALID_JSON' });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/feed-proxy') {
      const feedUrl = url.searchParams.get('url');
      if (!feedUrl) {
        send(res, 400, { error: 'MISSING_URL' });
        return;
      }

      try {
        const data = await fetchFeedWithCache(feedUrl);
        send(res, 200, data);
      } catch (error) {
        send(res, 500, { error: 'FEED_FETCH_FAILED', message: error.message });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/article-content') {
      const articleUrl = url.searchParams.get('url');
      if (!articleUrl) {
        send(res, 400, { error: 'MISSING_URL' });
        return;
      }

      try {
        const result = await fetchArticleContent(articleUrl);
        send(res, 200, result);
      } catch (error) {
        send(res, 500, { error: 'ARTICLE_FETCH_FAILED', message: error.message });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/account') {
      const db = readDb();
      const user = authUser(db, req);
      if (!user) {
        send(res, 401, { error: 'UNAUTHORIZED' });
        return;
      }

      send(res, 200, { user: publicUser(user), feeds: user.feeds });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/feeds') {
      const db = readDb();
      const user = authUser(db, req);
      if (!user) {
        send(res, 401, { error: 'UNAUTHORIZED' });
        return;
      }

      send(res, 200, { feeds: user.feeds, updatedAt: user.updatedAt });
      return;
    }

    if (req.method === 'PUT' && url.pathname === '/feeds') {
      try {
        const db = readDb();
        const user = authUser(db, req);
        if (!user) {
          send(res, 401, { error: 'UNAUTHORIZED' });
          return;
        }

        const body = await parseBody(req);
        const feeds = Array.isArray(body.feeds) ? body.feeds : [];
        user.feeds = dedupeFeeds(feeds);
        user.updatedAt = Date.now();
        writeDb(db);

        send(res, 200, { feeds: user.feeds, updatedAt: user.updatedAt });
      } catch {
        send(res, 400, { error: 'INVALID_JSON' });
      }
      return;
    }

    send(res, 404, { error: 'NOT_FOUND' });
  });

  server.listen(PORT, () => {
    console.log(`Sync server listening on http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
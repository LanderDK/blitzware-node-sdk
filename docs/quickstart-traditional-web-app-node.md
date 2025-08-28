# Quickstart: Traditional Web App (Node.js)

Build a secure server‑rendered web app using BlitzWare OAuth 2.0 Authorization Code + PKCE with the BlitzWare Node SDK.

## Prerequisites

- A BlitzWare OAuth application (Client ID, Client Secret, Redirect URI)
- Node.js 18+
- HTTPS in production

## 1) Install dependencies

```bash
npm install blitzware-node-sdk express express-session dotenv
```

Optional (Koa):

```bash
npm install koa @koa/router koa-session koa-bodyparser
```

## 2) Configure environment

Create a `.env` file:

```bash
BLITZWARE_CLIENT_ID=your-client-id
BLITZWARE_CLIENT_SECRET=your-client-secret
BLITZWARE_REDIRECT_URI=http://localhost:3000/callback
SESSION_SECRET=replace-with-a-strong-secret
# Optional: override auth base (self-hosted/staging)
# BLITZWARE_BASE_URL=https://auth.blitzware.xyz/api/auth
```

## 3) Express setup (recommended)

Create `server.js` (or `app.js`):

```javascript
// server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const session = require('express-session');
const {
  BlitzWareAuth,
  blitzwareLogin,
  blitzwareCallback,
  blitzwareLogout,
  requireBlitzwareSession,   // session-only protection
  blitzwareAuth,             // token-validated protection
} = require('blitzware-node-sdk');

const app = express();
const port = process.env.PORT || 3000;

// 1) Initialize SDK
const blitzware = new BlitzWareAuth({
  clientId: process.env.BLITZWARE_CLIENT_ID,
  clientSecret: process.env.BLITZWARE_CLIENT_SECRET,
  redirectUri: process.env.BLITZWARE_REDIRECT_URI,
  // baseUrl: process.env.BLITZWARE_BASE_URL, // optional
});

// 2) Session middleware (required)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set true with HTTPS in production
    // sameSite: 'lax' // default is fine for same-site apps
  },
}));

// 3) Public home
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.send(`
      <h1>Welcome, ${req.session.user.username}</h1>
      <p><a href="/dashboard">Dashboard</a> | <a href="/profile">Profile</a> | <a href="/logout">Logout</a></p>
    `);
  }
  res.send(`
    <h1>BlitzWare Node.js Quickstart</h1>
    <p><a href="/login">Login with BlitzWare</a></p>
  `);
});

// 4) Login (PKCE handled for you)
app.get('/login', blitzwareLogin({ blitzware, additionalParams: { scope: 'read write profile email' } }));

// 5) OAuth callback (stores tokens + user in session)
app.get('/callback', blitzwareCallback({
  blitzware,
  successRedirect: '/',
  errorRedirect: '/?error=auth_failed',
}));

// 6a) Protected route (session-only: faster, no token validation each request)
app.get('/dashboard', requireBlitzwareSession({ loginUrl: '/login' }), (req, res) => {
  res.send(`
    <h1>Dashboard</h1>
    <pre>${JSON.stringify({ id: req.blitzwareUser.id, username: req.blitzwareUser.username }, null, 2)}</pre>
    <p><a href="/">Home</a></p>
  `);
});

// 6b) Protected route with token validation + auto refresh
app.get('/profile', blitzwareAuth({ blitzware, loginUrl: '/login', autoRefresh: true }), (req, res) => {
  res.send(`
    <h1>Profile (Token Validated)</h1>
    <pre>${JSON.stringify({ id: req.blitzwareUser.id, username: req.blitzwareUser.username }, null, 2)}</pre>
    <p><a href="/">Home</a></p>
  `);
});

// 7) Logout (front-channel by default to clear the auth service session cookies)
app.get('/logout', blitzwareLogout({ blitzware, redirectUrl: '/', frontChannel: true }));

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
```

Run:

```bash
node server.js
```

Then visit http://localhost:3000

## 4) Koa setup (optional)

```javascript
// koa-server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Koa = require('koa');
const Router = require('@koa/router');
const KoaSession = require('koa-session');
const session = KoaSession && KoaSession.default ? KoaSession.default : KoaSession;
const bodyParser = require('koa-bodyparser');
const { BlitzWareAuth } = require('blitzware-node-sdk');

const app = new Koa();
const router = new Router();
const port = process.env.PORT || 3001;

const blitzware = new BlitzWareAuth({
  clientId: process.env.BLITZWARE_CLIENT_ID,
  clientSecret: process.env.BLITZWARE_CLIENT_SECRET,
  redirectUri: process.env.BLITZWARE_REDIRECT_URI,
  // baseUrl: process.env.BLITZWARE_BASE_URL,
});

app.keys = [process.env.SESSION_SECRET];
napp.use(session({ key: 'koa.sess', maxAge: 24*60*60*1000, httpOnly: true, sameSite: 'lax', secure: false }, app));
app.use(bodyParser());

router.get('/', async (ctx) => {
  if (ctx.session.user) {
    ctx.type = 'html';
    ctx.body = `<h1>Welcome, ${ctx.session.user.username}</h1><a href="/logout">Logout</a>`;
    return;
  }
  ctx.type = 'html';
  ctx.body = `<h1>BlitzWare Koa Quickstart</h1><a href="/login">Login</a>`;
});

router.get('/login', async (ctx) => {
  const state = blitzware.generateState();
  const { url, codeVerifier } = blitzware.getAuthorizationUrl({
    state,
    additionalParams: { scope: 'read write profile email' },
  });
  ctx.session.oauthState = state;
  ctx.session.codeVerifier = codeVerifier;
  ctx.redirect(url);
});

router.get('/callback', async (ctx) => {
  try {
    const tokens = await blitzware.handleCallback(ctx.query, ctx.session.oauthState, ctx.session.codeVerifier);
    ctx.session.accessToken = tokens.access_token;
    if (tokens.refresh_token) ctx.session.refreshToken = tokens.refresh_token;
    const user = await blitzware.getUserInfo(tokens.access_token);
    ctx.session.user = user;
    ctx.session.oauthState = null;
    ctx.session.codeVerifier = null;
    ctx.redirect('/');
  } catch {
    ctx.redirect('/?error=auth_failed');
  }
});

// Protected API (minimal user shape)
router.get('/api/user', async (ctx) => {
  if (!ctx.session.accessToken) return (ctx.status = 401, ctx.body = { error: 'Not authenticated' });
  try {
    const user = await blitzware.validateTokenAndGetUser(ctx.session.accessToken);
    ctx.body = { id: user.id, username: user.username };
  } catch {
    if (ctx.session.refreshToken) {
      try {
        const t = await blitzware.refreshToken(ctx.session.refreshToken);
        ctx.session.accessToken = t.access_token;
        if (t.refresh_token) ctx.session.refreshToken = t.refresh_token;
        const user = await blitzware.getUserInfo(t.access_token);
        ctx.session.user = user;
        ctx.body = { id: user.id, username: user.username };
        return;
      } catch { /* ignore */ }
    }
    ctx.status = 401;
    ctx.body = { error: 'Authentication failed' };
  }
});

// Front-channel logout (clears auth service cookies)
router.get('/logout', async (ctx) => {
  ctx.session.accessToken = null;
  ctx.session.refreshToken = null;
  ctx.session.user = null;

  const authBase = blitzware.getBaseUrl().replace(/\/$/, '');
  const logoutUrl = `${authBase}/logout`;
  const clientId = blitzware.getConfig().clientId;
  const redirectUrl = '/';

  ctx.type = 'html';
  ctx.body = `<!doctype html><html><body>
    <form id="f" method="POST" action="${logoutUrl}">
      <input type="hidden" name="client_id" value="${clientId}">
    </form>
    <script>
      (function(){try{
        fetch('${logoutUrl}',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:'${clientId}'})})
          .catch(function(){})
          .finally(function(){location.replace('${redirectUrl}');});
      }catch(e){document.getElementById('f').submit();setTimeout(function(){location.replace('${redirectUrl}');},500);}})();
    </script>
  </body></html>`;
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(port, () => console.log(`Koa listening at http://localhost:${port}`));
```

## 5) How it works

- PKCE + state: The SDK generates a state and PKCE verifier/challenge; state defends against CSRF; PKCE protects the code exchange.
- Callback: `blitzwareCallback` verifies state, exchanges code for tokens, and stores user and tokens in session.
- Protection:
  - `requireBlitzwareSession`: checks user presence in session (no per‑request token validation).
  - `blitzwareAuth`: validates tokens each request and auto‑refreshes when possible.
- Logout (front-channel): Performs a browser POST to the auth service so its session cookies are sent, then redirects back.

## 6) Configuration reference

SDK constructor:

```ts
new BlitzWareAuth({
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  baseUrl?: string, // optional override
})
```

Common helpers:

- `blitzwareLogin({ blitzware, additionalParams?, stateProperty?, codeVerifierProperty?, scope? })`
- `blitzwareCallback({ blitzware, successRedirect?, errorRedirect?, accessTokenProperty?, refreshTokenProperty?, userProperty?, stateProperty?, codeVerifierProperty? })`
- `blitzwareLogout({ blitzware, redirectUrl?, frontChannel? })`
- `requireBlitzwareSession({ loginUrl?, userProperty?, attachUser? })`
- `blitzwareAuth({ blitzware, loginUrl?, autoRefresh?, attachUser? })`

Manual (advanced):

```js
// Generate URL + PKCE; store state + codeVerifier in session
const state = blitzware.generateState();
const { url, codeVerifier } = blitzware.getAuthorizationUrl({
  state,
  additionalParams: { scope: 'read write profile email' },
});
req.session.oauthState = state;
req.session.codeVerifier = codeVerifier;
res.redirect(url);

// In callback
const tokens = await blitzware.handleCallback(req.query, req.session.oauthState, req.session.codeVerifier);
```

## 7) Production checklist

- Use HTTPS; set session cookie `secure: true` in production
- Use a durable session store (e.g., Redis) instead of in‑memory
- Configure BlitzWare Redirect URI(s) to match deployed URLs
- If your auth domain is cross‑site, ensure CORS allows credentials and consider top‑level navigation for logout if third‑party cookies are blocked
- Don’t log tokens or secrets; the SDK middleware is no‑op logging by default. Provide your own logger if needed
- Rotate client secrets and keep them in environment variables or your secret manager

## 8) Troubleshooting

- `missing_authorization_code` / `invalid_state`
  - Ensure you store and compare state correctly; don’t lose session between `/login` and `/callback`.
- `token_exchange_failed` / `token_refresh_failed`
  - Verify client credentials and `redirectUri` match your BlitzWare app config.
- “Not authenticated” after logout
  - Front‑channel logout is required so the auth service receives its session cookies. Use `blitzwareLogout` with `frontChannel: true` (default).
- CORS/cookies issues
  - If your app and auth service are on different domains, the auth service must allow credentials and cookies must be configured for cross-site as needed.

## 9) API surface (most used)

- `blitzware.getAuthorizationUrl({ state, additionalParams? })` → `{ url, codeVerifier }`
- `blitzware.handleCallback(query, expectedState?, codeVerifier?)` → `TokenResponse`
- `blitzware.refreshToken(refreshToken)` → `TokenResponse`
- `blitzware.getUserInfo(accessToken)` → `BlitzWareUser`
- `blitzware.introspectToken(token, 'access_token'|'refresh_token')` → `TokenIntrospectionResponse`
- `blitzware.revokeToken(token, hint?)` → `void`
- `blitzware.getBaseUrl()` → `string`
- `blitzware.getConfig()` → `{ clientId, redirectUri, baseUrl? }`

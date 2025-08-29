# BlitzWare Node.js SDK

A comprehensive OAuth 2.0 SDK for Node.js applications supporting both Express.js and Koa.js frameworks with Auth0-style middleware patterns.

## 🚀 Quick Start

Build a secure server‑rendered web app using BlitzWare OAuth 2.0 Authorization Code flow with automatic route management and session handling.

### Prerequisites

- A BlitzWare OAuth application (Client ID, Client Secret, Redirect URI)
- Node.js 18+
- HTTPS in production

### Install Dependencies

**Express.js:**
```bash
npm install blitzware-node-sdk express express-session dotenv
```

**Koa.js:**
```bash
npm install blitzware-node-sdk koa koa-router koa-session koa-bodyparser dotenv
```

### Environment Configuration

Create a `.env` file:

```env
BLITZWARE_DOMAIN=your-domain.blitzware.xyz
BLITZWARE_CLIENT_ID=your-client-id
BLITZWARE_CLIENT_SECRET=your-client-secret
BLITZWARE_REDIRECT_URI=http://localhost:3000/callback
SESSION_SECRET=replace-with-a-strong-secret
```

## 🎯 Auth0-Style Middleware (Recommended)

The BlitzWare SDK provides Auth0-style middleware that automatically creates authentication routes and handles the complete OAuth flow.

### Express.js Example

```javascript
const express = require('express');
const session = require('express-session');
const { expressAuth, expressRequiresAuth } = require('blitzware-node-sdk');
require('dotenv').config();

const app = express();

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set true with HTTPS in production
}));

// BlitzWare authentication - automatically creates /login, /logout, /callback routes
app.use(expressAuth({
  domain: process.env.BLITZWARE_DOMAIN,
  clientId: process.env.BLITZWARE_CLIENT_ID,
  clientSecret: process.env.BLITZWARE_CLIENT_SECRET,
  redirectUri: process.env.BLITZWARE_REDIRECT_URI,
  scopes: ['openid', 'profile', 'email']
}));

// Public route
app.get('/', (req, res) => {
  if (req.session.user) {
    res.send(`<h1>Welcome, ${req.session.user.name}!</h1><a href="/logout">Logout</a>`);
  } else {
    res.send(`<h1>BlitzWare Express</h1><a href="/login">Login</a>`);
  }
});

// Protected route
app.get('/profile', expressRequiresAuth(), (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.session.user
  });
});

app.listen(3000, () => {
  console.log('Express app running on http://localhost:3000');
});
```

### Koa.js Example

```javascript
const Koa = require('koa');
const session = require('koa-session');
const { koaAuth, koaRequiresAuth } = require('blitzware-node-sdk');
require('dotenv').config();

const app = new Koa();

// Session configuration
app.keys = [process.env.SESSION_SECRET];
app.use(session({
  key: 'koa.sess',
  maxAge: 86400000, // 24 hours
  httpOnly: true,
  signed: true
}, app));

// BlitzWare authentication - automatically handles /login, /logout, /callback routes
app.use(koaAuth({
  domain: process.env.BLITZWARE_DOMAIN,
  clientId: process.env.BLITZWARE_CLIENT_ID,
  clientSecret: process.env.BLITZWARE_CLIENT_SECRET,
  redirectUri: process.env.BLITZWARE_REDIRECT_URI,
  scopes: ['openid', 'profile', 'email']
}));

// Public route
app.use(async (ctx, next) => {
  if (ctx.path === '/') {
    if (ctx.session.user) {
      ctx.body = `<h1>Welcome, ${ctx.session.user.name}!</h1><a href="/logout">Logout</a>`;
    } else {
      ctx.body = `<h1>BlitzWare Koa</h1><a href="/login">Login</a>`;
    }
    return;
  }
  await next();
});

// Protected route
app.use(koaRequiresAuth());
app.use(async (ctx, next) => {
  if (ctx.path === '/profile') {
    ctx.body = {
      message: 'This is a protected route',
      user: ctx.session.user
    };
    return;
  }
  await next();
});

app.listen(3001, () => {
  console.log('Koa app running on http://localhost:3001');
});
```

## 🏗️ Advanced Examples

The SDK includes comprehensive multi-file examples demonstrating production-ready patterns:

### Run Examples

```bash
# Simple examples (single file)
npm run example:express     # Express basic example
npm run example:koa        # Koa basic example

# Advanced examples (multi-file projects)
npm run example:express-advanced     # Express with routing, middleware, templates
npm run example:koa-advanced        # Koa with routing, middleware, templates

# Development mode with auto-restart
npm run example:express-advanced-dev
npm run example:koa-advanced-dev
```

### Advanced Example Features

- **Modular Architecture**: Separate route files and middleware
- **Role-based Access Control**: Admin and user roles with permission checks
- **Template Engine**: EJS templates with responsive design
- **API Endpoints**: RESTful JSON API with authentication
- **Error Handling**: Comprehensive error middleware
- **Request Logging**: Detailed request/response logging
- **Session Security**: Secure server-side session management

## 📚 API Reference

### Authentication Middleware

#### Express
```javascript
const { expressAuth, expressRequiresAuth } = require('blitzware-node-sdk');

// Setup authentication (creates /login, /logout, /callback routes)
app.use(expressAuth(config));

// Protect routes
app.get('/protected', expressRequiresAuth(), (req, res) => {
  // req.session.user is available
});
```

#### Koa
```javascript
const { koaAuth, koaRequiresAuth } = require('blitzware-node-sdk');

// Setup authentication (handles /login, /logout, /callback routes)
app.use(koaAuth(config));

// Protect routes
app.use('/protected', koaRequiresAuth(), async (ctx) => {
  // ctx.session.user is available
});
```

### Backward Compatibility

The SDK maintains backward compatibility with legacy aliases:

```javascript
const { auth, requiresAuth } = require('blitzware-node-sdk');
// These are aliases for expressAuth and expressRequiresAuth
```

### Configuration Options

```typescript
interface AuthConfig {
  domain: string;           // your-domain.blitzware.xyz
  clientId: string;         // OAuth client ID
  clientSecret: string;     // OAuth client secret
  redirectUri: string;      // OAuth redirect URI
  scopes?: string[];        // OAuth scopes (default: ['openid', 'profile', 'email'])
  baseUrl?: string;         // Override auth server URL
}
```

### Automatic Routes

When you use `expressAuth()` or `koaAuth()`, the following routes are automatically created:

- `GET /login` - Initiates OAuth login flow
- `GET /logout` - Logs out user and clears session  
- `GET /callback` - OAuth callback handler

### Session Data

After successful authentication, user data is available in the session:

```javascript
// Express
req.session.user = {
  id: "user-id",
  name: "User Name", 
  email: "user@example.com",
  roles: ["user", "admin"], // if applicable
  // ... other user properties
};

// Koa
ctx.session.user = {
  id: "user-id",
  name: "User Name",
  email: "user@example.com", 
  roles: ["user", "admin"], // if applicable
  // ... other user properties
};
```

```javascript
const { BlitzWareAuth } = require('blitzware-node-sdk');

const blitzware = new BlitzWareAuth({
  domain: process.env.BLITZWARE_DOMAIN,
  clientId: process.env.BLITZWARE_CLIENT_ID,
  clientSecret: process.env.BLITZWARE_CLIENT_SECRET,
  redirectUri: process.env.BLITZWARE_REDIRECT_URI
});

// Generate authorization URL
const state = blitzware.generateState();
const { url, codeVerifier } = blitzware.getAuthorizationUrl({
  state,
  additionalParams: { scope: 'openid profile email' }
});

// Store state and codeVerifier in session
req.session.oauthState = state;
req.session.codeVerifier = codeVerifier;

// Redirect to authorization URL
res.redirect(url);

// Handle callback
const tokens = await blitzware.handleCallback(
  req.query, 
  req.session.oauthState, 
  req.session.codeVerifier
);

// Get user info
const user = await blitzware.getUserInfo(tokens.access_token);
```

## �️ Security Features

- **PKCE (Proof Key for Code Exchange)**: Automatically implemented for enhanced security
- **State Parameter**: CSRF protection for OAuth flows
- **Secure Sessions**: Server-side session management
- **Token Validation**: Optional token validation on each request
- **Front-channel Logout**: Proper logout handling to clear auth server sessions

## 🚦 Role-based Access Control

Both frameworks support role-based access control:

### Express Example
```javascript
app.get('/admin', expressRequiresAuth(), (req, res, next) => {
  if (!req.session.user.roles?.includes('admin')) {
    return res.status(403).send('Admin access required');
  }
  res.send('Admin dashboard');
});
```

### Koa Example  
```javascript
app.use('/admin', koaRequiresAuth(), async (ctx, next) => {
  if (!ctx.session.user.roles?.includes('admin')) {
    ctx.status = 403;
    ctx.body = 'Admin access required';
    return;
  }
  await next();
});
```

## 📝 Migration Guide

### From Manual Implementation
If you're currently using manual OAuth implementation, you can migrate to the Auth0-style middleware:

**Before (Manual):**
```javascript
app.get('/login', (req, res) => {
  // Manual OAuth URL generation
});
app.get('/callback', (req, res) => {
  // Manual token exchange
});
```

**After (Middleware):**
```javascript
app.use(expressAuth(config)); // Handles everything automatically
```

### Framework Compatibility
- **Express**: Use `expressAuth()` and `expressRequiresAuth()`
- **Koa**: Use `koaAuth()` and `koaRequiresAuth()`
- **Legacy**: `auth()` and `requiresAuth()` are aliases for Express functions

## 🔍 Troubleshooting

### Common Issues

**Missing Dependencies:**
```bash
npm install express express-session  # For Express
npm install koa koa-router koa-session  # For Koa
```

**Session Issues:**
- Ensure session middleware is configured before BlitzWare middleware
- Set appropriate cookie settings for your environment
- Use a session store like Redis in production

**Authentication Errors:**
- Verify environment variables are correctly set
- Check that redirect URI matches your BlitzWare app configuration
- Ensure your domain is accessible from the BlitzWare auth server

**CORS Issues:**
- Configure CORS headers if your app and auth server are on different domains
- Ensure credentials are included in cross-origin requests

## 📊 Production Checklist

- [ ] Use HTTPS in production
- [ ] Set `secure: true` for session cookies with HTTPS
- [ ] Use a persistent session store (Redis, MongoDB, etc.)
- [ ] Configure proper CORS headers if needed
- [ ] Set up error monitoring and logging
- [ ] Rotate client secrets regularly
- [ ] Monitor authentication metrics
- [ ] Test logout functionality thoroughly

## 🔗 Examples and Resources

### Repository Examples
- [`examples/express-example.js`](examples/express-example.js) - Basic Express implementation
- [`examples/koa-example.js`](examples/koa-example.js) - Basic Koa implementation  
- [`examples/express-advanced/`](examples/express-advanced/) - Advanced Express with routing and templates
- [`examples/koa-advanced/`](examples/koa-advanced/) - Advanced Koa with routing and templates

### External Resources
- [BlitzWare Documentation](https://docs.blitzware.xyz)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [Express.js Documentation](https://expressjs.com/)
- [Koa.js Documentation](https://koajs.com/)

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.
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

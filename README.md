# BlitzWare Node.js SDK

A comprehensive Node.js SDK for integrating with BlitzWare's OAuth 2.0 authentication service. This SDK is specifically designed for **Traditional Web Applications** (confidential clients) that can securely store client secrets.

## Features

- 🔐 **OAuth 2.0 Authorization Code + PKCE** for confidential clients
- 🛡️ **CSRF Protection** with state parameter validation
- 🔄 **Token Refresh** support for long-term sessions
- 📝 **Token Introspection** (RFC 7662) for token validation
- 🚫 **Token Revocation** for secure logout
- 🧩 **Express middleware** for login, callback, and logout flows
- 🎯 **TypeScript Support** with full type definitions
- 🚀 **Easy Integration** with Express.js and other Node.js frameworks
- 📚 **Comprehensive Documentation** and examples

## Installation

```bash
npm install blitzware-node-sdk
```

## Quick Start

### 1. Initialize the SDK

```javascript
const { BlitzWareAuth } = require('blitzware-node-sdk');

const blitzware = new BlitzWareAuth({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'http://localhost:3000/callback',
  // Optional: override the default API base URL (useful for self-hosted or staging)
  // baseUrl: 'https://auth.blitzware.xyz/api/auth'
});
```

### 2. Start the login flow (middleware)

Prefer the built-in middleware which handles state + PKCE for you:

```javascript
const { blitzwareLogin } = require('blitzware-node-sdk');

app.get('/login', blitzwareLogin({
  blitzware,
  // optional: add query params via additionalParams
  additionalParams: { scope: 'read write profile email' },
}));
```

If you need manual control, you can generate the URL yourself and store the PKCE verifier in session:

```javascript
const state = blitzware.generateState();
const { url: authUrl, codeVerifier } = blitzware.getAuthorizationUrl({
  state,
  additionalParams: { scope: 'read write profile email' }
});
req.session.oauthState = state;
req.session.codeVerifier = codeVerifier;
res.redirect(authUrl);
```

### 3. Handle Authorization Callback

```javascript
app.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const tokenResponse = await blitzware.handleCallback(
      { code, state },
      req.session.oauthState,
      req.session.codeVerifier // if you used manual PKCE above
    );
    
    // Store tokens securely
    req.session.accessToken = tokenResponse.access_token;
    req.session.refreshToken = tokenResponse.refresh_token;
    
    // Get user information
    const user = await blitzware.getUserInfo(tokenResponse.access_token);
    req.session.user = user;
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Authentication failed:', error);
    res.status(400).send('Authentication failed');
  }
});
```

## API Reference

### Constructor

```typescript
new BlitzWareAuth(config: BlitzWareAuthConfig)
```

#### BlitzWareAuthConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `clientId` | string | ✅ | OAuth 2.0 Client ID |
| `clientSecret` | string | ✅ | OAuth 2.0 Client Secret |
| `redirectUri` | string | ✅ | Authorized redirect URI |
| `baseUrl` | string | ❌ | Override API base URL (defaults to BlitzWare cloud) |

### Methods

#### `generateState(): string`
Generates a cryptographically secure random state parameter for CSRF protection.

```javascript
const state = blitzware.generateState();
```

#### `getAuthorizationUrl(params?: AuthorizationUrlParams): { url: string; codeVerifier: string }`
Generates the authorization URL and a PKCE `codeVerifier` you must retain for the callback.

```javascript
const { url, codeVerifier } = blitzware.getAuthorizationUrl({
  state: 'your-state-parameter',
  additionalParams: { scope: 'read write profile email', prompt: 'consent' }
});
```

#### `handleCallback(callbackParams: AuthorizationCallbackParams, expectedState?: string, codeVerifier?: string): Promise<TokenResponse>`
Handles the authorization callback and exchanges the code for tokens.

```javascript
const tokenResponse = await blitzware.handleCallback(
  { code: 'auth-code', state: 'state-value' },
  'expected-state-value',
  'pkce-code-verifier' // if you used PKCE
);
```

#### `exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<TokenResponse>`
Exchanges an authorization code for access and refresh tokens. Include `codeVerifier` when using PKCE.

```javascript
const tokens = await blitzware.exchangeCodeForTokens('authorization-code');
```

#### `refreshToken(refreshToken: string): Promise<TokenResponse>`
Refreshes an access token using a refresh token.

```javascript
const newTokens = await blitzware.refreshToken('refresh-token');
```

#### `getUserInfo(accessToken: string): Promise<BlitzWareUser>`
Retrieves user information using an access token.

```javascript
const user = await blitzware.getUserInfo('access-token');
```

#### `introspectToken(token: string, tokenTypeHint?: 'access_token' | 'refresh_token'): Promise<TokenIntrospectionResponse>`
Introspects a token to get its metadata (RFC 7662).

```javascript
const tokenInfo = await blitzware.introspectToken('token', 'access_token');
if (tokenInfo.active) {
  console.log('Token is valid');
}
```

#### `revokeToken(token: string, tokenTypeHint?: 'access_token' | 'refresh_token'): Promise<void>`
Revokes a token (access token or refresh token).

```javascript
await blitzware.revokeToken('access-token', 'access_token');
```

#### `validateTokenAndGetUser(accessToken: string): Promise<BlitzWareUser>`
Validates a token and returns user information if the token is active.

```javascript
try {
  const user = await blitzware.validateTokenAndGetUser('access-token');
  console.log('Token is valid, user:', user);
} catch (error) {
  console.log('Token is invalid or expired');
}
```

## Express.js Integration Example (with middleware)

```javascript
const express = require('express');
const session = require('express-session');
const { BlitzWareAuth, blitzwareLogin, blitzwareCallback, blitzwareLogout } = require('blitzware-node-sdk');

const app = express();
const blitzware = new BlitzWareAuth({
  clientId: process.env.BLITZWARE_CLIENT_ID,
  clientSecret: process.env.BLITZWARE_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/callback',
});

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Routes
app.get('/login', blitzwareLogin({
  blitzware,
  additionalParams: { scope: 'read write profile email' }
}));

app.get('/callback', async (req, res) => {
  try {
    const tokenResponse = await blitzware.handleCallback(
      req.query,
      req.session.oauthState,
      req.session.codeVerifier
    );
    
    req.session.accessToken = tokenResponse.access_token;
    req.session.refreshToken = tokenResponse.refresh_token;
    
    const user = await blitzware.getUserInfo(tokenResponse.access_token);
    req.session.user = user;
    
    delete req.session.oauthState;
    res.redirect('/dashboard');
  } catch (error) {
    res.status(400).send(`Authentication failed: ${error.message}`);
  }
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.json({
    message: 'Welcome to your dashboard!',
    user: req.session.user
  });
});

app.get('/logout', blitzwareLogout({
  blitzware,
  redirectUrl: '/',
  frontChannel: true // perform browser POST to auth /logout to clear service session
}));

app.listen(3000);
```

## Error Handling

The SDK throws `BlitzWareAuthError` instances for authentication-related errors:

```javascript
try {
  const tokens = await blitzware.exchangeCodeForTokens('invalid-code');
} catch (error) {
  if (error instanceof BlitzWareAuthError) {
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    console.log('Error details:', error.details);
  }
}
```

Common error codes:
- `missing_client_id` - Client ID not provided
- `missing_client_secret` - Client Secret not provided  
- `missing_redirect_uri` - Redirect URI not provided
- `invalid_state` - State parameter mismatch
- `missing_authorization_code` - Authorization code not found
- `token_exchange_failed` - Failed to exchange code for tokens
- `token_refresh_failed` - Failed to refresh token
- `userinfo_failed` - Failed to get user information
- `token_inactive` - Token is not active
- `network_error` - Network connectivity issues

## TypeScript Support

The SDK includes comprehensive TypeScript definitions:

```typescript
import { BlitzWareAuth, BlitzWareAuthConfig, BlitzWareUser, TokenResponse } from 'blitzware-node-sdk';

const config: BlitzWareAuthConfig = {
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'http://localhost:3000/callback',
};

const blitzware = new BlitzWareAuth(config);

// TypeScript will provide full type checking and IntelliSense
const user: BlitzWareUser = await blitzware.getUserInfo('access-token');
```

## Security Best Practices

1. **Store client secrets securely** - Never expose client secrets in client-side code
2. **Use HTTPS in production** - Always use secure connections for token exchange
3. **Validate state parameters** - Always verify state parameters to prevent CSRF attacks
4. **Store tokens securely** - Use secure session storage or databases for tokens
5. **Implement token refresh** - Handle token expiration gracefully
6. **Logout via front-channel** - Use the provided logout middleware to clear the service session
7. **Use environment variables** - Store sensitive configuration in environment variables

## License

MIT

## Support

For questions and support, please visit the [BlitzWare documentation](https://docs.blitzware.xyz) or open an issue on GitHub.

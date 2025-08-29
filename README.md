# BlitzWare Node.js SDK

A comprehensive OAuth 2.0 SDK for Node.js applications supporting both Express.js and Koa.js frameworks with middleware patterns.

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
BLITZWARE_CLIENT_ID=your-client-id
BLITZWARE_CLIENT_SECRET=your-client-secret
BLITZWARE_REDIRECT_URI=http://localhost:3000/callback
SESSION_SECRET=replace-with-a-strong-secret
```

## 🎯 Middleware (Recommended)

The BlitzWare SDK provides middleware that automatically creates authentication routes and handles the complete OAuth flow.

### Express.js Example

```javascript
const express = require("express");
const session = require("express-session");
const { expressAuth, expressRequiresAuth } = require("blitzware-node-sdk");
require("dotenv").config();

const app = express();

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set true with HTTPS in production
  })
);

// BlitzWare authentication - automatically creates /login, /logout, /callback routes
app.use(
  expressAuth({
    clientId: process.env.BLITZWARE_CLIENT_ID,
    clientSecret: process.env.BLITZWARE_CLIENT_SECRET,
    redirectUri: process.env.BLITZWARE_REDIRECT_URI,
    scopes: ["openid", "profile", "email"],
  })
);

// Public route
app.get("/", (req, res) => {
  if (req.session.user) {
    res.send(
      `<h1>Welcome, ${req.session.user.name}!</h1><a href="/logout">Logout</a>`
    );
  } else {
    res.send(`<h1>BlitzWare Express</h1><a href="/login">Login</a>`);
  }
});

// Protected route
app.get("/profile", expressRequiresAuth(), (req, res) => {
  res.json({
    message: "This is a protected route",
    user: req.session.user,
  });
});

app.listen(3000, () => {
  console.log("Express app running on http://localhost:3000");
});
```

### Koa.js Example

```javascript
const Koa = require("koa");
const session = require("koa-session");
const { koaAuth, koaRequiresAuth } = require("blitzware-node-sdk");
require("dotenv").config();

const app = new Koa();

// Session configuration
app.keys = [process.env.SESSION_SECRET];
app.use(
  session(
    {
      key: "koa.sess",
      maxAge: 86400000, // 24 hours
      httpOnly: true,
      signed: true,
    },
    app
  )
);

// BlitzWare authentication - automatically handles /login, /logout, /callback routes
app.use(
  koaAuth({
    clientId: process.env.BLITZWARE_CLIENT_ID,
    clientSecret: process.env.BLITZWARE_CLIENT_SECRET,
    redirectUri: process.env.BLITZWARE_REDIRECT_URI,
    scopes: ["openid", "profile", "email"],
  })
);

// Public route
app.use(async (ctx, next) => {
  if (ctx.path === "/") {
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
  if (ctx.path === "/profile") {
    ctx.body = {
      message: "This is a protected route",
      user: ctx.session.user,
    };
    return;
  }
  await next();
});

app.listen(3001, () => {
  console.log("Koa app running on http://localhost:3001");
});
```

## 📚 API Reference

### Authentication Middleware

#### Express

```javascript
const { expressAuth, expressRequiresAuth } = require("blitzware-node-sdk");

// Setup authentication (creates /login, /logout, /callback routes)
app.use(expressAuth(config));

// Protect routes
app.get("/protected", expressRequiresAuth(), (req, res) => {
  // req.session.user is available
});
```

#### Koa

```javascript
const { koaAuth, koaRequiresAuth } = require("blitzware-node-sdk");

// Setup authentication (handles /login, /logout, /callback routes)
app.use(koaAuth(config));

// Protect routes
app.use("/protected", koaRequiresAuth(), async (ctx) => {
  // ctx.session.user is available
});
```

### Configuration Options

```typescript
interface AuthConfig {
  clientId: string; // OAuth client ID
  clientSecret: string; // OAuth client secret
  redirectUri: string; // OAuth redirect URI
  scopes?: string[]; // OAuth scopes (default: ['openid', 'profile', 'email'])
  baseUrl?: string; // Override auth server URL
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

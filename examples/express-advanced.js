const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const express = require("express");
const session = require("express-session");
const {
  BlitzWareAuth,
  blitzwareAuth,
  blitzwareCallback,
  blitzwareLogout,
  requireBlitzwareSession,
} = require("../dist");

const app = express();
const port = process.env.PORT || 3000;

// Initialize BlitzWare SDK
const blitzware = new BlitzWareAuth({
  clientId: process.env.BLITZWARE_CLIENT_ID || "your-client-id",
  clientSecret: process.env.BLITZWARE_CLIENT_SECRET || "your-client-secret",
  redirectUri:
    process.env.BLITZWARE_REDIRECT_URI || `http://localhost:${port}/callback`,
});

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Parse JSON bodies
app.use(express.json());

// Home route - accessible to everyone
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>BlitzWare Node.js SDK - Advanced Example</title></head>
      <body>
        <h1>BlitzWare Node.js SDK Advanced Example</h1>
        <p>This example demonstrates the middleware features.</p>
        
        ${
          req.session.user
            ? `
          <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <h3>✅ You are logged in!</h3>
            <p><strong>Username:</strong> ${req.session.user.username}</p>
            <p><strong>Email:</strong> ${
              req.session.user.email || "Not provided"
            }</p>
            <p><strong>User ID:</strong> ${req.session.user.id}</p>
          </div>
          
          <h3>Available Routes:</h3>
          <ul>
            <li><a href="/dashboard">Dashboard (Protected)</a></li>
            <li><a href="/profile">Profile (Protected with Token Validation)</a></li>
            <li><a href="/api/user">User API (JSON, Protected)</a></li>
            <li><a href="/logout">Logout</a></li>
          </ul>
        `
            : `
          <div style="background: #ffe8e8; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <h3>❌ You are not logged in</h3>
            <p>Please log in to access protected features.</p>
          </div>
          
          <p><a href="/login" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login with BlitzWare</a></p>
        `
        }
        
        <hr>
        <h3>Public Routes:</h3>
        <ul>
          <li><a href="/public">Public Page</a></li>
          <li><a href="/api/status">API Status (JSON)</a></li>
        </ul>
      </body>
    </html>
  `);
});

// Public routes
app.get("/public", (req, res) => {
  res.send(`
    <h1>Public Page</h1>
    <p>This page is accessible to everyone.</p>
    <a href="/">← Back to Home</a>
  `);
});

app.get("/api/status", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    authenticated: !!req.session.user,
  });
});

// Login route
app.get("/login", (req, res) => {
  try {
    const state = blitzware.generateState();
    req.session.oauthState = state;

    const { url: authUrl, codeVerifier } = blitzware.getAuthorizationUrl({
      state,
    });
    req.session.codeVerifier = codeVerifier;
    res.redirect(authUrl);
  } catch (error) {
    console.error("Login error");
    res.status(500).send(`
      <h1>Login Failed</h1>
      <p>Error: ${error.message}</p>
      <a href="/">← Back to Home</a>
    `);
  }
});

// OAuth callback using middleware
app.get(
  "/callback",
  blitzwareCallback({
    blitzware,
    successRedirect: "/",
    errorRedirect: "/?error=auth_failed",
  })
);

// Logout using middleware
app.get(
  "/logout",
  blitzwareLogout({
    blitzware,
    redirectUrl: "/",
    frontChannel: true,
  })
);

// Protected routes using session-only middleware (faster, doesn't validate tokens on every request)
app.get(
  "/dashboard",
  requireBlitzwareSession({ loginUrl: "/login" }),
  (req, res) => {
    res.send(`
    <html>
      <head><title>Dashboard</title></head>
      <body>
        <h1>Dashboard</h1>
        <p>Welcome to your dashboard, ${req.blitzwareUser.username}!</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3>Your Information:</h3>
          <pre>${JSON.stringify(
            { id: req.blitzwareUser.id, username: req.blitzwareUser.username },
            null,
            2
          )}</pre>
        </div>
        
        <p><strong>Note:</strong> This route uses session-only authentication for better performance.</p>
        
        <p>
          <a href="/profile">View Profile (with Token Validation)</a> | 
          <a href="/">← Back to Home</a>
        </p>
      </body>
    </html>
  `);
  }
);

// Protected route with full token validation and auto-refresh
app.get(
  "/profile",
  blitzwareAuth({
    blitzware,
    loginUrl: "/login",
    autoRefresh: true,
  }),
  (req, res) => {
    res.send(`
    <html>
      <head><title>Profile</title></head>
      <body>
        <h1>Profile</h1>
        <p>This page validates your token on every request and automatically refreshes it if needed.</p>
        
        <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3>✅ Token Validated Successfully</h3>
          <p>Your token is active and valid.</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3>Fresh User Data:</h3>
          <pre>${JSON.stringify(
            { id: req.blitzwareUser.id, username: req.blitzwareUser.username },
            null,
            2
          )}</pre>
        </div>
        
        <p>
          <a href="/dashboard">Back to Dashboard</a> | 
          <a href="/">← Back to Home</a>
        </p>
      </body>
    </html>
  `);
  }
);

// Protected API routes
app.get(
  "/api/user",
  blitzwareAuth({
    blitzware,
    loginUrl: "/login",
    autoRefresh: true,
  }),
  (req, res) => {
    res.json({
      success: true,
      user: req.blitzwareUser,
      tokenValidated: true,
      timestamp: new Date().toISOString(),
    });
  }
);

// API route that returns detailed token information
app.get(
  "/api/token/info",
  blitzwareAuth({
    blitzware,
    loginUrl: "/login",
    autoRefresh: true,
  }),
  async (req, res) => {
    try {
      const tokenInfo = await blitzware.introspectToken(
        req.blitzwareAccessToken,
        "access_token"
      );
      res.json({
        success: true,
        tokenInfo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error");
  res.status(500).send(`
    <h1>Server Error</h1>
    <p>An unexpected error occurred.</p>
    <a href="/">← Back to Home</a>
  `);
});

// 404 handler
app.use((req, res) => {
  res.status(404).send(`
    <h1>Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <a href="/">← Back to Home</a>
  `);
});

app.listen(port, () => {
  console.log(
    `BlitzWare Advanced Example listening at http://localhost:${port}`
  );
  console.log("\n🚀 Features demonstrated:");
  console.log("  ✅ OAuth 2.0 Authorization Code Flow");
  console.log("  ✅ Automatic token refresh");
  console.log("  ✅ Express middleware integration");
  console.log("  ✅ Session-based authentication");
  console.log("  ✅ Token validation and introspection");
  console.log("  ✅ Secure token revocation on logout");
  console.log("  ✅ Error handling");

  console.log("\n📋 Setup checklist:");
  console.log(
    `  ${process.env.BLITZWARE_CLIENT_ID ? "✅" : "❌"} Client ID configured`
  );
  console.log(
    `  ${
      process.env.BLITZWARE_CLIENT_SECRET ? "✅" : "❌"
    } Client Secret configured`
  );
  console.log(
    `  ${process.env.SESSION_SECRET ? "✅" : "❌"} Session Secret configured`
  );

  if (
    !process.env.BLITZWARE_CLIENT_ID ||
    !process.env.BLITZWARE_CLIENT_SECRET
  ) {
    console.log("\n⚠️  To fully test the application:");
    console.log("   1. Fill in your credentials in .env");
    console.log("   2. Fill in your BlitzWare OAuth credentials");
    console.log("   3. Restart the application");
  }

  console.log(
    `\n🌐 Configure your OAuth app redirect URI to: http://localhost:${port}/callback`
  );
});

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const express = require("express");
const session = require("express-session");
const {
  BlitzWareAuth,
  blitzwareLogin,
  blitzwareCallback,
  blitzwareLogout,
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

// Session middleware for storing user state
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to true in production with HTTPS
  })
);

// Home route
app.get("/", (req, res) => {
  if (req.session.user) {
    res.send(`
      <h1>Welcome, ${req.session.user.username}!</h1>
      <p>Email: ${req.session.user.email || "Not provided"}</p>
      <p>User ID: ${req.session.user.id}</p>
      <a href="/logout">Logout</a>
    `);
  } else {
    res.send(`
      <h1>BlitzWare Node.js SDK Example</h1>
      <p>You are not logged in.</p>
      <a href="/login">Login with BlitzWare</a>
    `);
  }
});

// Initiate login using middleware
app.get(
  "/login",
  blitzwareLogin({
    blitzware,
  })
);

// Handle OAuth callback using middleware
app.get(
  "/callback",
  blitzwareCallback({
    blitzware,
    successRedirect: "/",
    errorRedirect: "/login?error=auth_failed",
  })
);

// Protected route example
app.get("/api/user", async (req, res) => {
  try {
    if (!req.session.accessToken) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Validate token and get fresh user data
    const user = await blitzware.validateTokenAndGetUser(
      req.session.accessToken
    );
    res.json(user);
  } catch (error) {
    console.error("User API error");

    // Token might be expired, try to refresh
    if (req.session.refreshToken) {
      try {
        const tokenResponse = await blitzware.refreshToken(
          req.session.refreshToken
        );
        req.session.accessToken = tokenResponse.access_token;

        if (tokenResponse.refresh_token) {
          req.session.refreshToken = tokenResponse.refresh_token;
        }

        // Try again with new token
        const user = await blitzware.getUserInfo(tokenResponse.access_token);
        req.session.user = user;
        return res.json(user);
      } catch (refreshError) {
        console.warn("Token refresh failed");
        // Clear session and require re-authentication
        req.session.destroy();
        return res
          .status(401)
          .json({ error: "Session expired, please log in again" });
      }
    }

    res.status(401).json({ error: "Authentication failed" });
  }
});

// Logout using middleware
app.get(
  "/logout",
  blitzwareLogout({
    blitzware,
    redirectUrl: "/",
    frontChannel: true,
  })
);

app.listen(port, () => {
  console.log(`BlitzWare example app listening at http://localhost:${port}`);
  console.log("Make sure to:");
  console.log("1. Fill in your credentials in .env");
  console.log(
    "2. Configure your OAuth application redirect URI to: http://localhost:" +
      port +
      "/callback"
  );
  console.log("3. Set a secure session secret in production");
});

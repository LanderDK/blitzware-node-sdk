const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const Koa = require("koa");
const Router = require("@koa/router");
const KoaSession = require("koa-session");
const session =
  KoaSession && KoaSession.default ? KoaSession.default : KoaSession;
const bodyParser = require("koa-bodyparser");
const { BlitzWareAuth } = require("../dist");

const app = new Koa();
const router = new Router();
const port = process.env.PORT || 3001;

// Initialize BlitzWare SDK
const blitzware = new BlitzWareAuth({
  clientId: process.env.BLITZWARE_CLIENT_ID || "your-client-id",
  clientSecret: process.env.BLITZWARE_CLIENT_SECRET || "your-client-secret",
  redirectUri:
    process.env.BLITZWARE_REDIRECT_URI || `http://localhost:${port}/callback`,
});

// Koa requires signing keys for sessions
app.keys = [process.env.SESSION_SECRET || "your-session-secret"];

// Session middleware
app.use(
  session(
    {
      key: "koa.sess",
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: false, // set true in production behind HTTPS
      renew: false,
      rolling: false,
    },
    app
  )
);

app.use(bodyParser());

// Home route
router.get("/", async (ctx) => {
  if (ctx.session.user) {
    ctx.type = "html";
    ctx.body = `
      <h1>Welcome, ${ctx.session.user.username}!</h1>
      <p>Email: ${ctx.session.user.email || "Not provided"}</p>
      <p>User ID: ${ctx.session.user.id}</p>
      <p><a href="/api/user">View user JSON</a></p>
      <a href="/logout">Logout</a>
    `;
  } else {
    ctx.type = "html";
    ctx.body = `
      <h1>BlitzWare Node.js SDK (Koa) Example</h1>
      <p>You are not logged in.</p>
      <a href="/login">Login with BlitzWare</a>
    `;
  }
});

// Initiate login (manual PKCE example)
router.get("/login", async (ctx) => {
  const state = blitzware.generateState();
  const { url: authUrl, codeVerifier } = blitzware.getAuthorizationUrl({
    state,
    additionalParams: { scope: "read write profile email" },
  });
  ctx.session.oauthState = state;
  ctx.session.codeVerifier = codeVerifier;
  ctx.status = 302;
  ctx.redirect(authUrl);
});

// OAuth callback
router.get("/callback", async (ctx) => {
  try {
    const tokenResponse = await blitzware.handleCallback(
      ctx.query,
      ctx.session.oauthState,
      ctx.session.codeVerifier
    );

    ctx.session.accessToken = tokenResponse.access_token;
    if (tokenResponse.refresh_token) {
      ctx.session.refreshToken = tokenResponse.refresh_token;
    }

    const user = await blitzware.getUserInfo(tokenResponse.access_token);
    ctx.session.user = user;

    ctx.session.oauthState = null;
    ctx.session.codeVerifier = null;

    ctx.redirect("/");
  } catch (error) {
    console.error("OAuth callback error:", error);
    ctx.status = 400;
    ctx.body = `Authentication failed: ${error.message}`;
  }
});

// Protected API route
router.get("/api/user", async (ctx) => {
  if (!ctx.session.accessToken) {
    ctx.status = 401;
    ctx.body = { error: "Not authenticated" };
    return;
  }
  try {
  const user = await blitzware.validateTokenAndGetUser(
      ctx.session.accessToken
    );
  ctx.body = { id: user.id, username: user.username };
  } catch (error) {
    // Try refresh if available
    if (ctx.session.refreshToken) {
      try {
        const tokenResponse = await blitzware.refreshToken(
          ctx.session.refreshToken
        );
        ctx.session.accessToken = tokenResponse.access_token;
        if (tokenResponse.refresh_token) {
          ctx.session.refreshToken = tokenResponse.refresh_token;
        }
  const user = await blitzware.getUserInfo(tokenResponse.access_token);
  ctx.session.user = user;
  ctx.body = { id: user.id, username: user.username };
        return;
      } catch (refreshErr) {
        console.error("Token refresh failed:", refreshErr);
      }
    }
    ctx.status = 401;
    ctx.body = { error: "Authentication failed" };
  }
});

// Logout: front-channel flow to clear auth service session cookies
router.get("/logout", async (ctx) => {
  // Clear local session state first
  ctx.session.accessToken = null;
  ctx.session.refreshToken = null;
  ctx.session.user = null;

  const authBase = blitzware.getBaseUrl().replace(/\/$/, "");
  const logoutUrl = `${authBase}/logout`;
  const clientId = blitzware.getConfig().clientId;
  const redirectUrl = "/";

  ctx.type = "html";
  ctx.body = `<!doctype html>
<html>
  <head>
    <meta http-equiv="referrer" content="no-referrer">
    <meta charset="utf-8">
    <title>Logging out…</title>
  </head>
  <body>
    <form id="logoutForm" method="POST" action="${logoutUrl}">
      <input type="hidden" name="client_id" value="${clientId}">
    </form>
    <script>
      (function() {
        try {
          fetch('${logoutUrl}', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: '${clientId}' })
          }).catch(function(){ /* ignore */ }).finally(function(){
            window.location.replace('${redirectUrl}');
          });
        } catch (e) {
          document.getElementById('logoutForm').submit();
          setTimeout(function(){ window.location.replace('${redirectUrl}'); }, 500);
        }
      })();
    </script>
  </body>
  </html>`;
});

app.use(router.routes()).use(router.allowedMethods());

app.listen(port, () => {
  console.log(`BlitzWare Koa example listening at http://localhost:${port}`);
  console.log("Make sure to:");
  console.log("1. Fill in your credentials in .env");
  console.log(
    "2. Configure your OAuth application redirect URI to: http://localhost:" +
      port +
      "/callback"
  );
  console.log("3. Set a secure session secret in production");
});

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { BlitzWareAuth } = require("../dist");

const port = process.env.PORT || 3000;

async function basicExample() {
  // Initialize BlitzWare SDK
  const blitzware = new BlitzWareAuth({
    clientId: process.env.BLITZWARE_CLIENT_ID || "your-client-id",
    clientSecret: process.env.BLITZWARE_CLIENT_SECRET || "your-client-secret",
    redirectUri:
      process.env.BLITZWARE_REDIRECT_URI || `http://localhost:${port}/callback`,
  });

  try {
    console.log("=== BlitzWare Node.js SDK Basic Example ===\n");

    // 1. Generate authorization URL
    const state = blitzware.generateState();
    const { url: authUrl, codeVerifier } = blitzware.getAuthorizationUrl({
      state,
    });

    console.log("1. Authorization URL (with PKCE):");
    console.log(authUrl);
    console.log(`\nGenerated PKCE code verifier: [hidden for security]`);
    console.log("\nUser should visit this URL to authorize the application.\n");

    // 2. Simulate authorization callback (you would get this from your web server)
    // In a real application, this comes from the OAuth provider's redirect
    const mockCode = "authorization_code_from_callback";

    console.log(
      "2. After user authorization, you would receive a callback with:"
    );
    console.log(`   - code: ${mockCode}`);
    console.log(`   - state: ${state}`);
    console.log(`   - code_verifier (from session): ${codeVerifier}`);
    console.log();

    // 3. Exchange code for tokens with PKCE (this would be done in your callback handler)
    console.log("3. Exchange authorization code for tokens...");
    // Note: This will fail with a mock code, just for demonstration
    try {
      const tokenResponse = await blitzware.exchangeCodeForTokens(
        mockCode,
        codeVerifier
      );
      const mask = (t) =>
        typeof t === "string" && t.length > 12
          ? `${t.slice(0, 8)}…${t.slice(-4)}`
          : "[redacted]";
      console.log("Token Response (redacted):", {
        token_type: tokenResponse.token_type,
        expires_in: tokenResponse.expires_in,
        scope: tokenResponse.scope,
        access_token: mask(tokenResponse.access_token),
        refresh_token: tokenResponse.refresh_token
          ? mask(tokenResponse.refresh_token)
          : undefined,
      });

      // 4. Get user information
      console.log("\n4. Get user information...");
      const user = await blitzware.getUserInfo(tokenResponse.access_token);
      console.log("User (id + username only):", {
        id: user.id,
        username: user.username,
      });

      // 5. Introspect token
      console.log("\n5. Introspect access token...");
      const introspection = await blitzware.introspectToken(
        tokenResponse.access_token,
        "access_token"
      );
      console.log("Token introspection:", {
        active: introspection.active,
        exp: introspection.exp,
      });

      // 6. Refresh token if available
      if (tokenResponse.refresh_token) {
        console.log("\n6. Refresh access token...");
        const refreshedTokens = await blitzware.refreshToken(
          tokenResponse.refresh_token
        );
        console.log("Refreshed tokens (redacted):", {
          token_type: refreshedTokens.token_type,
          expires_in: refreshedTokens.expires_in,
          scope: refreshedTokens.scope,
          access_token: mask(refreshedTokens.access_token),
          refresh_token: refreshedTokens.refresh_token
            ? mask(refreshedTokens.refresh_token)
            : undefined,
        });
      }
    } catch (error) {
      console.log("Expected error with mock code:", error.message);
      console.log("\nIn a real application:");
      console.log("- Use the actual authorization code from the callback");
      console.log("- Handle the callback in your web server");
      console.log("- Store tokens securely (database, session, etc.)");
    }

    console.log("\n=== Example complete ===");
    console.log("\nTo run a full example:");
    console.log("1. Update the client credentials");
    console.log("2. Run the Express example: node examples/express-example.js");
    console.log("3. Visit http://localhost:3000");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Token validation example
async function tokenValidationExample() {
  const blitzware = new BlitzWareAuth({
    clientId: "your-client-id",
    clientSecret: "your-client-secret",
    redirectUri: "http://localhost:3000/callback",
  });

  const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // Mock JWT token

  try {
    console.log("\n=== Token Validation Example ===");

    // Check if token is active
    const introspection = await blitzware.introspectToken(
      mockToken,
      "access_token"
    );

    if (introspection.active) {
      console.log("Token is active");
      console.log("Token details:", introspection);

      // Get user info if token is active
      const user = await blitzware.getUserInfo(mockToken);
      console.log("User details:", user);
    } else {
      console.log("Token is not active");
    }
  } catch (error) {
    console.log("Token validation failed:", error.message);
  }
}

// Error handling example
async function errorHandlingExample() {
  const blitzware = new BlitzWareAuth({
    clientId: "invalid-client-id",
    clientSecret: "invalid-client-secret",
    redirectUri: "http://localhost:3000/callback",
  });

  console.log("\n=== Error Handling Example ===");

  try {
    await blitzware.exchangeCodeForTokens("invalid-code", "invalid-verifier");
  } catch (error) {
    if (error.name === "BlitzWareAuthError") {
      console.log("BlitzWare Auth Error:");
      console.log("- Code:", error.code);
      console.log("- Message:", error.message);
      console.log("- Details:", error.details);
    } else {
      console.log("Other error:", error.message);
    }
  }
}

// Run examples
if (require.main === module) {
  basicExample()
    .then(() => tokenValidationExample())
    .then(() => errorHandlingExample())
    .catch(console.error);
}

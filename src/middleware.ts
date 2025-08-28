import { Request, Response, NextFunction } from "express";
import { BlitzWareAuth } from "./BlitzWareAuth";
import { BlitzWareUser, BlitzWareAuthError } from "./types";

type Logger = {
  error?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  info?: (...args: any[]) => void;
  debug?: (...args: any[]) => void;
};

const noop = () => {};
const defaultLogger: Required<Logger> = {
  error: noop,
  warn: noop,
  info: noop,
  debug: noop,
};

function normalizeLogger(l?: Logger): Required<Logger> {
  return {
    error: l?.error ?? noop,
    warn: l?.warn ?? noop,
    info: l?.info ?? noop,
    debug: l?.debug ?? noop,
  };
}

/**
 * Configuration for BlitzWare Express middleware
 */
export interface BlitzWareMiddlewareConfig {
  /** BlitzWare authentication instance */
  blitzware: BlitzWareAuth;
  /** Property name in session to store access token (default: 'accessToken') */
  accessTokenProperty?: string;
  /** Property name in session to store refresh token (default: 'refreshToken') */
  refreshTokenProperty?: string;
  /** Property name in session to store user data (default: 'user') */
  userProperty?: string;
  /** Whether to automatically refresh expired tokens (default: true) */
  autoRefresh?: boolean;
  /** Redirect URL for unauthenticated requests (default: '/login') */
  loginUrl?: string;
  /** Whether to attach user data to request object (default: true) */
  attachUser?: boolean;
  /** Optional logger (console-like). Defaults to no-op to avoid leaking logs. */
  logger?: Logger;
}

/**
 * Express middleware for BlitzWare authentication
 *
 * This middleware automatically handles token validation, refresh, and user attachment.
 * It requires express-session to be configured.
 *
 * @param config - Middleware configuration
 * @returns Express middleware function
 */
export function blitzwareAuth(config: BlitzWareMiddlewareConfig) {
  const {
    blitzware,
    accessTokenProperty = "accessToken",
    refreshTokenProperty = "refreshToken",
    userProperty = "user",
    autoRefresh = true,
    loginUrl = "/login",
    attachUser = true,
  } = config;

  const logger = normalizeLogger(config.logger);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = req.session as any;

      if (!session) {
        logger.error(
          "Session not found. Make sure express-session middleware is configured."
        );
        return res.status(500).send("Session configuration error");
      }

      const accessToken = session[accessTokenProperty];

      if (!accessToken) {
        return res.redirect(loginUrl);
      }

      try {
        // Validate token and get user info
        const user = await blitzware.validateTokenAndGetUser(accessToken);

        if (attachUser) {
          (req as any).blitzwareUser = user;
          (req as any).blitzwareAccessToken = accessToken;
        }

        // Update user data in session
        session[userProperty] = user;

        next();
  } catch (error) {
        // Token might be expired, try to refresh if enabled
        if (autoRefresh && session[refreshTokenProperty]) {
          try {
            const tokenResponse = await blitzware.refreshToken(
              session[refreshTokenProperty]
            );

            // Update tokens in session
            session[accessTokenProperty] = tokenResponse.access_token;
            if (tokenResponse.refresh_token) {
              session[refreshTokenProperty] = tokenResponse.refresh_token;
            }

            // Get user info with new token
            const user = await blitzware.getUserInfo(
              tokenResponse.access_token
            );

            if (attachUser) {
              (req as any).blitzwareUser = user;
              (req as any).blitzwareAccessToken = tokenResponse.access_token;
            }

            session[userProperty] = user;

            next();
          } catch (refreshError) {
            logger.warn("Token refresh failed");
            // Clear session and redirect to login
            session[accessTokenProperty] = null;
            session[refreshTokenProperty] = null;
            session[userProperty] = null;
            res.redirect(loginUrl);
          }
        } else {
          // No refresh token or auto-refresh disabled
          logger.warn("Token validation failed");
          session[accessTokenProperty] = null;
          session[refreshTokenProperty] = null;
          session[userProperty] = null;
          res.redirect(loginUrl);
        }
      }
    } catch (error) {
      logger.error("BlitzWare middleware error");
      res.status(500).send("Authentication error");
    }
  };
}

/**
 * Express middleware that only requires a valid session but doesn't validate tokens
 *
 * This is useful for routes that need user information but don't need to validate
 * the token on every request (for performance reasons).
 *
 * @param config - Middleware configuration
 * @returns Express middleware function
 */
export function requireBlitzwareSession(
  config: Pick<
    BlitzWareMiddlewareConfig,
    "userProperty" | "loginUrl" | "attachUser"
  >
) {
  const {
    userProperty = "user",
    loginUrl = "/login",
    attachUser = true,
  } = config;
  const logger = defaultLogger;

  return (req: Request, res: Response, next: NextFunction) => {
    const session = req.session as any;

    if (!session) {
      logger.error(
        "Session not found. Make sure express-session middleware is configured."
      );
      return res.status(500).send("Session configuration error");
    }

    const user = session[userProperty];

    if (!user) {
      return res.redirect(loginUrl);
    }

    if (attachUser) {
      (req as any).blitzwareUser = user;
    }

    next();
  };
}

/**
 * Express route handler for OAuth callback
 *
 * This helper handles the OAuth callback flow and sets up the session.
 *
 * @param config - Configuration object
 * @returns Express route handler
 */
export function blitzwareCallback(config: {
  blitzware: BlitzWareAuth;
  successRedirect?: string;
  errorRedirect?: string;
  accessTokenProperty?: string;
  refreshTokenProperty?: string;
  userProperty?: string;
  stateProperty?: string;
  codeVerifierProperty?: string;
  logger?: Logger;
}) {
  const {
    blitzware,
    successRedirect = "/",
    errorRedirect = "/login?error=auth_failed",
    accessTokenProperty = "accessToken",
    refreshTokenProperty = "refreshToken",
    userProperty = "user",
    stateProperty = "oauthState",
    codeVerifierProperty = "codeVerifier",
  } = config;
  const logger = normalizeLogger(config.logger);

  return async (req: Request, res: Response) => {
    try {
      const session = req.session as any;

      if (!session) {
        logger.error(
          "Session not found. Make sure express-session middleware is configured."
        );
        return res.status(500).send("Session configuration error");
      }

      const expectedState = session[stateProperty];
      const codeVerifier = session[codeVerifierProperty];

      // Handle the callback with PKCE
      const tokenResponse = await blitzware.handleCallback(
        req.query,
        expectedState,
        codeVerifier
      );

      // Store tokens in session
      session[accessTokenProperty] = tokenResponse.access_token;
      if (tokenResponse.refresh_token) {
        session[refreshTokenProperty] = tokenResponse.refresh_token;
      }

      // Get user information
      const user = await blitzware.getUserInfo(tokenResponse.access_token);
      session[userProperty] = user;

      // Clear OAuth state and PKCE verifier
      session[stateProperty] = null;
      session[codeVerifierProperty] = null;

      res.redirect(successRedirect);
    } catch (error) {
      logger.warn("OAuth callback failed");

      // Safely append error details to the redirect URL without duplicating ? or &
      const url = new URL(
        errorRedirect,
        // base needed for relative URLs; will be ignored if absolute
        `${req.protocol}://${req.get("host")}`
      );
      if (error instanceof BlitzWareAuthError) {
        url.searchParams.set("error_code", error.code);
      } else {
        url.searchParams.set("error", "auth_failed");
      }

      res.redirect(url.toString());
    }
  };
}

/**
 * Express route handler for login initiation
 *
 * This helper generates the authorization URL with PKCE and redirects the user.
 *
 * @param config - Configuration object
 * @returns Express route handler
 */
export function blitzwareLogin(config: {
  blitzware: BlitzWareAuth;
  scope?: string;
  stateProperty?: string;
  codeVerifierProperty?: string;
  additionalParams?: Record<string, string>;
  logger?: Logger;
}) {
  const {
    blitzware,
    scope,
    stateProperty = "oauthState",
    codeVerifierProperty = "codeVerifier",
    additionalParams = {},
  } = config;
  const logger = normalizeLogger(config.logger);

  return async (req: Request, res: Response) => {
    try {
      const session = req.session as any;

      if (!session) {
        logger.error(
          "Session not found. Make sure express-session middleware is configured."
        );
        return res.status(500).send("Session configuration error");
      }

      // Generate state and PKCE parameters
      const state = blitzware.generateState();

      // Generate authorization URL with PKCE
      const { url: authUrl, codeVerifier } = blitzware.getAuthorizationUrl({
        state,
        additionalParams: {
          ...(scope ? { scope } : {}),
          ...additionalParams,
        },
      });

      // Store in session for later verification
      session[stateProperty] = state;
      session[codeVerifierProperty] = codeVerifier;

      res.redirect(authUrl);
    } catch (error) {
  logger.error("Login error");
      res.status(500).send("Login failed");
    }
  };
}

/**
 * Express route handler for logout
 *
 * This helper handles logout from BlitzWare service and local session cleanup.
 * The logout service automatically revokes all tokens for the client.
 *
 * @param config - Configuration object
 * @returns Express route handler
 */
export function blitzwareLogout(config: {
  blitzware: BlitzWareAuth;
  redirectUrl?: string;
  accessTokenProperty?: string;
  refreshTokenProperty?: string;
  userProperty?: string;
  // If true, perform a front-channel logout by posting from the browser to the auth service
  // This ensures the auth service receives its session cookies (required for server-side sessions)
  frontChannel?: boolean;
  logger?: Logger;
}) {
  const {
    blitzware,
    redirectUrl = "/",
    accessTokenProperty = "accessToken",
    refreshTokenProperty = "refreshToken",
    userProperty = "user",
    frontChannel = true,
  } = config;
  const logger = normalizeLogger(config.logger);

  return async (req: Request, res: Response) => {
    try {
      const session = req.session as any;

      if (!session) {
        logger.error(
          "Session not found. Make sure express-session middleware is configured."
        );
        return res.redirect(redirectUrl);
      }

      // Clear local session first
      session[accessTokenProperty] = null;
      session[refreshTokenProperty] = null;
      session[userProperty] = null;

      if (frontChannel) {
        // Use a browser-based POST to the auth service so its HttpOnly cookies are included
        const authBase = blitzware.getBaseUrl().replace(/\/$/, "");
        const logoutUrl = `${authBase}/logout`;
        const clientId = blitzware.getConfig().clientId;

        // Render a minimal HTML page that posts with credentials and then redirects back
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(200).send(`<!doctype html>
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
          // Try fetch with credentials first
          fetch('${logoutUrl}', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: '${clientId}' })
          }).catch(function(){ /* ignore */ }).finally(function(){
            window.location.replace('${redirectUrl}');
          });
        } catch (e) {
          // Fallback: submit a standard POST form
          document.getElementById('logoutForm').submit();
          setTimeout(function(){ window.location.replace('${redirectUrl}'); }, 500);
        }
      })();
    </script>
  </body>
</html>`);
        return;
      }

      // Back-channel (server-to-server) as a fallback only
      try {
        await blitzware.logout();
      } catch (error) {
        logger.warn("Service logout (back-channel) failed");
      }
      res.redirect(redirectUrl);
    } catch (error) {
      logger.error("Logout error");
      // Redirect anyway to prevent users from being stuck
      res.redirect(redirectUrl);
    }
  };
}

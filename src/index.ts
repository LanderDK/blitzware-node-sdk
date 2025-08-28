// Main exports for the BlitzWare Node.js SDK
export { BlitzWareAuth } from './BlitzWareAuth';
export {
  BlitzWareAuthError,
  BlitzWareAuthConfig,
  BlitzWareUser,
  TokenResponse,
  TokenIntrospectionResponse,
  AuthorizationUrlParams,
  AuthorizationCallbackParams,
} from './types';

// Express.js middleware exports
export {
  blitzwareAuth,
  requireBlitzwareSession,
  blitzwareLogin,
  blitzwareCallback,
  blitzwareLogout,
  BlitzWareMiddlewareConfig,
} from './middleware';

// Default export for convenience
export { BlitzWareAuth as default } from './BlitzWareAuth';

import { BlitzWareUser } from './types';

declare global {
  namespace Express {
    interface Request {
      blitzwareUser?: BlitzWareUser;
      blitzwareAccessToken?: string;
    }
  }
}

export {};

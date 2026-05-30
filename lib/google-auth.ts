import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { GoogleAuth } from 'google-auth-library';

// OAuth (used for Gmail send-as-organiser; Phase 1+).
export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// Service account (used for Sheets/Forms read+write; recommended for Phase 0/1).
const SERVICE_ACCOUNT_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
];

export function getOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(state?: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_OAUTH_SCOPES,
    state,
  });
}

export function getOAuthClientWithRefreshToken(): OAuth2Client {
  const client = getOAuth2Client();
  const refreshToken = process.env.GOOGLE_SHEETS_REFRESH_TOKEN;
  if (refreshToken) {
    client.setCredentials({ refresh_token: refreshToken });
  }
  return client;
}

function getServiceAccountCredentials():
  | { credentials: object }
  | { keyFile: string }
  | null {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEYFILE;
  if (keyFile) return { keyFile };

  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (b64) {
    const json = Buffer.from(b64, 'base64').toString('utf-8');
    return { credentials: JSON.parse(json) };
  }
  return null;
}

export function getServiceAccountAuth(): GoogleAuth | null {
  const cfg = getServiceAccountCredentials();
  if (!cfg) return null;
  return new GoogleAuth({
    ...cfg,
    scopes: SERVICE_ACCOUNT_SCOPES,
  });
}

// Smart picker: service account preferred for Sheets/Forms; OAuth as fallback.
// Returns the auth handle ready to pass into google.sheets({ auth }) etc.
export function getSheetsAuth(): GoogleAuth | OAuth2Client {
  const sa = getServiceAccountAuth();
  if (sa) return sa;
  return getOAuthClientWithRefreshToken();
}

// Gmail must use OAuth (service accounts can't send Gmail without GWS DWD).
export function getGmailAuth(): OAuth2Client {
  return getOAuthClientWithRefreshToken();
}

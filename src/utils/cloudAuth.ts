// PKCE & OAuth utilities for Google Drive and OneDrive
const base64url = (str: ArrayBuffer) => {
  const bytes = new Uint8Array(str);
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const generateCodeVerifier = (length = 64) => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
};

export const generateCodeChallenge = async (verifier: string) => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(digest);
};

export async function exchangeGoogleCodeForToken({code, codeVerifier, redirectUri, clientId}: {
  code: string; codeVerifier: string; redirectUri: string; clientId: string;
}) {
  const body = new URLSearchParams();
  body.set('code', code);
  body.set('client_id', clientId);
  body.set('code_verifier', codeVerifier);
  body.set('redirect_uri', redirectUri);
  body.set('grant_type', 'authorization_code');

  const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  if (!resp.ok) throw new Error('Failed to exchange token');
  return await resp.json();
}

export async function refreshGoogleAccessToken({ refreshToken, clientId }: { refreshToken: string; clientId: string; }) {
  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('refresh_token', refreshToken);
  body.set('grant_type', 'refresh_token');

  const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  if (!resp.ok) throw new Error('Failed to refresh Google token');
  return await resp.json();
}

export async function exchangeMicrosoftCodeForToken({code, codeVerifier, redirectUri, clientId}: {
  code: string; codeVerifier: string; redirectUri: string; clientId: string;
}) {
  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('code', code);
  body.set('code_verifier', codeVerifier);
  body.set('redirect_uri', redirectUri);
  body.set('grant_type', 'authorization_code');
  body.set('scope', 'offline_access Files.Read Files.Read.All');
  const resp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', { method: 'POST', body });
  if (!resp.ok) throw new Error('Failed to exchange token');
  return await resp.json();
}

export async function refreshMicrosoftAccessToken({ refreshToken, clientId }: { refreshToken: string; clientId: string; }) {
  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('refresh_token', refreshToken);
  body.set('grant_type', 'refresh_token');
  body.set('scope', 'offline_access Files.Read Files.Read.All');
  const resp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', { method: 'POST', body });
  if (!resp.ok) throw new Error('Failed to refresh Microsoft token');
  return await resp.json();
}

export const buildGoogleAuthUrl = async ({clientId, redirectUri, codeChallenge}: {clientId:string, redirectUri:string, codeChallenge:string}) => {
  const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.readonly');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256&access_type=offline&prompt=consent&state=google`;
  return url;
};

export const buildMicrosoftAuthUrl = async ({clientId, redirectUri, codeChallenge}:{clientId:string, redirectUri:string, codeChallenge:string}) => {
  const scope = encodeURIComponent('offline_access Files.Read Files.Read.All openid profile');
  const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scope}&code_challenge=${codeChallenge}&code_challenge_method=S256&prompt=select_account&state=onedrive`;
  return url;
};

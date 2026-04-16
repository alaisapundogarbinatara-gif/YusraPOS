/**
 * WebAuthn helper functions for biometric authentication
 */

// Helper to convert ArrayBuffer to Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// Helper to convert Base64 to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function registerBiometrics(userName: string): Promise<{ id: string; publicKey: string }> {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userID = new Uint8Array(16);
  window.crypto.getRandomValues(userID);

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: "Yusra POS",
      id: window.location.hostname,
    },
    user: {
      id: userID,
      name: userName,
      displayName: userName,
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" }, // ES256
      { alg: -257, type: "public-key" }, // RS256
    ],
    authenticatorSelection: {
      userVerification: "preferred",
    },
    timeout: 60000,
    attestation: "none",
  };

  const credential = (await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions,
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error('Failed to create credential');
  }

  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    id: credential.id,
    publicKey: bufferToBase64(response.getPublicKey()),
  };
}

export async function authenticateBiometrics(allowedCredentialIds: string[]): Promise<string> {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials: allowedCredentialIds.map(id => ({
      id: base64ToBuffer(id),
      type: 'public-key',
    })),
    userVerification: "preferred",
    timeout: 60000,
  };

  const assertion = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential;

  if (!assertion) {
    throw new Error('Authentication failed');
  }

  return assertion.id;
}

export async function isWebAuthnSupported(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

import { Amplify } from 'aws-amplify';

let configured = false;

export const configureAmplify = () => {
  if (configured) return;

  const region = process.env.NEXT_PUBLIC_AWS_REGION;
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  // Prefer WEB client id var; fallback to the existing APP client id
  const userPoolClientId =
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_WEB_CLIENT_ID ||
    process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID;
    const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN; // e.g. mypool.auth.ap-southeast-1.amazoncognito.com

  if (!region || !userPoolId || !userPoolClientId) {
    console.warn('Amplify config is incomplete. Check Cognito environment variables.');
    return;
  }

  const authConfig = {
    userPoolId,
    userPoolClientId,
    region,
  };

  // Configure OAuth if a domain is provided
  if (domain) {
    authConfig.loginWith = {
      oauth: {
        domain,
        scopes: ['openid', 'email', 'profile'],
        redirectSignIn: [
          'http://localhost:5001/',
          'https://main.d6rx46ylcmood.amplifyapp.com/',
        ],
        redirectSignOut: [
          'http://localhost:5001/',
          'https://main.d6rx46ylcmood.amplifyapp.com/',
        ],
        responseType: 'code',
      },
    };
  }

  Amplify.configure({
    Auth: {
      Cognito: authConfig,
    },
    ssr: true,
  });

  configured = true;
};

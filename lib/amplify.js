import { Amplify } from 'aws-amplify';

let configured = false;

export const configureAmplify = () => {
  if (configured) return;

  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID;
  const region = process.env.NEXT_PUBLIC_AWS_REGION;

  if (!userPoolId || !userPoolClientId || !region) {
    console.warn('Amplify config is incomplete. Check Cognito environment variables.');
    return;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        region
      }
    }
  });

  configured = true;
};

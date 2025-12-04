'use client';

import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import Chatbot from '@/components/Chatbot';
import { configureAmplify } from '@/lib/amplify';

configureAmplify();

export default function HomePage() {
  return (
    <Authenticator>
      {({ signOut }) => (
        <div className="h-dvh max-h-dvh w-full bg-[var(--canvas)]">
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={signOut}
              className="group flex items-center justify-center p-2 bg-[var(--ink-purple)] hover:bg-[var(--deep-blue)] text-[var(--limoncello)] rounded-full shadow-lg transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--signature-lilac)] focus:ring-offset-2 focus:ring-offset-[var(--pure-white)]"
              title="Sign Out"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
              </svg>
              <span className="ml-2 hidden group-hover:inline text-sm font-bold pr-2">
                Sign Out
              </span>
            </button>
          </div>
          <Chatbot />
        </div>
      )}
    </Authenticator>
  );
}

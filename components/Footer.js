'use client';

// src/components/Footer.js
import React from 'react';
import PlureeLogo from './icons/PlureeLogo';

const Footer = () => (
  <footer className="flex min-h-10 w-full max-w-full shrink-0 items-center justify-center gap-2 overflow-hidden px-4 py-2 text-[var(--off-white)] bg-[var(--dark-ruby-two)] text-xs">
    <p className="flex items-center justify-center shrink-0 font-medium">
      <PlureeLogo />
      <a target="_blank" rel="noopener noreferrer" className="ml-1 hover:text-gray-300 transition-colors" href="https://pluree.ai">
        Powered by pluree.ai
      </a>
    </p>
  </footer>
);

export default Footer;

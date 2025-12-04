'use client';

// src/components/Message.js
import React from 'react';
import ReactMarkdown from 'react-markdown'; // Import the library

const Message = ({ sender, text, isLoading = false }) => {
  const isUser = sender === 'user';
  const userStyles = 'bg-[var(--limoncello)] text-[var(--ink-purple)] self-end rounded-xl rounded-br-none shadow-sm';
  const botStyles = 'bg-[var(--pure-white)] text-[var(--text-primary)] border border-[var(--border-soft)] self-start rounded-xl rounded-bl-none prose'; 

  const loadingDots = (
    <div className="flex space-x-1">
      <span className="w-2 h-2 bg-[var(--signature-lilac)] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
      <span className="w-2 h-2 bg-[var(--signature-lilac)] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
      <span className="w-2 h-2 bg-[var(--signature-lilac)] rounded-full animate-bounce"></span>
    </div>
  );

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 shadow-sm font-regular leading-relaxed ${isUser ? userStyles : botStyles}`}>
        {isLoading ? loadingDots : <ReactMarkdown>{text}</ReactMarkdown>}
      </div>
    </div>
  );
};

export default Message;

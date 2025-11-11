'use client';

// src/components/MessageList.js
import React, { useRef, useEffect } from 'react';
import Message from './Message';

const MessageList = ({ messages, isLoading }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div ref={scrollRef} className="flex w-full flex-1 flex-col space-y-4 overflow-y-auto px-5 pt-5 sm:overscroll-contain">
      <div className="flex-1 space-y-5">
        {messages.map((msg) => (
          <Message key={msg.id} sender={msg.sender} text={msg.text} />
        ))}
        {isLoading && <Message sender="bot" text="..." isLoading={true} />}
      </div>
      <div className="h-px w-full shrink-0 bg-transparent"></div>
    </div>
  );
};

export default MessageList;

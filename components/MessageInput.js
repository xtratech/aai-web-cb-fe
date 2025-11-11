'use client';

// src/components/MessageInput.js
import React, { useState, useEffect } from 'react';
import SendIcon from './icons/SendIcon';

const MessageInput = ({ onSendMessage, disabled, inputRef, userMessages }) => {
  const [text, setText] = useState('');

  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (text !== '' && userMessages[userMessages.length - 1 - historyIndex] !== text) {
      setHistoryIndex(-1);
    }
  }, [text, historyIndex, userMessages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled || !text.trim()) return;
    onSendMessage(text);
    setText('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
      return;
    }

    if (userMessages.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = Math.min(historyIndex + 1, userMessages.length - 1);
        setHistoryIndex(newIndex);
        setText(userMessages[userMessages.length - 1 - newIndex]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = Math.max(historyIndex - 1, -1);
        setHistoryIndex(newIndex);
        if (newIndex === -1) {
          setText('');
        } else {
          setText(userMessages[userMessages.length - 1 - newIndex]);
        }
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-16 items-end border-t border-gray-300/50 bg-[var(--off-white)]">
      <textarea
        ref={inputRef}
        className="field-sizing-content flex w-full border-input bg-transparent text-base transition-colors disabled:cursor-not-allowed my-auto max-h-40 min-h-8 resize-none rounded-none border-0 placeholder-zinc-500 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 p-3 shadow-none flex-1 font-medium"
        placeholder="Message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows="1"
        disabled={disabled}
        maxLength="8000"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 mr-3 mb-2 size-9 bg-transparent hover:bg-gray-200/50 disabled:opacity-50 disabled:hover:bg-transparent"
      >
        <SendIcon enabled={!disabled && text.trim()} />
      </button>
    </form>
  );
};

export default MessageInput;

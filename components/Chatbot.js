'use client';

// src/components/Chatbot.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from 'aws-amplify/auth';

import Header from './Header';
import Footer from './Footer';
import MessageList from './MessageList';
import MessageInput from './MessageInput'; // i4wl1xd0c9.execute-api.eu-west-1.amazonaws.com
import ErrorDisplay from './ErrorDisplay'; // b1i6og0401.execute-api.ap-southeast-1.amazonaws.com

// Prefer the Chatbase proxy endpoint directly; fallback to explicit API, then default
const API_ENDPOINT =
  process.env.NEXT_PUBLIC_CHATBASE_PROXY_API_ENDPOINT ||
  process.env.NEXT_PUBLIC_API_ENDPOINT ||
  'https://75qd645wxd.execute-api.ap-southeast-1.amazonaws.com/Prod/chat';

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { id: 'initial', text: 'Hi! How can I help you today?', sender: 'bot' }
  ]);
  const [userId, setUserId] = useState(null);
  const [cogUserId, setCogUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const userMessages = useMemo(() =>
    messages.filter((msg) => msg.sender === 'user').map(msg => msg.text),
    [messages]
  );

  useEffect(() => {
    let currentUserId = localStorage.getItem('pluree_user_id');
    if (!currentUserId) {
      currentUserId = uuidv4();
      localStorage.setItem('pluree_user_id', currentUserId);
    }
    setUserId(currentUserId);
  }, []);

  // Resolve Cognito user id (logged-in user)
  useEffect(() => {
    const resolveUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user?.userId) setCogUserId(user.userId);
      } catch (_) {
        // Not signed in or unable to resolve; leave empty
      }
    };
    resolveUser();
  }, []);

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].sender === 'bot') {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [messages]);

  // Listen for global training start/end events triggered by Header
  useEffect(() => {
    const onStart = () => setIsTraining(true);
    const onEnd = () => setIsTraining(false);
    window.addEventListener('ai-training-start', onStart);
    window.addEventListener('ai-training-end', onEnd);
    return () => {
      window.removeEventListener('ai-training-start', onStart);
      window.removeEventListener('ai-training-end', onEnd);
    };
  }, []);

  // Compute assistant mapping based on Cognito user id
  const getAssistantIdForUser = (sub) => {
    const map = {
      [process.env.NEXT_PUBLIC_COGID_OTAVIO]: process.env.NEXT_PUBLIC_ASSID_OTAVIO,
      [process.env.NEXT_PUBLIC_COGID_MARTINA]: process.env.NEXT_PUBLIC_ASSID_MARTINA,
      [process.env.NEXT_PUBLIC_COGID_CLAUDIA]: process.env.NEXT_PUBLIC_ASSID_CLAUDIA,
    };
    return map[sub];
  };

  const handleSendMessage = async (text) => {
    if (!text.trim()) return;

    const userMessage = { id: uuidv4(), text, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      let assistantId = getAssistantIdForUser(cogUserId);
      let keyVal = cogUserId;
      if (!assistantId || !keyVal) {
        try {
          const user = await getCurrentUser();
          if (user?.userId) {
            setCogUserId(user.userId);
            if (!assistantId) assistantId = getAssistantIdForUser(user.userId);
            if (!keyVal) keyVal = user.userId;
          }
        } catch (_) {
          // ignore, proceed with available identifiers
        }
      }
      const payload = {
        userId: userId,
        message: text,
      };
      if (assistantId) payload.assistant_id = assistantId;
      if (keyVal) payload.key = keyVal;

      const response = await axios.post(API_ENDPOINT, payload);
      const botMessage = { id: uuidv4(), text: response.data.text, sender: 'bot' };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Sorry, an unexpected error occurred.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="group relative flex h-full flex-col bg-[var(--off-white)]">
      <Header />
      <div className="relative flex-1 basis-full overflow-y-hidden scroll-smooth flex flex-col shadow-inner shadow-gray-400/20">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>
      <div className="flex shrink-0 flex-col justify-end">
        {error && <ErrorDisplay message={error} />}
        <MessageInput onSendMessage={handleSendMessage} disabled={isLoading || isTraining} inputRef={inputRef} userMessages={userMessages} />
      </div>
      <Footer />
    </main>
  );
};

export default Chatbot;

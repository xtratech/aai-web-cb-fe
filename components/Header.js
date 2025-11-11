'use client';

// src/components/Header.js
import React, { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { getCurrentUser } from 'aws-amplify/auth';

const Header = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const webhookUrl = useMemo(() => process.env.NEXT_PUBLIC_MAKE_WEBHOOK_URL, []);
  const assistantWebhookUrl = useMemo(
    () => process.env.NEXT_PUBLIC_MAKE_TRAIN_WEBHOOK_URL || process.env.NEXT_PUBLIC_MAKE__TRAIN_WEBHOOK_URL,
    []
  );
  const kbWebhookUrl = useMemo(
    () => process.env.NEXT_PUBLIC_MAKE_TRAIN_KB_WEBHOOK_URL,
    []
  );
  const resetWebhookUrl = useMemo(
    () => process.env.NEXT_PUBLIC_MAKE_RESET_WEBHOOK_URL,
    []
  );
  const statusBaseUrl = useMemo(() => process.env.NEXT_PUBLIC_STATUS_BASE_URL, []);
  const trainingStatusUrl = useMemo(
    () => process.env.NEXT_PUBLIC_TRAINING_STATUS_URL || statusBaseUrl,
    [statusBaseUrl]
  );
  const makeApiKey = useMemo(() => process.env.NEXT_PUBLIC_MAKE_API_KEY, []);
  const airtableBaseId = useMemo(() => process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID, []);
  const airtableTableId = useMemo(() => process.env.NEXT_PUBLIC_AIRTABLE_TABLE_ID, []);
  const cognitoField = useMemo(() => process.env.NEXT_PUBLIC_COGNITO_FIELD || 'CognitoID', []);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleInitiateTraining = useCallback(async () => {
    if (isBusy) return;

    setError('');
    setStatusMessage('');

    if (!videoUrl || !videoUrl.trim()) {
      setError('Video URL is required.');
      return;
    }

    // Resolve Cognito user id for status polling
    let cognitoId = 'xyz';
    try {
      const user = await getCurrentUser();
      if (user?.userId) cognitoId = user.userId;
    } catch (e) {
      // Fallback to default if not available
    }

    try {
      setIsBusy(true);
      try { window.dispatchEvent(new Event('ai-training-start')); } catch (_) {}
      // Build payload once to keep both webhooks in sync
      const payload = {
        videourl: videoUrl.trim(),
        instagram: instagram?.trim?.() || '',
        key: cognitoId
      };
      // First, perform a re-set before starting training (if configured)
      if (resetWebhookUrl) {
        setStatusMessage('Re-set in progress...');
        await axios.post(
          resetWebhookUrl,
          payload,
          { headers: { 'x-make-apikey': makeApiKey } }
        );

        // Poll for status 'New' up to 6 times
        let foundNew = false;
        for (let attempt = 1; attempt <= 6; attempt += 1) {
          try {
            const params = new URLSearchParams({ key: cognitoId });
            if (airtableBaseId) params.set('base', airtableBaseId);
            if (airtableTableId) params.set('table', airtableTableId);
            if (cognitoField) params.set('cognito_field', cognitoField);
            const { data } = await axios.get(`${trainingStatusUrl}?${params.toString()}`);
            const statusRaw = data?.status || '';
            const status = statusRaw.toLowerCase();
            setStatusMessage(`Re-set check ${attempt}/6: ${statusRaw || 'unknown'}`);
            if (status === 'new') {
              foundNew = true;
              break;
            }
          } catch (pollErr) {
            setStatusMessage(`Re-set check ${attempt}/6: error`);
          }
          if (attempt < 6) {
            await sleep(5000);
          }
        }

        if (foundNew) {
          setStatusMessage('Re-set complete. Starting training...');
        } else {
          setStatusMessage('Re-set may still be in progress. Starting training...');
        }
      } else {
        setStatusMessage('Reset webhook URL not configured. Starting training...');
      }
      // Send payload to Make.com webhook
      await axios.post(
        webhookUrl,
        payload,
        {
          headers: {
            'x-make-apikey': makeApiKey
          }
        }
      );

      // Show loader and wait 37 seconds
      setStatusMessage('Starting processing...');
      await sleep(37000);

      // Poll status 6 times, every 5 seconds
      let finalStatus = '';
      let lastStatus = '';
      let assistantTriggered = false;
      let kbTriggered = false;
      for (let attempt = 1; attempt <= 7; attempt += 1) {
        try {
          const params = new URLSearchParams({ key: cognitoId });
          if (airtableBaseId) params.set('base', airtableBaseId);
          if (airtableTableId) params.set('table', airtableTableId);
          if (cognitoField) params.set('cognito_field', cognitoField);
          const { data } = await axios.get(`${trainingStatusUrl}?${params.toString()}`);
          const statusRaw = data?.status || '';
          const status = statusRaw.toLowerCase();
          setStatusMessage(`Status check ${attempt}/6: ${statusRaw || 'unknown'}`);

          // Trigger assistant training when transcript is downloaded (once)
          const isTranscriptDownloaded = status === 'transcriptdownloaded' || status === 'trascriptdownloaded';
          if (isTranscriptDownloaded && assistantWebhookUrl && !assistantTriggered) {
            try {
              setStatusMessage('Transcript downloaded. Triggering assistant training...');
              await axios.post(
                assistantWebhookUrl,
                payload,
                { headers: { 'x-make-apikey': makeApiKey } }
              );
              assistantTriggered = true;
            } catch (whErr) {
              setStatusMessage('Failed to trigger assistant training webhook.');
              finalStatus = 'failed';
              break;
            }
          }

          // When status changes from TranscriptDownloaded -> PersonaUploaded, trigger KB
          const wasTranscript = lastStatus === 'transcriptdownloaded' || lastStatus === 'trascriptdownloaded';
          const isPersonaUploaded = status === 'personauploaded';
          if (wasTranscript && isPersonaUploaded && kbWebhookUrl && !kbTriggered) {
            try {
              setStatusMessage('Persona uploaded. Triggering KB training...');
              await axios.post(
                kbWebhookUrl,
                payload,
                { headers: { 'x-make-apikey': makeApiKey } }
              );
              kbTriggered = true;
            } catch (whErr) {
              setStatusMessage('Failed to trigger KB training webhook.');
              finalStatus = 'failed';
              break;
            }

            // After triggering KB training, poll specifically for 'Completed'
            for (let a2 = 1; a2 <= 7; a2 += 1) {
              try {
                const { data: data2 } = await axios.get(`${trainingStatusUrl}?${params.toString()}`);
                const s2Raw = data2?.status || '';
                const s2 = s2Raw.toLowerCase();
                setStatusMessage(`KB training check ${a2}/6: ${s2Raw || 'unknown'}`);
                if (s2 === 'completed') {
                  finalStatus = 'completed';
                  break;
                }
                if (s2 === 'failed') {
                  finalStatus = 'failed';
                  break;
                }
              } catch (pollErr2) {
                setStatusMessage(`KB training check ${a2}/6: error`);
              }
              if (a2 < 6) {
                await sleep(5000);
              }
            }
            break; // Exit outer loop after KB polling
          }

          if (status === 'completed' || status === 'failed') {
            finalStatus = status;
            break;
          }

          // Update last status for transition detection
          lastStatus = status;
        } catch (pollErr) {
          setStatusMessage(`Status check ${attempt}/6: error`);
        }
        if (attempt < 6) {
          await sleep(5000);
        }
      }

      if (!finalStatus) {
        setStatusMessage('Still processing. Please check again later.');
      } else if (finalStatus === 'completed' || finalStatus === 'complete') {
        setStatusMessage('Training completed successfully.');
      } else if (finalStatus === 'failed') {
        setStatusMessage('Training failed. Please try again.');
      }
    } catch (err) {
      setError('Failed to initiate training. Please try again.');
    } finally {
      setIsBusy(false);
      try { window.dispatchEvent(new Event('ai-training-end')); } catch (_) {}
    }
  }, [airtableBaseId, airtableTableId, cognitoField, instagram, isBusy, makeApiKey, resetWebhookUrl, statusBaseUrl, trainingStatusUrl, videoUrl, webhookUrl]);

  

  return (
    <header className="relative flex flex-col px-5 text-[var(--off-white)] bg-[var(--dark-ruby-two)]">
      <div className="my-4">
        <h1 className="font-bold text-lg tracking-wide">Anim AI - POC 1</h1>
      </div>
      <div className="mb-4 w-full">
        <form className="flex w-full max-w-xl flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-1">
            <label htmlFor="video-url" className="text-sm font-medium">Video Url</label>
            <input
              id="video-url"
              name="video-url"
              type="text"
              placeholder="https://example.com/video"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              disabled={isBusy}
              className="w-full rounded-md border border-transparent bg-white/95 px-3 py-2 text-sm text-[var(--dark-ruby-two)] placeholder-gray-500 shadow-sm focus:border-[var(--rich-burgundy)] focus:outline-none focus:ring-2 focus:ring-[var(--rich-burgundy)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="instagram-handle" className="text-sm font-medium">Instagram Handle</label>
            <input
              id="instagram-handle"
              name="instagram-handle"
              type="text"
              placeholder="@yourhandle"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              disabled={isBusy}
              className="w-full rounded-md border border-transparent bg-white/95 px-3 py-2 text-sm text-[var(--dark-ruby-two)] placeholder-gray-500 shadow-sm focus:border-[var(--rich-burgundy)] focus:outline-none focus:ring-2 focus:ring-[var(--rich-burgundy)]"
            />
          </div>
          {error && (
            <div className="text-sm text-red-200 bg-red-800/60 px-3 py-2 rounded">
              {error}
            </div>
          )}
          {statusMessage && (
            <div className="text-sm text-amber-200 bg-amber-800/60 px-3 py-2 rounded">
              {statusMessage}{isBusy ? ' ...' : ''}
            </div>
          )}
          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={handleInitiateTraining}
              disabled={isBusy}
              className="rounded-md bg-[var(--rich-burgundy)] px-4 py-2 text-sm font-semibold text-[var(--off-white)] shadow hover:bg-[var(--dark-ruby)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--rich-burgundy)] focus:ring-offset-[var(--dark-ruby-two)]"
            >
              Initiate Training
            </button>
          </div>
        </form>
      </div>
    </header>
  );
};

export default Header;

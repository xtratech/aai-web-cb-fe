'use client';

// src/components/Header.js
import React, { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

const Header = () => {
  const [videoUrl, setVideoUrl] = useState('');
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
  const transcriptWebhookUrl = useMemo(
    () => process.env.NEXT_PUBLIC_MAKE_TRAIN_TRANSCRIPT_WEBHOOK_URL,
    []
  );
  const trainGeminiEndpoint = useMemo(
    () => process.env.NEXT_PUBLIC_TRAIN_GEMINI_API_ENDPOINT,
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
  const emitTrainingStatus = (message) => {
    try {
      window.dispatchEvent(new CustomEvent('ai-training-status', { detail: { message } }));
    } catch (_) {}
  };

  const handleInitiateTraining = useCallback(async () => {
    if (isBusy) return;

    setError('');
    setStatusMessage('');

    if (!videoUrl || !videoUrl.trim()) {
      setError('Video URL is required.');
      return;
    }

    // Resolve Cognito user id for status polling (prefer token 'sub')
    let cognitoId = 'xyz';
    try {
      const session = await fetchAuthSession();
      const sub = session?.tokens?.idToken?.payload?.sub;
      if (sub) cognitoId = sub;
    } catch (e) {
      // ignore and fallback
    }
    if (cognitoId === 'xyz') {
      try {
        const user = await getCurrentUser();
        if (user?.userId) cognitoId = user.userId;
      } catch (e) {
        // Fallback to default if not available
      }
    }

    try {
      setIsBusy(true);
      try { window.dispatchEvent(new Event('ai-training-start')); } catch (_) {}
      // Build payload once to keep both webhooks in sync
      const payload = {
        videourl: videoUrl.trim(),
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
      await sleep(33000);

      // Poll status 7 times, every 5 seconds
      let finalStatus = '';
      let lastStatus = '';
      let assistantTriggered = false;
      let geminiTriggered = false;
      let transcriptTriggered = false;
      for (let attempt = 1; attempt <= 7; attempt += 1) {
        try {
          const params = new URLSearchParams({ key: cognitoId });
          if (airtableBaseId) params.set('base', airtableBaseId);
          if (airtableTableId) params.set('table', airtableTableId);
          if (cognitoField) params.set('cognito_field', cognitoField);
          const { data } = await axios.get(`${trainingStatusUrl}?${params.toString()}`);
          const statusRaw = data?.status || '';
          const status = statusRaw.toLowerCase();
          setStatusMessage(`Status check ${attempt}/7: ${statusRaw || 'unknown'}`);

          // When transcript is downloaded, trigger Gemini cache prep and assistant training (once)
          const isTranscriptDownloaded = status === 'transcriptdownloaded' || status === 'trascriptdownloaded';
          if (isTranscriptDownloaded && trainGeminiEndpoint && !geminiTriggered) {
            try {
              setStatusMessage('Priming Gemini cache...');
              await axios.post(
                trainGeminiEndpoint,
                {
                  llm: 'gemini',
                  llm_model: 'gemini-2.5-flash',
                  user_id: cognitoId,
                  system_prompt: '',
                  ttl_minutes: 10080,
                  cache_display_name: 'company_knowledge_v1'
                }
              );
              geminiTriggered = true;
            } catch (gemErr) {
              setStatusMessage('Gemini cache priming failed.');
            }
          }


          /* 

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

          // When status changes from TranscriptDownloaded -> PersonaUploaded, trigger transcript
          const wasTranscript = lastStatus === 'transcriptdownloaded' || lastStatus === 'trascriptdownloaded';
          const isPersonaUploaded = status === 'personauploaded';
          if (wasTranscript && isPersonaUploaded && transcriptWebhookUrl && !transcriptTriggered) {
            try {
              setStatusMessage('Persona uploaded. Triggering KB training...');
              await axios.post(
                transcriptWebhookUrl,
                payload,
                { headers: { 'x-make-apikey': makeApiKey } }
              );
              transcriptTriggered = true;
              // Do 7 quick status re-tries immediately after triggering KB
              if (!finalStatus) {
                for (let r = 1; r <= 7; r += 1) {
                  try {
                    const { data: pre } = await axios.get(`${trainingStatusUrl}?${params.toString()}`);
                    const preRaw = pre?.status || '';
                    const preLower = preRaw.toLowerCase();
                    setStatusMessage(`KB quick check ${r}/7: ${preRaw || 'unknown'}`);
                    if (preLower === 'completed') {
                      finalStatus = 'completed';
                      break;
                    }
                    if (preLower === 'failed') {
                      finalStatus = 'failed';
                      break;
                    }
                  } catch (preErr) {
                    setStatusMessage(`KB quick check ${r}/7: error`);
                  }
                  if (r < 7) {
                    await sleep(6000);
                  }
                }
              }
            } catch (whErr) {
              setStatusMessage('Failed to trigger KB training webhook.');
              finalStatus = 'failed';
              break;
            }

            // After triggering KB training, poll specifically for 'Completed'
            if (!finalStatus) {
              for (let a2 = 1; a2 <= 7; a2 += 1) {
                try {
                  const { data: data2 } = await axios.get(`${trainingStatusUrl}?${params.toString()}`);
                  const s2Raw = data2?.status || '';
                  const s2 = s2Raw.toLowerCase();
                  setStatusMessage(`KB training check ${a2}/7: ${s2Raw || 'unknown'}`);
                  if (s2 === 'completed') {
                    finalStatus = 'completed';
                    break;
                  }
                  if (s2 === 'failed') {
                    finalStatus = 'failed';
                    break;
                  }
                } catch (pollErr2) {
                  setStatusMessage(`KB training check ${a2}/7: error`);
                }
                if (a2 < 7) {
                  await sleep(5000);
                }
              }
            }
            break; // Exit outer loop after KB polling
          }

          if (status === 'completed' || status === 'failed') {
            finalStatus = status;
            break;
          }

          */

          if (status === 'transcriptdownloaded' || status === 'failed') {
            finalStatus = status;
            break;
          }

          // Update last status for transition detection
          lastStatus = status;
        } catch (pollErr) {
          setStatusMessage(`Status check ${attempt}/7: error`);
        }
        if (attempt < 2) {
          await sleep(5000);
        }
      }

      const trainingSucceeded = finalStatus === 'transcriptdownloaded' || finalStatus === 'transcriptdownloaded';
      let geminiPrimeFailed = false;

      if (!finalStatus) {
        const msg = 'Still processing. Please check again later.';
        setStatusMessage(msg);
        emitTrainingStatus(msg);
      } else if (trainingSucceeded) {
        const msg = geminiPrimeFailed ? 'Training completed, but Gemini cache priming failed.' : 'Training completed successfully.';
        setStatusMessage(msg);
        emitTrainingStatus(msg);
      } else if (finalStatus === 'failed') {
        const msg = 'Training failed. Please try again.';
        setStatusMessage(msg);
        emitTrainingStatus(msg);
      }
    } catch (err) {
      setError('Failed to initiate training. Please try again.');
    } finally {
      setIsBusy(false);
      try { window.dispatchEvent(new Event('ai-training-end')); } catch (_) {}
    }
  }, [airtableBaseId, airtableTableId, cognitoField, isBusy, makeApiKey, resetWebhookUrl, statusBaseUrl, trainingStatusUrl, videoUrl, webhookUrl]);

  

  return (
    <header className="relative flex flex-col px-5 text-[var(--pure-white)] bg-[var(--ink-purple)] border-b border-[rgba(240,233,100,0.3)]">
      <div className="my-4">
        <h1 className="font-semibold text-xl leading-tight text-[var(--limoncello)] tracking-tight">Humanello - POC 1</h1>
      </div>
      <div className="mb-4 w-full">
        <form className="flex w-full max-w-xl flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-2">
            <label htmlFor="video-url" className="text-xs font-semibold uppercase tracking-[0.08em] text-white/70">Video Url</label>
            <input
              id="video-url"
              name="video-url"
              type="text"
              placeholder="https://example.com/video"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              disabled={isBusy}
              className="w-full rounded-md border border-[rgba(49,174,196,0.45)] bg-white/10 px-3 py-2 text-sm text-[var(--pure-white)] placeholder-white/70 shadow-sm focus:border-[var(--signature-lilac)] focus:outline-none focus:ring-2 focus:ring-[var(--signature-lilac)] focus:ring-offset-2 focus:ring-offset-[var(--ink-purple)]"
            />
          </div>
          {error && (
            <div className="text-sm text-[var(--ink-purple)] bg-[rgba(240,233,100,0.9)] px-3 py-2 rounded-md shadow-sm border border-[rgba(54,43,109,0.2)]">
              {error}
            </div>
          )}
          {statusMessage && (
            <div className="text-sm text-[var(--pure-white)] bg-[rgba(200,115,244,0.14)] px-3 py-2 rounded-md shadow-sm border border-[rgba(200,115,244,0.35)]">
              {statusMessage}{isBusy ? ' ...' : ''}
            </div>
          )}
          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={handleInitiateTraining}
              disabled={isBusy}
              className="rounded-md bg-[var(--limoncello)] px-4 py-2 text-sm font-semibold text-[var(--ink-purple)] shadow-md hover:bg-[#e6df5c] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--signature-lilac)] focus:ring-offset-[var(--ink-purple)]"
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

// =============================================
//  Claritab – background.js
//  Handles: Auto-save every 5 mins + Device sync
// =============================================

const AUTO_SAVE_NAME = '⚡ Auto-saved Session';
const ALARM_NAME     = 'claritab-autosave';

// =============================================
//  SETUP: Create alarm when extension installs
//  or browser starts
// =============================================
chrome.runtime.onInstalled.addListener(() => {
  setupAlarm();
  migrateToSync();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarm();
});

function setupAlarm() {
  // Clear any old alarm first
  chrome.alarms.clear(ALARM_NAME, () => {
    // Create new alarm — fires every 5 minutes
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 5,
      periodInMinutes: 5
    });
  });
}

// =============================================
//  ALARM FIRES — run auto-save
// =============================================
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    runAutoSave();
  }
});

// =============================================
//  AUTO-SAVE LOGIC
//  Gets all open tabs, silently updates the
//  "Auto-saved Session" entry in storage
// =============================================
async function runAutoSave() {
  try {
    // Get all open tabs
    const tabs = await chrome.tabs.query({});

    // Skip if no tabs
    if (!tabs || tabs.length === 0) return;

    // Build session object
    const autoSession = {
      name: AUTO_SAVE_NAME,
      savedAt: Date.now(),
      autoSaved: true,
      tabs: tabs.map(t => ({
        id: t.id,
        title: t.title || 'Untitled',
        url: t.url || '',
        favIconUrl: t.favIconUrl || ''
      }))
    };

    // Get existing sessions from sync storage
    const result = await getFromStorage('savedSessions');
    let sessions = result.savedSessions || [];

    // Find if auto-save session already exists
    const autoIdx = sessions.findIndex(s => s.autoSaved === true);

    if (autoIdx !== -1) {
      // Check if tabs actually changed since last save
      const lastSave = sessions[autoIdx];
      const lastUrls = lastSave.tabs.map(t => t.url).sort().join(',');
      const currentUrls = autoSession.tabs.map(t => t.url).sort().join(',');

      // Skip save if nothing changed
      if (lastUrls === currentUrls) return;

      // Update existing auto-save
      sessions[autoIdx] = autoSession;
    } else {
      // Add new auto-save at the top
      sessions.unshift(autoSession);
    }

    // Save back to storage
    await setToStorage({ savedSessions: sessions });

  } catch (err) {
    console.error('Claritab auto-save failed:', err);
  }
}

// =============================================
//  SYNC MIGRATION
//  Moves existing local data to sync storage
//  on first install of v3.0
// =============================================
async function migrateToSync() {
  try {
    // Check if already migrated
    const syncCheck = await new Promise(resolve =>
      chrome.storage.sync.get(['migrated'], resolve)
    );
    if (syncCheck.migrated) return;

    // Get existing local data
    const local = await new Promise(resolve =>
      chrome.storage.local.get(['savedSessions', 'savedGroups'], resolve)
    );

    const toSync = {};
    if (local.savedSessions && local.savedSessions.length > 0) {
      toSync.savedSessions = local.savedSessions;
    }
    if (local.savedGroups && local.savedGroups.length > 0) {
      toSync.savedGroups = local.savedGroups;
    }

    if (Object.keys(toSync).length > 0) {
      await new Promise(resolve => chrome.storage.sync.set(toSync, resolve));
    }

    // Mark as migrated
    await new Promise(resolve =>
      chrome.storage.sync.set({ migrated: true }, resolve)
    );

  } catch (err) {
    console.error('Claritab migration failed:', err);
  }
}

// =============================================
//  STORAGE HELPERS
//  Try sync first, fall back to local if full
// =============================================
function getFromStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.sync.get([key], (syncResult) => {
      // Only fall back to local on actual error — not when key simply doesn't exist yet
      if (chrome.runtime.lastError) {
        chrome.storage.local.get([key], (localResult) => {
          resolve(localResult);
        });
      } else if (syncResult[key] !== undefined) {
        resolve(syncResult);
      } else {
        // Key not in sync — check local (could have data from before migration)
        chrome.storage.local.get([key], (localResult) => {
          resolve(localResult);
        });
      }
    });
  });
}

function setToStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        // Sync storage full — fall back to local
        console.warn('Claritab: sync storage full, using local storage');
        chrome.storage.local.set(data, resolve);
      } else {
        // Also update local as backup
        chrome.storage.local.set(data, resolve);
      }
    });
  });
}

// =============================================
//  MESSAGE LISTENER — handle API calls from popup
//  Background has no CORS restrictions
// =============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_CALL') {
    handleAPICall(message.apiKey, message.provider, message.prompt, message.maxTokens)
      .then(result => sendResponse({ success: true, text: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
});

async function handleAPICall(apiKey, provider, prompt, maxTokens) {

  if (provider === 'claude') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      const msg = e?.error?.message || `Claude API error ${response.status}`;
      if (response.status === 401) throw new Error('Claude API key is invalid. Please check your key in Settings.');
      if (response.status === 403) throw new Error('Claude API key does not have access. Please check your key in Settings.');
      if (response.status === 429) throw new Error('Claude rate limit reached. Wait a moment and try again.');
      throw new Error('Claude error: ' + msg);
    }
    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  if (provider === 'gemini') {
    // Model list — try newer models first, fall back to older ones
    // gemini-2.0-flash shuts down June 1 2026, gemini-2.5-flash-lite is the new free model
    const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-flash'];
    let lastError = null;
    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: Math.max(maxTokens, 2000), temperature: 0.7 }
            })
          }
        );
        if (!response.ok) {
          const e = await response.json().catch(() => ({}));
          const msg = e?.error?.message || `Gemini error ${response.status}`;
          // Auth errors — throw immediately, no point trying other models
          if (response.status === 400) {
            throw new Error('Gemini key error. Make sure your key is from aistudio.google.com and Gemini API is enabled in your Google Cloud project.');
          }
          if (response.status === 401 || response.status === 403) {
            throw new Error('Gemini API key is invalid or has no access. Get a free key at aistudio.google.com');
          }
          if (response.status === 429 || msg.toLowerCase().includes('quota')) {
            // Try next model before giving up — each model has its own quota pool
            lastError = new Error('Gemini rate limit reached. Try switching to Groq in Settings — it is also free and has no such limits.');
          } else {
            lastError = new Error('Gemini error: ' + msg);
          }
          continue;
        }
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return text;
      } catch(e) {
        // Re-throw immediately for auth errors — no point trying other models
        if (e.message && (e.message.includes('invalid') || e.message.includes('no access') || e.message.includes('aistudio'))) throw e;
        lastError = e;
        continue;
      }
    }
    throw lastError || new Error('Gemini: all models failed. Switch to Groq in Settings — it is free and works without these limits.');
  }

  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      const msg = e?.error?.message || `OpenAI error ${response.status}`;
      if (response.status === 401) throw new Error('OpenAI API key is invalid. Please check your key in Settings.');
      if (response.status === 403) throw new Error('OpenAI API key does not have access. Check your plan at platform.openai.com.');
      if (response.status === 429) throw new Error('OpenAI rate limit or quota exceeded. Check your billing at platform.openai.com.');
      throw new Error('OpenAI error: ' + msg);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'groq') {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const e = await response.json().catch(() => ({}));
      const msg = e?.error?.message || `Groq error ${response.status}`;
      if (response.status === 401) throw new Error('Groq API key is invalid. Please check your key in Settings.');
      if (response.status === 403) throw new Error('Groq API key does not have access. Please check your key in Settings.');
      if (response.status === 429) throw new Error('Groq rate limit reached. Wait a moment and try again.');
      throw new Error('Groq error: ' + msg);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error('Unknown provider: ' + provider);
}

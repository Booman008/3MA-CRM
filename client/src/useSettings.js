// Lightweight settings hook with module-level cache so a single fetch
// per page-load covers every consumer (Members, Leads, Settings page).
// Components can call `useSettings()` and treat the returned object as
// the source of truth for things like the custom license-type list.

import { useEffect, useState } from 'react';
import { api } from './api.js';

let cachedSettings = null;
let inflight = null;
const listeners = new Set();

function notify(next) {
  cachedSettings = next;
  for (const l of listeners) l(next);
}

export async function refreshSettings() {
  inflight = api('/settings').then((s) => {
    notify(s);
    inflight = null;
    return s;
  }).catch((err) => {
    inflight = null;
    throw err;
  });
  return inflight;
}

// Components that just need to read settings.
export function useSettings() {
  const [settings, setSettings] = useState(cachedSettings);

  useEffect(() => {
    listeners.add(setSettings);
    if (cachedSettings == null && !inflight) {
      refreshSettings().catch(() => {});
    } else if (inflight) {
      inflight.then((s) => setSettings(s)).catch(() => {});
    }
    return () => { listeners.delete(setSettings); };
  }, []);

  return settings;
}

// Settings page calls this after PUT /settings so other pages see the
// new custom license-type list without a full reload.
export function setCachedSettings(next) {
  notify(next);
}

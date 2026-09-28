/**
 * storage.js - Studee Data Storage Layer
 * Handles all read/write operations for sessions and settings.
 * Designed to be easily swapped with a remote database backend later.
 */

const STORAGE_KEYS = {
  SESSIONS: 'studee:sessions',
  SETTINGS: 'studee:settings',
  LEGACY_SESSIONS: 'studee_sessions',
  LEGACY_DURATION: 'studee_duration',
};

const DEFAULT_SETTINGS = {
  mode: 'focus', // 'focus' | 'pomodoro' | 'stopwatch'
  focusDuration: 25, // minutes (1–180)
  breakDuration: 5, // minutes (1–30)
  longBreakInterval: 4, // cycles
  sound: true,
  theme: 'dark', // 'dark' | 'light'
  heatmapTheme: 'monochrome', // monochrome starry palette
  batVisible: true, // Animated bat companion on timer page
};

/**
 * Generate a unique session ID based on base36 timestamp + random salt
 */
export function generateSessionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `sess_${ts}${rand}`;
}

/**
 * Migrate legacy data from Studee MVP v1 if present
 */
function migrateLegacyData() {
  try {
    const hasNewSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!hasNewSessions) {
      const legacySessions = localStorage.getItem(STORAGE_KEYS.LEGACY_SESSIONS);
      if (legacySessions) {
        const parsed = JSON.parse(legacySessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = parsed.map((item) => {
            const timestamp = item.timestamp || Date.now();
            const dateStr = item.date || new Date(timestamp).toISOString().split('T')[0];
            const durationSec = Math.round((Number(item.minutes) || 25) * 60);
            return {
              id: item.id && item.id.startsWith('sess_') ? item.id : `sess_${item.id || Date.now().toString(36)}`,
              startedAt: new Date(timestamp - durationSec * 1000).toISOString(),
              endedAt: new Date(timestamp).toISOString(),
              duration: durationSec,
              mode: 'focus',
              subject: '',
              notes: '',
              interrupted: false,
            };
          });
          localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(migrated));
        }
      }
    }

    const hasNewSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!hasNewSettings) {
      const legacyDuration = localStorage.getItem(STORAGE_KEYS.LEGACY_DURATION);
      const focusMins = legacyDuration ? Math.round(parseInt(legacyDuration, 10) / 60) : 25;
      saveSettings({
        ...DEFAULT_SETTINGS,
        focusDuration: focusMins > 0 ? focusMins : 25,
      });
    }
  } catch (err) {
    console.warn('Migration note:', err);
  }
}

// Perform migration check immediately on module load
migrateLegacyData();

/**
 * Get all recorded sessions
 * @returns {Array} List of session objects sorted newest first
 */
export function getSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // Always sort descending by endedAt / startedAt
    return list.sort((a, b) => new Date(b.endedAt || b.startedAt) - new Date(a.endedAt || a.startedAt));
  } catch (err) {
    console.error('Failed to get sessions from storage:', err);
    return [];
  }
}

/**
 * Save array of sessions to storage
 * @param {Array} sessions
 */
export function saveSessions(sessions) {
  try {
    if (!Array.isArray(sessions)) throw new Error('Sessions must be an array');
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to save sessions to storage:', err);
  }
}

/**
 * Add a single new session
 * @param {Object} session
 * @returns {Object} the recorded session
 */
export function recordSession(session) {
  const current = getSessions();
  const newSession = {
    id: session.id || generateSessionId(),
    startedAt: session.startedAt || new Date().toISOString(),
    endedAt: session.endedAt || new Date().toISOString(),
    duration: typeof session.duration === 'number' ? session.duration : 0,
    mode: session.mode || 'focus',
    subject: session.subject ? String(session.subject).trim() : '',
    notes: session.notes ? String(session.notes).trim() : '',
    interrupted: Boolean(session.interrupted),
  };
  current.unshift(newSession);
  saveSessions(current);
  return newSession;
}

/**
 * Delete a session by ID
 * @param {string} id
 */
export function deleteSession(id) {
  const current = getSessions();
  const filtered = current.filter((s) => s.id !== id);
  saveSessions(filtered);
}

/**
 * Update an existing session's subject or notes
 * @param {string} id
 * @param {Object} updates
 */
export function updateSession(id, updates) {
  const current = getSessions();
  const index = current.findIndex((s) => s.id === id);
  if (index !== -1) {
    current[index] = { ...current[index], ...updates };
    saveSessions(current);
  }
}

/**
 * Get user settings
 * @returns {Object} Settings object merged with defaults
 */
export function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.error('Failed to get settings from storage:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save user settings
 * @param {Object} settings
 */
export function saveSettings(settings) {
  try {
    const current = getSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.error('Failed to save settings to storage:', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Reset all user data (sessions & settings)
 */
export function clearAllData() {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_DURATION);
  } catch (err) {
    console.error('Failed to clear data:', err);
  }
}

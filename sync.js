/**
 * BOCCA BIONICA / ORAR - MODUL SINCRONIZARE CLOUD (MANUALĂ & LOCAL-FIRST)
 * Sincronizarea este MANUALĂ:
 * 1. Buton verde Upload și buton roșu Download pentru fiecare zi în raport.
 * 2. Buton verde Upload și buton roșu Download în rândul cu categoriile pentru toate datele introduse.
 * 3. Nicio suprascriere automată: modificările și ștergerile locale nu mai sunt suprascrise de cloud.
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    SYNC_CODE: 'bocca_bionica_sync_code',
    FIREBASE_CONFIG: 'bocca_bionica_firebase_config'
  };

  const CLIENT_ID = 'cli_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  let db = null;
  let activeSyncCode = '';

  const el = {
    syncDot: null,
    syncStatusText: null,
    syncCodeInput: null,
    btnToggleSync: null,
    btnSyncText: null,
    configPanel: null,
    configTextarea: null,
    btnSaveConfig: null,
    btnToggleConfigView: null
  };

  function getStoredFirebaseConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.apiKey) return parsed;
      }
    } catch (e) {}

    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) {
      return window.FIREBASE_CONFIG;
    }
    return null;
  }

  function setStatus(status, title) {
    if (el.syncDot) {
      el.syncDot.className = 'sync-status-dot';
      if (status === 'online') {
        el.syncDot.classList.add('online');
      } else if (status === 'syncing') {
        el.syncDot.classList.add('syncing');
      } else if (status === 'error') {
        el.syncDot.classList.add('error');
      }
      el.syncDot.title = title || '';
    }
    if (el.syncStatusText) {
      if (status === 'online') {
        el.syncStatusText.textContent = 'Conectat';
        el.syncStatusText.className = 'sync-status-label online';
      } else if (status === 'syncing') {
        el.syncStatusText.textContent = 'Sincronizează...';
        el.syncStatusText.className = 'sync-status-label syncing';
      } else if (status === 'error') {
        el.syncStatusText.textContent = 'Eroare';
        el.syncStatusText.className = 'sync-status-label error';
      } else {
        el.syncStatusText.textContent = 'Inactiv';
        el.syncStatusText.className = 'sync-status-label';
      }
    }
  }

  function initFirebase(showErrorOnMissing = false) {
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK nu este încărcat.');
      if (showErrorOnMissing) setStatus('error', 'Firebase SDK indisponibil');
      return false;
    }

    const config = getStoredFirebaseConfig();
    if (!config || !config.apiKey || !config.projectId) {
      if (showErrorOnMissing) {
        setStatus('error', 'Configurație Firebase lipsă');
      } else {
        setStatus('offline', 'Sincronizare oprită (local)');
      }
      return false;
    }

    try {
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(config);
      }
      db = firebase.firestore();
      return true;
    } catch (err) {
      console.error('Eroare inițializare Firebase:', err);
      setStatus('error', 'Eroare inițializare Firebase');
      return false;
    }
  }

  function sanitizeSyncCode(code) {
    if (!code) return '';
    return code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  }

  function connectSync(code) {
    const cleanCode = sanitizeSyncCode(code);
    if (!cleanCode) return false;

    if (!db) {
      const ready = initFirebase(true);
      if (!ready) return false;
    }

    activeSyncCode = cleanCode;
    localStorage.setItem(STORAGE_KEYS.SYNC_CODE, cleanCode);
    setStatus('online', 'Conectat la profilul ' + cleanCode);
    updateButtonUI(true);
    return true;
  }

  function disconnectSync() {
    activeSyncCode = '';
    localStorage.removeItem(STORAGE_KEYS.SYNC_CODE);
    if (el.syncCodeInput) el.syncCodeInput.value = '';
    setStatus('offline', 'Sincronizare deconectată');
    updateButtonUI(false);
  }

  // --- OPERAȚIUNI SINCRONIZARE MANUALĂ ---

  async function uploadDay(dateKey, shiftData) {
    if (!activeSyncCode) {
      throw new Error('Sincronizarea este neconectată. Introdu Codul Unic în meniu.');
    }
    if (!db) {
      initFirebase(true);
      if (!db) throw new Error('Firebase nu a putut fi inițializat.');
    }

    setStatus('syncing', 'Se încarcă ziua...');
    try {
      const docRef = db.collection('sync_profiles').doc(activeSyncCode);
      await docRef.set({
        shifts: {
          [dateKey]: shiftData
        },
        lastWriterId: CLIENT_ID,
        clientTimestamp: Date.now(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      setStatus('online');
      return true;
    } catch (err) {
      setStatus('online');
      throw err;
    }
  }

  async function downloadDay(dateKey) {
    if (!activeSyncCode) {
      throw new Error('Sincronizarea este neconectată. Introdu Codul Unic în meniu.');
    }
    if (!db) {
      initFirebase(true);
      if (!db) throw new Error('Firebase nu a putut fi inițializat.');
    }

    setStatus('syncing', 'Se descarcă ziua...');
    try {
      const docRef = db.collection('sync_profiles').doc(activeSyncCode);
      let doc;
      try {
        doc = await docRef.get({ source: 'server' });
      } catch (e) {
        doc = await docRef.get();
      }

      setStatus('online');
      if (!doc || !doc.exists) return null;

      const data = doc.data();
      if (data && data.shifts && data.shifts[dateKey]) {
        return data.shifts[dateKey];
      }
      return null;
    } catch (err) {
      setStatus('online');
      throw err;
    }
  }

  async function uploadAll(payload) {
    if (!activeSyncCode) {
      throw new Error('Sincronizarea este neconectată. Introdu Codul Unic în meniu.');
    }
    if (!db) {
      initFirebase(true);
      if (!db) throw new Error('Firebase nu a putut fi inițializat.');
    }

    setStatus('syncing', 'Se încarcă toate datele...');
    try {
      const docRef = db.collection('sync_profiles').doc(activeSyncCode);
      // Fara merge global pe shifts pentru ca turele sterse local sa se stearga si din cloud
      await docRef.set({
        shifts: payload.shifts || {},
        doctors: payload.doctors || [],
        cabinets: payload.cabinets || [],
        assistantName: payload.assistantName || '',
        kpis: payload.kpis || [],
        lastWriterId: CLIENT_ID,
        clientTimestamp: Date.now(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      setStatus('online');
      return true;
    } catch (err) {
      setStatus('online');
      throw err;
    }
  }

  async function downloadAll() {
    if (!activeSyncCode) {
      throw new Error('Sincronizarea este neconectată. Introdu Codul Unic în meniu.');
    }
    if (!db) {
      initFirebase(true);
      if (!db) throw new Error('Firebase nu a putut fi inițializat.');
    }

    setStatus('syncing', 'Se descarcă toate datele...');
    try {
      const docRef = db.collection('sync_profiles').doc(activeSyncCode);
      let doc;
      try {
        doc = await docRef.get({ source: 'server' });
      } catch (e) {
        doc = await docRef.get();
      }

      setStatus('online');
      if (!doc || !doc.exists) return null;

      return doc.data();
    } catch (err) {
      setStatus('online');
      throw err;
    }
  }

  function bindUI() {
    el.syncDot = document.getElementById('sync-status-dot');
    el.syncStatusText = document.getElementById('sync-status-text');
    el.syncCodeInput = document.getElementById('sync-code-input');
    el.btnToggleSync = document.getElementById('btn-toggle-sync');
    el.btnSyncText = document.getElementById('btn-sync-text');
    el.configPanel = document.getElementById('sync-config-panel');
    el.configTextarea = document.getElementById('sync-config-textarea');
    el.btnSaveConfig = document.getElementById('btn-save-sync-config');
    el.btnToggleConfigView = document.getElementById('btn-toggle-config-view');

    const savedCode = localStorage.getItem(STORAGE_KEYS.SYNC_CODE) || '';
    if (el.syncCodeInput) el.syncCodeInput.value = savedCode;

    const savedConfig = getStoredFirebaseConfig();
    if (savedConfig && el.configTextarea) {
      el.configTextarea.value = JSON.stringify(savedConfig, null, 2);
    }

    if (savedCode) {
      connectSync(savedCode);
    } else {
      updateButtonUI(false);
      setStatus('offline');
    }

    if (el.btnToggleSync) {
      el.btnToggleSync.addEventListener('click', () => {
        if (activeSyncCode) {
          disconnectSync();
        } else {
          const inputCode = sanitizeSyncCode(el.syncCodeInput ? el.syncCodeInput.value : '');
          if (!inputCode) {
            if (el.syncCodeInput) el.syncCodeInput.focus();
            return;
          }

          if (!db) {
            const ready = initFirebase(true);
            if (!ready) {
              if (el.configPanel) el.configPanel.style.display = 'flex';
              return;
            }
          }

          connectSync(inputCode);
        }
      });
    }

    if (el.btnToggleConfigView) {
      el.btnToggleConfigView.addEventListener('click', () => {
        if (!el.configPanel) return;
        const isHidden = el.configPanel.style.display === 'none' || !el.configPanel.style.display;
        el.configPanel.style.display = isHidden ? 'flex' : 'none';
      });
    }

    if (el.btnSaveConfig) {
      el.btnSaveConfig.addEventListener('click', () => {
        const raw = el.configTextarea ? el.configTextarea.value.trim() : '';
        if (!raw) return;

        try {
          let parsed = null;
          if (raw.startsWith('{')) {
            parsed = JSON.parse(raw);
          } else {
            const apiKeyMatch = raw.match(/apiKey:\s*["']([^"']+)["']/);
            const projMatch = raw.match(/projectId:\s*["']([^"']+)["']/);
            const authMatch = raw.match(/authDomain:\s*["']([^"']+)["']/);
            const appIdMatch = raw.match(/appId:\s*["']([^"']+)["']/);
            if (apiKeyMatch && projMatch) {
              parsed = {
                apiKey: apiKeyMatch[1],
                projectId: projMatch[1],
                authDomain: authMatch ? authMatch[1] : undefined,
                appId: appIdMatch ? appIdMatch[1] : undefined
              };
            }
          }

          if (parsed && parsed.apiKey && parsed.projectId) {
            localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(parsed));
            if (el.configPanel) el.configPanel.style.display = 'none';
            initFirebase();
            const currentCode = sanitizeSyncCode(el.syncCodeInput ? el.syncCodeInput.value : '');
            if (currentCode) {
              connectSync(currentCode);
            } else {
              setStatus('offline', 'Firebase configurat. Introdu codul.');
            }
          } else {
            alert('Format configurare invalid. Asigură-te că include apiKey și projectId.');
          }
        } catch (e) {
          alert('Format JSON invalid.');
        }
      });
    }
  }

  function updateButtonUI(isConnected) {
    if (!el.btnSyncText) return;
    el.btnSyncText.textContent = isConnected ? 'Deconectează' : 'Conectează';
    if (el.btnToggleSync) {
      if (isConnected) {
        el.btnToggleSync.classList.add('connected');
      } else {
        el.btnToggleSync.classList.remove('connected');
      }
    }
  }

  window.DentalSync = {
    init: function () {
      bindUI();
      initFirebase();
      const savedCode = sanitizeSyncCode(localStorage.getItem(STORAGE_KEYS.SYNC_CODE));
      if (savedCode) {
        connectSync(savedCode);
      }
    },
    isConnected: function () {
      return Boolean(activeSyncCode && db);
    },
    getActiveCode: function () {
      return activeSyncCode;
    },
    uploadDay,
    downloadDay,
    uploadAll,
    downloadAll,
    connectSync,
    disconnectSync,
    setStatus
  };
})();

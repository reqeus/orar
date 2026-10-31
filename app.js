/**
 * BOCCA BIONICA - SISTEM PONTAJ & RAPORTARE (AMOLED MINIMALIST)
 * 1. Zilele de duminica nu sunt editabile (zi libera).
 * 2. KPI: Sedari cu durata in ore (ex: Sedare (2h)).
 * 3. Redesign raport curat, fara chenare imbricate.
 * 4. Copiere tabel direct pentru Microsoft Teams (rich-text HTML table).
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    SHIFTS: 'bocca_bionica_shifts_v4',
    DOCTORS: 'bocca_bionica_doctors_v4',
    CABINETS: 'bocca_bionica_cabinets_v4',
    ASSISTANT: 'bocca_bionica_assistant_v4',
    KPIS: 'bocca_bionica_kpis_v1'
  };

  const MONTHS_SHORT_RO = [
    'IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN',
    'IUL', 'AUG', 'SEP', 'OCT', 'NOI', 'DEC'
  ];

  const MONTHS_FULL_RO = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
  ];

  const DAYS_RO = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];

  const DEFAULT_DOCTORS = ['Dr. Moga', 'Dr. Popozoglo', 'Dr. Ciobanu', 'Dr. Rotaru', 'Dr. Ceban'];
  const DEFAULT_CABINETS = ['Cabinetul 3', 'Cabinetul 5', 'Cabinetul 1', 'Cabinetul 2', 'Cabinetul 4'];
  const DEFAULT_KPIS = [
    { id: 'opg', name: 'OPG', type: 'volume' },
    { id: 'ct', name: 'CT', type: 'volume' },
    { id: 'rx', name: 'RX', type: 'volume' },
    { id: 'sedare', name: 'Sedare', type: 'duration' },
    { id: 'postop', name: 'Post-operator', type: 'duration' }
  ];

  // Stare aplicatie (se preselecteaza automat data curenta)
  const initialNow = new Date();
  let currentYear = initialNow.getFullYear();
  let currentMonth = initialNow.getMonth();

  // Daca azi e duminica (zi nelucratoare/dezactivata in calendar), preselectam sambata anterioara, altfel ziua curenta
  let initialTargetDate = new Date(initialNow);
  if (initialNow.getDay() === 0) {
    initialTargetDate.setDate(initialNow.getDate() - 1);
  }
  let selectedDateKey = `${initialTargetDate.getFullYear()}-${String(initialTargetDate.getMonth() + 1).padStart(2, '0')}-${String(initialTargetDate.getDate()).padStart(2, '0')}`;
  let activeTimePickingType = 'entry';
  let generatedScreenshotBlob = null;
  let activeDurationKpi = null;
  let newKpiType = 'volume';
  let currentDetailsShiftType = 'full';
  let activeKpiMode = 'interval';

  // Incarcare date
  let doctors = loadStorage(STORAGE_KEYS.DOCTORS, DEFAULT_DOCTORS);
  let cabinets = loadStorage(STORAGE_KEYS.CABINETS, DEFAULT_CABINETS);
  let assistantName = loadStorage(STORAGE_KEYS.ASSISTANT, 'Asistent Medical');
  let kpis = loadStorage(STORAGE_KEYS.KPIS, DEFAULT_KPIS);
  let shifts = loadStorage(STORAGE_KEYS.SHIFTS, null);

  if (!shifts || Object.keys(shifts).length === 0) {
    shifts = getInitialDemoShifts();
    saveStorage(STORAGE_KEYS.SHIFTS, shifts);
  }

  // --- ELEMENTE DOM ---
  const el = {
    // Header
    btnOpenDrawer: document.getElementById('btn-open-drawer'),
    btnMonthPrev: document.getElementById('btn-month-prev'),
    btnMonthNext: document.getElementById('btn-month-next'),
    amoledMonthTitle: document.getElementById('amoled-month-title'),
    amoledYearSub: document.getElementById('amoled-year-sub'),
    btnGoToday: document.getElementById('btn-go-today'),
    todayDayNumber: document.getElementById('today-day-number'),

    // Calendar
    amoledMonthGrid: document.getElementById('amoled-month-grid'),

    // Bottom Bar (2 Butoane Pontaj)
    selectedDateLabel: document.getElementById('selected-date-label'),
    btnEditExistingDetails: document.getElementById('btn-edit-existing-details'),
    btnLogEntry: document.getElementById('btn-log-entry'),
    lblEntryTime: document.getElementById('lbl-entry-time'),
    btnLogExit: document.getElementById('btn-log-exit'),
    lblExitTime: document.getElementById('lbl-exit-time'),

    // Time Picker Modal
    timePickerModal: document.getElementById('time-picker-modal'),
    timePickerTitle: document.getElementById('time-picker-title'),
    btnCloseTimePicker: document.getElementById('btn-close-time-picker'),
    timePresetsContainer: document.getElementById('time-presets-container'),
    manualPickerSection: document.getElementById('manual-picker-section'),
    selectHour24: document.getElementById('select-hour-24'),
    selectMin24: document.getElementById('select-min-24'),
    btnConfirmTime: document.getElementById('btn-confirm-time'),

    // Custom KPI Duration & Interval Modal
    kpiDurationModal: document.getElementById('kpi-duration-modal'),
    kpiDurationTitle: document.getElementById('kpi-duration-title'),
    btnCloseKpiDuration: document.getElementById('btn-close-kpi-duration'),
    kpiModeToggle: document.getElementById('kpi-mode-toggle'),
    btnKpiModeInterval: document.getElementById('btn-kpi-mode-interval'),
    btnKpiModeDuration: document.getElementById('btn-kpi-mode-duration'),
    kpiIntervalSection: document.getElementById('kpi-interval-section'),
    selectKpiStartH: document.getElementById('select-kpi-start-h'),
    selectKpiStartM: document.getElementById('select-kpi-start-m'),
    selectKpiEndH: document.getElementById('select-kpi-end-h'),
    selectKpiEndM: document.getElementById('select-kpi-end-m'),
    kpiIntervalCalcBadge: document.getElementById('kpi-interval-calc-badge'),
    kpiIntervalCalcText: document.getElementById('kpi-interval-calc-text'),
    kpiDurationSection: document.getElementById('kpi-duration-section'),
    selectKpiHours: document.getElementById('select-kpi-hours'),
    selectKpiMinutes: document.getElementById('select-kpi-minutes'),
    btnConfirmKpiDuration: document.getElementById('btn-confirm-kpi-duration'),

    // Details Bottom Sheet
    detailsBackdrop: document.getElementById('details-backdrop'),
    detailsSheet: document.getElementById('details-sheet'),
    btnCloseDetails: document.getElementById('btn-close-details'),
    detailsDateTitle: document.getElementById('details-date-title'),
    detailsSummaryInterval: document.getElementById('details-summary-interval'),
    detailsSummaryDuration: document.getElementById('details-summary-duration'),
    detailsSummaryBonus: document.getElementById('details-summary-bonus'),
    btnShiftTypeFull: document.getElementById('btn-shift-type-full'),
    btnShiftTypePart: document.getElementById('btn-shift-type-part'),
    selectCabinet: document.getElementById('select-cabinet'),
    selectDoctor: document.getElementById('select-doctor'),
    wrapperCabinet: document.getElementById('wrapper-cabinet'),
    btnSelectCabinet: document.getElementById('btn-select-cabinet'),
    valSelectCabinet: document.getElementById('val-select-cabinet'),
    menuSelectCabinet: document.getElementById('menu-select-cabinet'),
    wrapperDoctor: document.getElementById('wrapper-doctor'),
    btnSelectDoctor: document.getElementById('btn-select-doctor'),
    valSelectDoctor: document.getElementById('val-select-doctor'),
    menuSelectDoctor: document.getElementById('menu-select-doctor'),
    detailsKpiStrip: document.getElementById('details-kpi-strip'),
    inputActivities: document.getElementById('input-activities'),
    btnSaveFullShift: document.getElementById('btn-save-full-shift'),
    btnDeleteFullShift: document.getElementById('btn-delete-full-shift'),

    // Report Overlay Clean
    reportViewOverlay: document.getElementById('report-view-overlay'),
    btnCloseReportView: document.getElementById('btn-close-report-view'),
    reportMonthTitleClean: document.getElementById('report-month-title-clean'),
    btnCopyTeams: document.getElementById('btn-copy-teams'),
    btnExportScreenshot: document.getElementById('btn-export-screenshot'),
    btnExportPdf: document.getElementById('btn-export-pdf'),
    reportCaptureArea: document.getElementById('report-capture-area'),
    officialShiftsTable: document.getElementById('official-shifts-table'),
    officialTableBody: document.getElementById('official-table-body'),
    tableTotalsHours: document.getElementById('table-totals-hours'),
    tableTotalsKpi: document.getElementById('table-totals-kpi'),
    btnSyncUploadAll: document.getElementById('btn-sync-upload-all'),
    btnSyncDownloadAll: document.getElementById('btn-sync-download-all'),

    // Drawer
    drawerBackdrop: document.getElementById('drawer-backdrop'),
    drawerMenu: document.getElementById('drawer-menu'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    drawerLinkCalendar: document.getElementById('drawer-link-calendar'),
    drawerLinkReport: document.getElementById('drawer-link-report'),
    drawerAssistantInput: document.getElementById('drawer-assistant-input'),
    drawerDoctorsList: document.getElementById('drawer-doctors-list'),
    drawerNewDoctor: document.getElementById('drawer-new-doctor'),
    drawerBtnAddDoc: document.getElementById('drawer-btn-add-doc'),
    drawerCabinetsList: document.getElementById('drawer-cabinets-list'),
    drawerNewCabinet: document.getElementById('drawer-new-cabinet'),
    drawerBtnAddCab: document.getElementById('drawer-btn-add-cab'),
    drawerKpisList: document.getElementById('drawer-kpis-list'),
    drawerNewKpiName: document.getElementById('drawer-new-kpi-name'),
    drawerKpiTypeToggle: document.getElementById('drawer-kpi-type-toggle'),
    btnKpiTypeVolume: document.getElementById('btn-kpi-type-volume'),
    btnKpiTypeDuration: document.getElementById('btn-kpi-type-duration'),
    drawerBtnAddKpi: document.getElementById('drawer-btn-add-kpi'),
    drawerBtnImportBackup: document.getElementById('drawer-btn-import-backup'),
    drawerFileImport: document.getElementById('drawer-file-import'),
    drawerBtnExportBackup: document.getElementById('drawer-btn-export-backup'),
    drawerBtnClear: document.getElementById('drawer-btn-clear'),

    // Screenshot Modal
    screenshotModal: document.getElementById('screenshot-modal'),
    btnCloseScreenshotModal: document.getElementById('btn-close-screenshot-modal'),
    screenshotPreviewContainer: document.getElementById('screenshot-preview-container'),
    btnShareWhatsapp: document.getElementById('btn-share-whatsapp'),
    btnCopyClipboard: document.getElementById('btn-copy-clipboard'),
    btnDownloadImg: document.getElementById('btn-download-img'),

    // Toast
    toast: document.getElementById('toast')
  };

  // --- INITIALIZARE ---
  function init() {
    updateHeaderDisplay();
    populateSelectsAndLists();
    renderAmoledCalendar();
    updateBottomBarState();
    renderReportTable();
    renderDrawerKpisList();
    renderDetailsKpiStrip();
    bindEventListeners();
    initSync();
  }

  function loadStorage(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error(e);
    }
  }

  function applyRemoteSync(remoteData) {
    if (!remoteData) return;

    if (remoteData.shifts && typeof remoteData.shifts === 'object') {
      shifts = remoteData.shifts;
      saveStorage(STORAGE_KEYS.SHIFTS, shifts);
    }
    if (Array.isArray(remoteData.doctors)) {
      doctors = remoteData.doctors;
      saveStorage(STORAGE_KEYS.DOCTORS, doctors);
    }
    if (Array.isArray(remoteData.cabinets)) {
      cabinets = remoteData.cabinets;
      saveStorage(STORAGE_KEYS.CABINETS, cabinets);
    }
    if (typeof remoteData.assistantName === 'string') {
      assistantName = remoteData.assistantName;
      saveStorage(STORAGE_KEYS.ASSISTANT, assistantName);
      if (el.drawerAssistantInput) el.drawerAssistantInput.value = assistantName;
      if (el.reportAssistantName) el.reportAssistantName.textContent = assistantName;
    }
    if (Array.isArray(remoteData.kpis)) {
      kpis = remoteData.kpis;
      saveStorage(STORAGE_KEYS.KPIS, kpis);
    }

    populateSelectsAndLists();
    renderAmoledCalendar();
    updateBottomBarState();
    renderReportTable();
    renderDrawerKpisList();
    renderDetailsKpiStrip();
  }

  function initSync() {
    if (window.DentalSync && window.DentalSync.init) {
      window.DentalSync.init();
    }
  }

  // Date demo
  function getInitialDemoShifts() {
    return {
      '2026-09-01': {
        date: '2026-09-01', displayDate: '01.09.2026',
        startTime: '08:30', endTime: '16:30',
        cabinet: 'Cabinetul 3', doctor: 'Dr. Moga',
        activities: '2 OPG, 1 CT', hours: 8.0
      },
      '2026-09-03': {
        date: '2026-09-03', displayDate: '03.09.2026',
        startTime: '16:00', endTime: '20:30',
        cabinet: 'Cabinetul 5', doctor: 'Dr. Popozoglo',
        activities: '—', hours: 4.5
      },
      '2026-09-08': {
        date: '2026-09-08', displayDate: '08.09.2026',
        startTime: '08:30', endTime: '16:30',
        cabinet: 'Cabinetul 3', doctor: 'Dr. Moga',
        activities: '1 OPG, Sedare (2h)', hours: 8.0
      },
      '2026-09-11': {
        date: '2026-09-11', displayDate: '11.09.2026',
        startTime: '08:30', endTime: '16:30',
        cabinet: 'Cabinetul 3', doctor: 'Dr. Moga',
        activities: '2 OPG', hours: 8.0
      },
      '2026-09-16': {
        date: '2026-09-16', displayDate: '16.09.2026',
        startTime: '16:00', endTime: '20:30',
        cabinet: 'Cabinetul 5', doctor: 'Dr. Popozoglo',
        activities: '1 CT', hours: 4.5
      },
      '2026-09-18': {
        date: '2026-09-18', displayDate: '18.09.2026',
        startTime: '08:30', endTime: '16:30',
        cabinet: 'Cabinetul 3', doctor: 'Dr. Moga',
        activities: 'Sedare (3h)', hours: 8.0
      }
    };
  }

  // --- ANTET ---
  function updateHeaderDisplay() {
    el.amoledMonthTitle.textContent = MONTHS_FULL_RO[currentMonth];
    el.amoledYearSub.textContent = currentYear;
    el.reportMonthTitleClean.textContent = `${MONTHS_FULL_RO[currentMonth]} ${currentYear}`;
    const now = new Date();
    el.todayDayNumber.textContent = now.getDate();
    const captureSub = document.getElementById('capture-month-sub');
    if (captureSub) {
      captureSub.textContent = `${MONTHS_FULL_RO[currentMonth]} ${currentYear} • ${assistantName}`;
    }
  }

  function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear -= 1;
    } else if (currentMonth > 11) {
      currentMonth = 0;
      currentYear += 1;
    }
    updateHeaderDisplay();
    renderAmoledCalendar();
    updateBottomBarState();
    renderReportTable();
  }

  function goToday() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    
    let target = new Date(now);
    if (now.getDay() === 0) {
      target.setDate(now.getDate() - 1);
    }
    const dayPad = String(target.getDate()).padStart(2, '0');
    const monthPad = String(target.getMonth() + 1).padStart(2, '0');
    selectedDateKey = `${target.getFullYear()}-${monthPad}-${dayPad}`;

    updateHeaderDisplay();
    renderAmoledCalendar();
    updateBottomBarState();
    renderReportTable();
  }

  // --- LISTE MEDICI/CABINETE ---
  function renderCustomCabinetOptions() {
    const currentVal = el.selectCabinet ? el.selectCabinet.value || (cabinets[0] || '') : (cabinets[0] || '');
    if (el.selectCabinet) el.selectCabinet.value = currentVal;
    if (el.valSelectCabinet) el.valSelectCabinet.textContent = currentVal || 'Cabinet';

    if (el.menuSelectCabinet) {
      el.menuSelectCabinet.innerHTML = cabinets.map(cab => `
        <div class="custom-select-item ${cab === currentVal ? 'selected' : ''}" data-value="${escapeHtml(cab)}">
          <span>${escapeHtml(cab)}</span>
          ${cab === currentVal ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
      `).join('');
    }
  }

  function renderCustomDoctorOptions() {
    const currentVal = el.selectDoctor ? el.selectDoctor.value || (doctors[0] || '') : (doctors[0] || '');
    if (el.selectDoctor) el.selectDoctor.value = currentVal;
    if (el.valSelectDoctor) el.valSelectDoctor.textContent = currentVal || 'Medic';

    if (el.menuSelectDoctor) {
      el.menuSelectDoctor.innerHTML = doctors.map(doc => `
        <div class="custom-select-item ${doc === currentVal ? 'selected' : ''}" data-value="${escapeHtml(doc)}">
          <span>${escapeHtml(doc)}</span>
          ${doc === currentVal ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
      `).join('');
    }
  }

  function closeCustomSelects() {
    if (el.wrapperCabinet) {
      el.wrapperCabinet.classList.remove('open');
      if (el.btnSelectCabinet) el.btnSelectCabinet.setAttribute('aria-expanded', 'false');
    }
    if (el.wrapperDoctor) {
      el.wrapperDoctor.classList.remove('open');
      if (el.btnSelectDoctor) el.btnSelectDoctor.setAttribute('aria-expanded', 'false');
    }
  }

  function renderDrawerKpisList() {
    if (!el.drawerKpisList) return;
    el.drawerKpisList.innerHTML = kpis.map((k, i) => `
      <span class="item-chip">
        ${escapeHtml(k.name)} <span class="kpi-tag-badge">(${k.type === 'duration' ? 'Durată' : 'Volum'})</span>
        <button type="button" class="chip-x" data-type="kpi" data-idx="${i}" aria-label="Șterge activitate KPI">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </span>
    `).join('');
  }

  function populateSelectsAndLists() {
    renderCustomCabinetOptions();
    renderCustomDoctorOptions();
    renderDrawerKpisList();

    el.drawerDoctorsList.innerHTML = doctors.map((d, i) => `
      <span class="item-chip">
        ${escapeHtml(d)}
        <button type="button" class="chip-x" data-type="doc" data-idx="${i}" aria-label="Șterge medic">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </span>
    `).join('');

    el.drawerCabinetsList.innerHTML = cabinets.map((c, i) => `
      <span class="item-chip">
        ${escapeHtml(c)}
        <button type="button" class="chip-x" data-type="cab" data-idx="${i}" aria-label="Șterge cabinet">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </span>
    `).join('');

    el.drawerAssistantInput.value = assistantName;
    if (el.reportAssistantName) el.reportAssistantName.textContent = assistantName;
  }

  // --- CALENDAR LUNAR (DUMINICA NE-EDITABILA, FARA TEXT SUB DATA) ---
  function renderAmoledCalendar() {
    el.amoledMonthGrid.innerHTML = '';

    const firstDayOfWeek = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // 0 = Luni, 6 = Duminica
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const totalSlots = Math.ceil((firstDayOfWeek + daysInCurrentMonth) / 7) * 7;
    const totalWeeks = totalSlots / 7;

    let dayCounter = 1;
    let nextMonthDayCounter = 1;

    for (let week = 0; week < totalWeeks; week++) {
      const weekRow = document.createElement('div');
      weekRow.className = 'amoled-week-row';

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const slotIndex = week * 7 + dayOfWeek;
        const isSunday = (dayOfWeek === 6); // Duminica

        const cell = document.createElement('div');
        cell.className = 'amoled-day-cell';
        if (isSunday) {
          cell.classList.add('sunday-disabled');
          cell.setAttribute('title', 'Duminică - zi liberă');
        }

        let cellDateKey = '';
        let displayDayNumber = 0;

        if (slotIndex < firstDayOfWeek) {
          displayDayNumber = daysInPrevMonth - firstDayOfWeek + slotIndex + 1;
          cell.classList.add('other-month');
          const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          cellDateKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(displayDayNumber).padStart(2, '0')}`;
        } else if (dayCounter <= daysInCurrentMonth) {
          displayDayNumber = dayCounter;
          cellDateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(displayDayNumber).padStart(2, '0')}`;
          dayCounter++;
        } else {
          displayDayNumber = nextMonthDayCounter;
          cell.classList.add('other-month');
          const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
          const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
          cellDateKey = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(displayDayNumber).padStart(2, '0')}`;
          nextMonthDayCounter++;
        }

        // Daca nu e duminica si e selectata
        const isSelected = (!isSunday && cellDateKey === selectedDateKey);
        if (isSelected) {
          cell.classList.add('is-selected');
        }

        // Rotița de setări apare DOAR la ziua selectată; celelalte zile cu date au punct discret
        const shift = shifts[cellDateKey];
        const hasShift = (!isSunday && shift && (shift.startTime || shift.endTime || (shift.cabinet && shift.cabinet !== '')));

        let indicatorHtml = '';
        if (!isSunday) {
          if (isSelected) {
            indicatorHtml = `
              <button type="button" class="day-gear-btn" data-date="${cellDateKey}" title="Detalii tură (Medic, Cabinet, KPI)" aria-label="Detalii tură">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
            `;
          } else if (hasShift) {
            indicatorHtml = `<div class="day-shift-indicator"><span class="shift-dot"></span></div>`;
          }
        }

        cell.innerHTML = `
          <div class="day-num-wrap">
            <span class="day-num">${displayDayNumber}</span>
            ${indicatorHtml}
          </div>
        `;

        // Click pe zi (doar daca NU e duminica)
        if (!isSunday) {
          const gearBtn = cell.querySelector('.day-gear-btn');
          if (gearBtn) {
            gearBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              selectedDateKey = cellDateKey;
              updateBottomBarState();
              renderAmoledCalendar();
              openDetailsSheet(cellDateKey);
            });
          }

          cell.addEventListener('click', () => {
            if (selectedDateKey !== cellDateKey) {
              selectedDateKey = cellDateKey;
              updateBottomBarState();
              renderAmoledCalendar();
            }
          });
        }

        weekRow.appendChild(cell);
      }

      el.amoledMonthGrid.appendChild(weekRow);
    }
  }

  // --- BARA DE JOS ---
  function updateBottomBarState() {
    if (!selectedDateKey) return;

    const [y, m, d] = selectedDateKey.split('-');
    const mIdx = parseInt(m, 10) - 1;
    el.selectedDateLabel.textContent = `Ziua: ${parseInt(d, 10)} ${MONTHS_SHORT_RO[mIdx]} ${y}`;

    const shift = shifts[selectedDateKey] || {};

    if (shift.startTime) {
      el.lblEntryTime.textContent = shift.startTime;
      el.btnLogEntry.classList.add('active');
    } else {
      el.lblEntryTime.textContent = '--:--';
      el.btnLogEntry.classList.remove('active');
    }

    if (shift.endTime) {
      el.lblExitTime.textContent = shift.endTime;
      el.btnLogExit.classList.add('active');
    } else {
      el.lblExitTime.textContent = '--:--';
      el.btnLogExit.classList.remove('active');
    }

    if (shift.startTime && shift.endTime) {
      el.btnEditExistingDetails.style.display = 'inline-block';
    } else {
      el.btnEditExistingDetails.style.display = 'none';
    }
  }

  // --- TIME PICKER MODAL (CENTRAT PE ECRAN) ---
  function populate24hSelects(selectedH, selectedM) {
    if (!el.selectHour24 || !el.selectMin24) return;

    let hoursHtml = '';
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, '0');
      const isSel = (hStr === selectedH) ? 'selected' : '';
      hoursHtml += `<option value="${hStr}" ${isSel}>${hStr}</option>`;
    }
    el.selectHour24.innerHTML = hoursHtml;

    const minsSet = new Set(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']);
    if (selectedM) minsSet.add(selectedM);
    const sortedMins = Array.from(minsSet).sort();

    let minsHtml = '';
    sortedMins.forEach(mStr => {
      const isSel = (mStr === selectedM) ? 'selected' : '';
      minsHtml += `<option value="${mStr}" ${isSel}>${mStr}</option>`;
    });
    el.selectMin24.innerHTML = minsHtml;
  }

  function updateConfirmButtonLabel() {
    if (!el.btnConfirmTime) return;
    const h = el.selectHour24 ? el.selectHour24.value : '08';
    const m = el.selectMin24 ? el.selectMin24.value : '30';
    el.btnConfirmTime.textContent = `Confirmă ${h}:${m}`;
  }

  function openTimePicker(type) {
    activeTimePickingType = type;
    const isEntry = type === 'entry';
    el.timePickerTitle.textContent = isEntry ? 'Ora Intrării' : 'Ora Ieșirii';

    const now = new Date();
    const currentHH = String(now.getHours()).padStart(2, '0');
    const currentMM = String(now.getMinutes()).padStart(2, '0');
    const currentHHMM = `${currentHH}:${currentMM}`;

    const existingTime = isEntry ? (shifts[selectedDateKey]?.startTime || '') : (shifts[selectedDateKey]?.endTime || '');
    let defaultTime = existingTime || (isEntry ? '08:30' : '16:30');
    let [initHour, initMin] = defaultTime.split(':');
    if (!initHour) initHour = isEntry ? '08' : '16';
    if (!initMin) initMin = isEntry ? '30' : '30';

    populate24hSelects(initHour, initMin);
    updateConfirmButtonLabel();

    const sat = isSaturday(selectedDateKey);
    const presets = isEntry ? (sat ? [
      { label: `Acum (${currentHHMM})`, time: currentHHMM, isManual: false },
      { label: `08:30 <span class="tag-accent-yellow">(Sâmbătă)</span>`, time: '08:30', isManual: false },
      { label: `Manual`, time: null, isManual: true }
    ] : [
      { label: `Acum (${currentHHMM})`, time: currentHHMM, isManual: false },
      { label: `08:30 <span class="tag-accent-yellow">(Full)</span>`, time: '08:30', isManual: false },
      { label: `16:00 <span class="tag-accent-yellow">(Part)</span>`, time: '16:00', isManual: false },
      { label: `Manual`, time: null, isManual: true }
    ]) : (sat ? [
      { label: `Acum (${currentHHMM})`, time: currentHHMM, isManual: false },
      { label: `14:00 <span class="tag-accent-yellow">(Sâmbătă)</span>`, time: '14:00', isManual: false },
      { label: `Manual`, time: null, isManual: true }
    ] : [
      { label: `Acum (${currentHHMM})`, time: currentHHMM, isManual: false },
      { label: `16:30 <span class="tag-accent-yellow">(Full)</span>`, time: '16:30', isManual: false },
      { label: `20:30 <span class="tag-accent-yellow">(Part)</span>`, time: '20:30', isManual: false },
      { label: `Manual`, time: null, isManual: true }
    ]);

    if (el.timePresetsContainer) {
      el.timePresetsContainer.innerHTML = presets.map(p => `
        <button type="button" class="time-preset-btn" data-manual="${p.isManual}" data-time="${p.time || ''}">${p.label}</button>
      `).join('');

      el.timePresetsContainer.querySelectorAll('.time-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.manual === 'true') {
            el.timePresetsContainer.querySelectorAll('.time-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (el.manualPickerSection) {
              el.manualPickerSection.style.display = 'flex';
            }
            updateConfirmButtonLabel();
          } else {
            applyTimeValue(btn.dataset.time);
          }
        });
      });
    }

    if (el.manualPickerSection) {
      el.manualPickerSection.style.display = 'none';
    }

    el.timePickerModal.classList.add('active');
  }

  function closeTimePicker() {
    el.timePickerModal.classList.remove('active');
    if (el.manualPickerSection) {
      el.manualPickerSection.style.display = 'none';
    }
  }

  function applyTimeValue(timeValue) {
    if (!selectedDateKey) return;

    if (!shifts[selectedDateKey]) {
      const [y, m, d] = selectedDateKey.split('-');
      shifts[selectedDateKey] = {
        date: selectedDateKey,
        displayDate: `${d}.${m}.${y}`,
        startTime: '',
        endTime: '',
        shiftType: 'full',
        cabinet: cabinets[0] || 'Cabinetul 3',
        doctor: doctors[0] || 'Dr. Moga',
        activities: '—',
        hours: 0
      };
    }

    const sat = isSaturday(selectedDateKey);
    if (activeTimePickingType === 'entry') {
      shifts[selectedDateKey].startTime = timeValue;
      if (!shifts[selectedDateKey].shiftType) {
        shifts[selectedDateKey].shiftType = sat ? 'full' : ((timeValue >= '14:00') ? 'part' : 'full');
      }
    } else {
      shifts[selectedDateKey].endTime = timeValue;
      if (!shifts[selectedDateKey].shiftType) {
        shifts[selectedDateKey].shiftType = sat ? 'full' : ((shifts[selectedDateKey].startTime && shifts[selectedDateKey].startTime >= '14:00') ? 'part' : 'full');
      }
    }
    if (sat) {
      shifts[selectedDateKey].shiftType = 'full';
    }

    if (shifts[selectedDateKey].startTime && shifts[selectedDateKey].endTime) {
      shifts[selectedDateKey].hours = calculateShiftDuration(
        shifts[selectedDateKey].startTime,
        shifts[selectedDateKey].endTime
      );
    }

    saveStorage(STORAGE_KEYS.SHIFTS, shifts);
    updateBottomBarState();
    renderAmoledCalendar();
    renderReportTable();
    closeTimePicker();
  }

  function calculateShiftDuration(start, end) {
    if (!start || !end) return 0;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff < 0) diff += 24 * 60;
    return parseFloat((diff / 60).toFixed(1));
  }

  function isSaturday(dateKey) {
    if (!dateKey) return false;
    const parts = dateKey.split('-').map(Number);
    if (parts.length < 3) return false;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.getDay() === 6;
  }

  function calculateBonusHours(startTime, endTime, shiftType = 'full', dateKey = null) {
    if (!startTime || !endTime) return 0;
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    let startMin = sH * 60 + sM;
    let endMin = eH * 60 + eM;
    if (endMin < startMin) {
      endMin += 24 * 60;
    }

    const workedMin = endMin - startMin;

    const targetDate = dateKey || selectedDateKey;

    // Sâmbătă: programul este până la ora 14:00 (840 min). Tot ce depășește ora 14:00 este bonus!
    if (targetDate && isSaturday(targetDate)) {
      const saturdayEndMin = 14 * 60; // 840 min (ora 14:00)
      if (endMin > saturdayEndMin) {
        const effectiveStart = Math.max(startMin, saturdayEndMin);
        const bonusMin = endMin - effectiveStart;
        return parseFloat((bonusMin / 60).toFixed(1));
      }
      return 0;
    }

    // Part-time în cursul săptămânii: 4.5h (270 min)
    if (shiftType === 'part') {
      const partTimeNormMin = 270; // 4.5 ore
      const bonusMin = Math.max(0, workedMin - partTimeNormMin);
      return parseFloat((bonusMin / 60).toFixed(1));
    }

    // Full-time în cursul săptămânii: depășirea orei 16:30
    let thresholdMin = 16 * 60 + 30;
    let bonusMin = 0;
    if (endMin > thresholdMin) {
      const effectiveStart = Math.max(startMin, thresholdMin);
      bonusMin = endMin - effectiveStart;
    }
    return parseFloat((bonusMin / 60).toFixed(1));
  }

  function updateDetailsShiftTypeUI() {
    const sat = isSaturday(selectedDateKey);
    if (sat) {
      currentDetailsShiftType = 'full';
      if (el.btnShiftTypeFull) {
        el.btnShiftTypeFull.textContent = 'Sâmbătă';
        el.btnShiftTypeFull.classList.add('active');
      }
      if (el.btnShiftTypePart) {
        el.btnShiftTypePart.style.display = 'none';
      }
    } else {
      if (el.btnShiftTypeFull) {
        el.btnShiftTypeFull.textContent = 'Full';
      }
      if (el.btnShiftTypePart) {
        el.btnShiftTypePart.style.display = '';
        el.btnShiftTypePart.textContent = 'Part';
      }
      if (el.btnShiftTypeFull && el.btnShiftTypePart) {
        if (currentDetailsShiftType === 'part') {
          el.btnShiftTypePart.classList.add('active');
          el.btnShiftTypeFull.classList.remove('active');
        } else {
          el.btnShiftTypeFull.classList.add('active');
          el.btnShiftTypePart.classList.remove('active');
        }
      }
    }

    if (selectedDateKey && shifts[selectedDateKey]) {
      const shift = shifts[selectedDateKey];
      const bonus = calculateBonusHours(shift.startTime, shift.endTime, currentDetailsShiftType, selectedDateKey);
      if (bonus > 0 && el.detailsSummaryBonus) {
        el.detailsSummaryBonus.textContent = `+${bonus.toFixed(1)}h bonus`;
        el.detailsSummaryBonus.style.display = 'inline-block';
      } else if (el.detailsSummaryBonus) {
        el.detailsSummaryBonus.style.display = 'none';
      }
    }
  }

  // --- DETAILS MODAL CENTRAT (CABINET, MEDIC, KPI INCLUSIV SEDARI) ---
  function openDetailsSheet(dateKey) {
    selectedDateKey = dateKey || selectedDateKey;
    if (!selectedDateKey) return;

    const sat = isSaturday(selectedDateKey);

    if (!shifts[selectedDateKey]) {
      const [y, m, d] = selectedDateKey.split('-');
      shifts[selectedDateKey] = {
        date: selectedDateKey,
        displayDate: `${d}.${m}.${y}`,
        startTime: '',
        endTime: '',
        shiftType: 'full',
        cabinet: cabinets[0] || 'Cabinetul 3',
        doctor: doctors[0] || 'Dr. Moga',
        activities: '—',
        hours: 0
      };
    }

    const shift = shifts[selectedDateKey];
    if (sat) {
      shift.shiftType = 'full';
    } else if (!shift.shiftType) {
      shift.shiftType = (shift.startTime && shift.startTime >= '14:00') ? 'part' : 'full';
    }
    currentDetailsShiftType = shift.shiftType;

    const [y, m, d] = selectedDateKey.split('-');
    const dateObj = new Date(selectedDateKey + 'T00:00:00');
    el.detailsDateTitle.textContent = `${parseInt(d, 10)} ${MONTHS_FULL_RO[dateObj.getMonth()]} ${y}`;

    const start = shift.startTime || '--:--';
    const end = shift.endTime || '--:--';
    const duration = calculateShiftDuration(shift.startTime, shift.endTime);
    el.detailsSummaryInterval.innerHTML = `${escapeHtml(start)} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="inline-arrow"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> ${escapeHtml(end)}`;
    el.detailsSummaryDuration.textContent = `${duration} ore`;

    updateDetailsShiftTypeUI();

    el.selectCabinet.value = shift.cabinet || (cabinets[0] || '');
    renderCustomCabinetOptions();

    el.selectDoctor.value = shift.doctor || (doctors[0] || '');
    renderCustomDoctorOptions();

    el.inputActivities.value = shift.activities || '—';

    el.btnDeleteFullShift.style.display = (shift.startTime || shift.endTime) ? 'inline-block' : 'none';

    renderDetailsKpiStrip();
    el.detailsBackdrop.classList.add('active');
  }

  function closeDetailsSheet() {
    closeCustomSelects();
    el.detailsBackdrop.classList.remove('active');
  }

  function saveFullShift() {
    if (!selectedDateKey || !shifts[selectedDateKey]) return;

    let activities = el.inputActivities.value.trim();
    if (!activities) activities = '—';

    shifts[selectedDateKey].cabinet = el.selectCabinet.value;
    shifts[selectedDateKey].doctor = el.selectDoctor.value;
    shifts[selectedDateKey].activities = activities;
    shifts[selectedDateKey].shiftType = currentDetailsShiftType || 'full';

    saveStorage(STORAGE_KEYS.SHIFTS, shifts);
    updateBottomBarState();
    renderAmoledCalendar();
    renderReportTable();
    closeDetailsSheet();
    showToast('Tura salvată.');
  }

  function deleteFullShift() {
    if (!selectedDateKey || !shifts[selectedDateKey]) return;
    delete shifts[selectedDateKey];
    saveStorage(STORAGE_KEYS.SHIFTS, shifts);
    updateBottomBarState();
    renderAmoledCalendar();
    renderReportTable();
    closeDetailsSheet();
    showToast('Tura ștearsă.');
  }

  function renderDetailsKpiStrip() {
    if (!el.detailsKpiStrip) return;

    let html = '';
    kpis.forEach(k => {
      if (k.type === 'volume') {
        html += `<button type="button" class="amoled-kpi-chip" data-kpi-name="${escapeHtml(k.name)}" data-kpi-type="volume">+1 ${escapeHtml(k.name)}</button>`;
      } else {
        html += `<button type="button" class="amoled-kpi-chip" data-kpi-name="${escapeHtml(k.name)}" data-kpi-type="duration">+ ${escapeHtml(k.name)}</button>`;
      }
    });

    html += `
      <button type="button" class="amoled-kpi-chip" data-action="none">—</button>
      <button type="button" class="amoled-kpi-chip clear-chip" data-action="clear" aria-label="Golește">✕</button>
    `;

    el.detailsKpiStrip.innerHTML = html;
  }

  function handleVolumeKpiClick(kpiName) {
    let current = el.inputActivities.value.trim();
    if (current === '—' || current === '') current = '';

    const escapedName = kpiName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(\\d+)\\s*${escapedName}`, 'i');
    const match = current.match(regex);

    if (match) {
      const nextCount = parseInt(match[1], 10) + 1;
      current = current.replace(regex, `${nextCount} ${kpiName}`);
    } else if (new RegExp(escapedName, 'i').test(current)) {
      current = current.replace(new RegExp(escapedName, 'i'), `2 ${kpiName}`);
    } else {
      if (current.length > 0 && !current.endsWith(',')) current += ', ';
      current += `1 ${kpiName}`;
    }

    el.inputActivities.value = current.replace(/,\s*,/g, ', ').trim();
  }

  function extractDurationMinutes(str, keyword) {
    if (!str || !keyword) return 0;
    const escapedKey = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('-', '[- ]?');
    const regex = new RegExp(`${escapedKey}\\s*(?:\\(([^)]+)\\))?`, 'gi');

    let totalMinutes = 0;
    let match;
    while ((match = regex.exec(str)) !== null) {
      const inside = match[1];
      if (!inside) continue;

      // 1. Verificam daca contine interval orar: HH:MM - HH:MM
      const intervalMatch = inside.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
      if (intervalMatch) {
        const [sH, sM] = intervalMatch[1].split(':').map(Number);
        const [eH, eM] = intervalMatch[2].split(':').map(Number);
        let diff = (eH * 60 + eM) - (sH * 60 + sM);
        if (diff < 0) diff += 24 * 60;
        totalMinutes += diff;
        continue;
      }

      // 2. Format ore si minute
      let parsed = false;
      const hMatch = inside.match(/(\d+(?:\.\d+)?)\s*h(?:our|ours|ora|ore)?/i);
      if (hMatch) {
        totalMinutes += Math.round(parseFloat(hMatch[1]) * 60);
        parsed = true;
      }

      const mMatch = inside.match(/(\d+)\s*m(?:in|inute|inutes)?/i);
      if (mMatch) {
        totalMinutes += parseInt(mMatch[1], 10);
        parsed = true;
      }

      if (!parsed) {
        const numMatch = inside.match(/(\d+)/);
        if (numMatch) totalMinutes += parseInt(numMatch[1], 10);
      }
    }

    return totalMinutes;
  }

  function formatDuration(totalMinutes) {
    if (totalMinutes <= 0) return '0 min';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} ${h === 1 ? 'oră' : 'ore'}`;
    return `${h}h ${m} min`;
  }

  function populateKpiDropdowns(startH = '10', startM = '00', endH = '11', endM = '00', durH = '01', durM = '00') {
    if (!el.selectKpiStartH || !el.selectKpiStartM || !el.selectKpiEndH || !el.selectKpiEndM || !el.selectKpiHours || !el.selectKpiMinutes) return;

    let shHtml = '';
    for (let h = 0; h < 24; h++) {
      const str = String(h).padStart(2, '0');
      shHtml += `<option value="${str}" ${str === startH ? 'selected' : ''}>${str}</option>`;
    }
    el.selectKpiStartH.innerHTML = shHtml;
    el.selectKpiStartH.value = startH;

    let smHtml = '';
    for (let m = 0; m < 60; m += 5) {
      const str = String(m).padStart(2, '0');
      smHtml += `<option value="${str}" ${str === startM ? 'selected' : ''}>${str}</option>`;
    }
    el.selectKpiStartM.innerHTML = smHtml;
    el.selectKpiStartM.value = startM;

    let ehHtml = '';
    for (let h = 0; h < 24; h++) {
      const str = String(h).padStart(2, '0');
      ehHtml += `<option value="${str}" ${str === endH ? 'selected' : ''}>${str}</option>`;
    }
    el.selectKpiEndH.innerHTML = ehHtml;
    el.selectKpiEndH.value = endH;

    let emHtml = '';
    for (let m = 0; m < 60; m += 5) {
      const str = String(m).padStart(2, '0');
      emHtml += `<option value="${str}" ${str === endM ? 'selected' : ''}>${str}</option>`;
    }
    el.selectKpiEndM.innerHTML = emHtml;
    el.selectKpiEndM.value = endM;

    let dhHtml = '';
    for (let h = 0; h <= 8; h++) {
      const str = String(h).padStart(2, '0');
      dhHtml += `<option value="${str}" ${str === durH ? 'selected' : ''}>${str}</option>`;
    }
    el.selectKpiHours.innerHTML = dhHtml;
    el.selectKpiHours.value = durH;

    let dmHtml = '';
    for (let m = 0; m < 60; m += 5) {
      const str = String(m).padStart(2, '0');
      dmHtml += `<option value="${str}" ${str === durM ? 'selected' : ''}>${str}</option>`;
    }
    el.selectKpiMinutes.innerHTML = dmHtml;
    el.selectKpiMinutes.value = durM;
  }

  function updateKpiIntervalCalc() {
    if (!el.selectKpiStartH || !el.selectKpiStartM || !el.selectKpiEndH || !el.selectKpiEndM) return;
    const sH = parseInt(el.selectKpiStartH.value, 10) || 0;
    const sM = parseInt(el.selectKpiStartM.value, 10) || 0;
    const eH = parseInt(el.selectKpiEndH.value, 10) || 0;
    const eM = parseInt(el.selectKpiEndM.value, 10) || 0;

    const startMin = sH * 60 + sM;
    let endMin = eH * 60 + eM;
    const isOvernight = endMin < startMin;
    if (isOvernight) {
      endMin += 24 * 60;
    }
    const diff = endMin - startMin;

    const sTime = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
    const eTime = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;

    if (diff > 0) {
      const durText = formatDuration(diff);
      const overnightTag = isOvernight ? ' <span style="color: #facc15; font-size: 0.74rem;">(peste noapte)</span>' : '';
      if (el.kpiIntervalCalcBadge) {
        el.kpiIntervalCalcBadge.style.display = 'block';
        el.kpiIntervalCalcBadge.innerHTML = `Durată: <span>${durText}</span>${overnightTag}`;
      }
      if (el.btnConfirmKpiDuration && activeKpiMode === 'interval') {
        el.btnConfirmKpiDuration.textContent = `Confirmă ${sTime} – ${eTime} (${durText})`;
        el.btnConfirmKpiDuration.disabled = false;
        el.btnConfirmKpiDuration.style.opacity = '1';
        el.btnConfirmKpiDuration.style.pointerEvents = 'auto';
      }
    } else {
      if (el.kpiIntervalCalcBadge) {
        el.kpiIntervalCalcBadge.style.display = 'block';
        el.kpiIntervalCalcBadge.innerHTML = `<span style="color: #a1a1aa;">Ora de început și de sfârșit sunt identice</span>`;
      }
      if (el.btnConfirmKpiDuration && activeKpiMode === 'interval') {
        el.btnConfirmKpiDuration.textContent = `Alege intervalul`;
        el.btnConfirmKpiDuration.disabled = true;
        el.btnConfirmKpiDuration.style.opacity = '0.5';
        el.btnConfirmKpiDuration.style.pointerEvents = 'none';
      }
    }
  }

  function updateKpiDurationCalc() {
    if (!el.selectKpiHours || !el.selectKpiMinutes) return;
    const h = parseInt(el.selectKpiHours.value, 10) || 0;
    const m = parseInt(el.selectKpiMinutes.value, 10) || 0;
    const totalMinutes = h * 60 + m;

    if (totalMinutes > 0) {
      const durText = formatDuration(totalMinutes);
      if (el.btnConfirmKpiDuration && activeKpiMode === 'duration') {
        el.btnConfirmKpiDuration.textContent = `Confirmă ${durText}`;
        el.btnConfirmKpiDuration.disabled = false;
        el.btnConfirmKpiDuration.style.opacity = '1';
        el.btnConfirmKpiDuration.style.pointerEvents = 'auto';
      }
    } else {
      if (el.btnConfirmKpiDuration && activeKpiMode === 'duration') {
        el.btnConfirmKpiDuration.textContent = `Alege durata`;
        el.btnConfirmKpiDuration.disabled = true;
        el.btnConfirmKpiDuration.style.opacity = '0.5';
        el.btnConfirmKpiDuration.style.pointerEvents = 'none';
      }
    }
  }

  function setKpiMode(mode) {
    activeKpiMode = mode;
    if (el.btnKpiModeInterval && el.btnKpiModeDuration) {
      if (mode === 'interval') {
        el.btnKpiModeInterval.classList.add('active');
        el.btnKpiModeDuration.classList.remove('active');
        if (el.kpiIntervalSection) el.kpiIntervalSection.style.display = 'block';
        if (el.kpiDurationSection) el.kpiDurationSection.style.display = 'none';
        updateKpiIntervalCalc();
      } else {
        el.btnKpiModeDuration.classList.add('active');
        el.btnKpiModeInterval.classList.remove('active');
        if (el.kpiDurationSection) el.kpiDurationSection.style.display = 'block';
        if (el.kpiIntervalSection) el.kpiIntervalSection.style.display = 'none';
        updateKpiDurationCalc();
      }
    }
  }

  function openKpiDurationModal(kpiName) {
    activeDurationKpi = kpiName;
    if (el.kpiDurationTitle) {
      el.kpiDurationTitle.textContent = kpiName;
    }

    const current = el.inputActivities ? el.inputActivities.value.trim() : '';

    let initialMode = 'interval';
    let startH = '10';
    let startM = '00';
    let endH = '11';
    let endM = '00';
    let durH = '01';
    let durM = '00';

    if (kpiName.toLowerCase().includes('post-op') || kpiName.toLowerCase().includes('postop')) {
      endH = '10';
      endM = '20';
      durH = '00';
      durM = '20';
    }

    // Daca exista deja intervale inregistrate azi, sugeram automat pornirea dupa ultimul interval
    if (current && current !== '—') {
      const allIntervals = [...current.matchAll(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/g)];
      if (allIntervals.length > 0) {
        const last = allIntervals[allIntervals.length - 1];
        const lastEndH = parseInt(last[3], 10);
        const lastEndM = parseInt(last[4], 10);
        let nextStartMin = lastEndH * 60 + lastEndM;
        if (nextStartMin < 23 * 60) {
          if (nextStartMin % 15 !== 0) nextStartMin += (15 - (nextStartMin % 15));
          const stepMins = (durH === '00') ? (parseInt(durM, 10) || 20) : 60;
          const nextEndMin = Math.min(nextStartMin + stepMins, 23 * 60 + 55);

          startH = String(Math.floor(nextStartMin / 60)).padStart(2, '0');
          startM = String(nextStartMin % 60).padStart(2, '0');
          endH = String(Math.floor(nextEndMin / 60)).padStart(2, '0');
          endM = String(nextEndMin % 60).padStart(2, '0');
        }
      }
    }

    populateKpiDropdowns(startH, startM, endH, endM, durH, durM);
    setKpiMode(initialMode);

    if (el.kpiDurationModal) {
      el.kpiDurationModal.classList.add('active');
    }
  }

  function closeKpiDurationModal() {
    if (el.kpiDurationModal) {
      el.kpiDurationModal.classList.remove('active');
    }
    activeDurationKpi = null;
  }

  function applyIntervalToKpi(kpiName, start, end) {
    if (!kpiName || !start || !end) return;
    let current = el.inputActivities.value.trim();
    if (current === '—' || current === '') current = '';

    const newText = `${kpiName} (${start} - ${end})`;

    if (current.length > 0 && !current.endsWith(',')) current += ', ';
    current += newText;

    el.inputActivities.value = current.replace(/,\s*,/g, ', ').trim();
    closeKpiDurationModal();
  }

  function applyDurationToKpi(kpiName, totalMinutes) {
    if (!kpiName || totalMinutes <= 0) return;
    let current = el.inputActivities.value.trim();
    if (current === '—' || current === '') current = '';

    const durStr = formatDuration(totalMinutes);
    const newText = `${kpiName} (${durStr})`;

    if (current.length > 0 && !current.endsWith(',')) current += ', ';
    current += newText;

    el.inputActivities.value = current.replace(/,\s*,/g, ', ').trim();
    closeKpiDurationModal();
  }

  // --- RANDARE RAPORT LUNAR ---
  function getSortedMonthShifts() {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
    const keys = Object.keys(shifts).filter(k => k.startsWith(prefix) && shifts[k].startTime && shifts[k].endTime).sort();
    return keys.map(k => shifts[k]);
  }

  function renderReportTable() {
    const monthShifts = getSortedMonthShifts();
    let totalHours = 0;
    let totalBonusHours = 0;

    // Track dynamic stats for all configured KPIs
    const kpiStats = {};
    kpis.forEach(k => {
      kpiStats[k.name] = {
        name: k.name,
        type: k.type,
        count: 0,
        minutes: 0
      };
    });

    if (monthShifts.length === 0) {
      el.officialTableBody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; color: var(--text-gray-dim); padding: 24px;">
            Nicio tură completată pentru ${MONTHS_FULL_RO[currentMonth]} ${currentYear}.
          </td>
        </tr>
      `;
      if (el.tableTotalsHours) el.tableTotalsHours.textContent = 'Total: 0h • 0 ture';
      if (el.tableTotalsKpi) el.tableTotalsKpi.textContent = '—';
      return;
    }

    const rows = monthShifts.map(s => {
      const duration = parseFloat(s.hours || calculateShiftDuration(s.startTime, s.endTime) || 0);
      totalHours += duration;

      const sat = isSaturday(s.date);
      const sType = sat ? 'full' : (s.shiftType || ((s.startTime && s.startTime >= '14:00') ? 'part' : 'full'));
      const bonus = calculateBonusHours(s.startTime, s.endTime, sType, s.date);
      totalBonusHours += bonus;

      const act = s.activities || '';
      kpis.forEach(k => {
        const escapedName = k.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (k.type === 'volume') {
          const numMatch = act.match(new RegExp(`(\\d+)\\s*${escapedName}`, 'i'));
          if (numMatch) {
            kpiStats[k.name].count += parseInt(numMatch[1], 10);
          } else if (new RegExp(escapedName, 'i').test(act)) {
            kpiStats[k.name].count += 1;
          }
        } else {
          const regex = new RegExp(`${escapedName.replace('-', '[- ]?')}(?:\\s*\\([^)]*\\))?`, 'gi');
          const matches = act.matchAll(regex);
          for (const m of matches) {
            kpiStats[k.name].count += 1;
            const mins = extractDurationMinutes(m[0], k.name);
            if (mins) kpiStats[k.name].minutes += mins;
          }
        }
      });

      const typeLabel = sat ? 'Sâmbătă' : (sType === 'part' ? 'Part' : 'Full');

      return `
        <tr>
          <td class="col-date">${escapeHtml(s.displayDate)}</td>
          <td class="col-type"><span class="type-pill ${sType === 'part' ? 'part' : 'full'}">${typeLabel}</span></td>
          <td class="col-time">${escapeHtml(s.startTime)}</td>
          <td class="col-time">${escapeHtml(s.endTime)}</td>
          <td class="col-hours">${duration.toFixed(1)}h</td>
          <td class="col-bonus">${bonus > 0 ? `<span class="bonus-badge">+${bonus.toFixed(1)}h</span>` : '<span style="color: var(--text-gray-dim);">—</span>'}</td>
          <td class="col-cabinet">${escapeHtml(s.cabinet)}</td>
          <td class="col-doctor">${escapeHtml(s.doctor)}</td>
          <td class="col-kpi">${escapeHtml(s.activities || '—')}</td>
          <td class="col-actions no-capture">
            <div class="table-row-actions">
              <button type="button" class="table-action-btn sync-btn upload" onclick="window.DentalApp.uploadDay('${s.date}', this)" title="Încarcă ziua în cloud" aria-label="Încarcă ziua">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </button>
              <button type="button" class="table-action-btn sync-btn download" onclick="window.DentalApp.downloadDay('${s.date}', this)" title="Descarcă ziua din cloud" aria-label="Descarcă ziua">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button type="button" class="table-action-btn edit" onclick="window.DentalApp.edit('${s.date}')" title="Modifică tură" aria-label="Modifică">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button type="button" class="table-action-btn delete" onclick="window.DentalApp.del('${s.date}')" title="Șterge tură" aria-label="Șterge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    el.officialTableBody.innerHTML = rows;
    el.tableTotalsHours.innerHTML = `Total: ${totalHours.toFixed(1)}h • ${monthShifts.length} ture ${totalBonusHours > 0 ? `<span class="bonus-accent">(+${totalBonusHours.toFixed(1)}h bonus)</span>` : ''}`;
    
    const kpiSummaryParts = [];
    kpis.forEach(k => {
      const stat = kpiStats[k.name];
      if (stat) {
        if (stat.type === 'volume') {
          if (stat.count > 0 || k.name === 'OPG' || k.name === 'CT') {
            kpiSummaryParts.push(`${stat.count} ${k.name}`);
          }
        } else {
          if (stat.count > 0) {
            const ore = stat.minutes / 60;
            const oreStr = ore % 1 === 0 ? ore.toFixed(0) : ore.toFixed(1);
            const label = stat.count === 1 ? k.name : (k.name === 'Sedare' ? 'Sedări' : k.name);
            kpiSummaryParts.push(`${stat.count} ${label} (${oreStr}h)`);
          }
        }
      }
    });

    el.tableTotalsKpi.textContent = kpiSummaryParts.length > 0 ? kpiSummaryParts.join(' • ') : '—';
  }

  // --- COPIERE TABEL PENTRU MICROSOFT TEAMS (HTML RICH-TEXT) ---
  async function copyTableForTeams() {
    const monthShifts = getSortedMonthShifts();
    if (monthShifts.length === 0) {
      showToast('Nu sunt date de copiat.');
      return;
    }

    let totalHours = 0;
    let totalBonusHours = 0;

    // HTML Table cu stiluri inline compatibile 100% cu Microsoft Teams
    let html = `
      <table style="border-collapse: collapse; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #1f2937;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-weight: bold;">Data</th>
            <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-weight: bold;">Tip</th>
            <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-weight: bold;">Intrare</th>
            <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-weight: bold;">Ieșire</th>
            <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-weight: bold;">Ore</th>
            <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-weight: bold;">Bonus</th>
            <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-weight: bold;">Cab.</th>
            <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-weight: bold;">Medic</th>
            <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-weight: bold;">KPI</th>
          </tr>
        </thead>
        <tbody>
    `;

    monthShifts.forEach((s, idx) => {
      const duration = parseFloat(s.hours || calculateShiftDuration(s.startTime, s.endTime) || 0);
      totalHours += duration;
      const sat = isSaturday(s.date);
      const sType = sat ? 'full' : (s.shiftType || ((s.startTime && s.startTime >= '14:00') ? 'part' : 'full'));
      const bonus = calculateBonusHours(s.startTime, s.endTime, sType, s.date);
      totalBonusHours += bonus;

      const typeStr = sat ? 'Sâmbătă' : (sType === 'part' ? 'Part' : 'Full');
      const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
      html += `
        <tr style="background-color: ${bg};">
          <td style="border: 1px solid #d1d5db; padding: 6px 10px;">${escapeHtml(s.displayDate)}</td>
          <td style="border: 1px solid #d1d5db; padding: 6px 10px;">${typeStr}</td>
          <td style="border: 1px solid #d1d5db; padding: 6px 10px;">${escapeHtml(s.startTime)}</td>
          <td style="border: 1px solid #d1d5db; padding: 6px 10px;">${escapeHtml(s.endTime)}</td>
          <td style="border: 1px solid #d1d5db; padding: 6px 10px;">${duration.toFixed(1)}h</td>
          <td style="border: 1px solid #d1d5db; padding: 6px 10px;">${bonus > 0 ? `+${bonus.toFixed(1)}h` : '—'}</td>
          <td style="border: 1px solid #d1d5db; padding: 6px 10px;">${escapeHtml(s.cabinet)}</td>
          <td style="border: 1px solid #d1d5db; padding: 6px 10px;">${escapeHtml(s.doctor)}</td>
          <td style="border: 1px solid #d1d5db; padding: 6px 10px;">${escapeHtml(s.activities || '—')}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
        <tfoot>
          <tr style="background-color: #f3f4f6; font-weight: bold;">
            <td colspan="4" style="border: 1px solid #d1d5db; padding: 6px 10px;">Total: ${totalHours.toFixed(1)}h ${totalBonusHours > 0 ? `(+${totalBonusHours.toFixed(1)}h bonus)` : ''}</td>
            <td colspan="5" style="border: 1px solid #d1d5db; padding: 6px 10px;">Ture: ${monthShifts.length}</td>
          </tr>
        </tfoot>
      </table>
    `;

    // Plaintext TSV fallback
    let tsv = 'Data\tTip\tIntrare\tIeșire\tOre\tBonus\tCab.\tMedic\tKPI\n';
    monthShifts.forEach(s => {
      const duration = parseFloat(s.hours || calculateShiftDuration(s.startTime, s.endTime) || 0);
      const sat = isSaturday(s.date);
      const sType = sat ? 'full' : (s.shiftType || ((s.startTime && s.startTime >= '14:00') ? 'part' : 'full'));
      const bonus = calculateBonusHours(s.startTime, s.endTime, sType, s.date);
      const typeStr = sat ? 'Sâmbătă' : (sType === 'part' ? 'Part' : 'Full');
      tsv += `${s.displayDate}\t${typeStr}\t${s.startTime}\t${s.endTime}\t${duration.toFixed(1)}h\t${bonus > 0 ? `+${bonus.toFixed(1)}h` : '—'}\t${s.cabinet}\t${s.doctor}\t${s.activities || '—'}\n`;
    });
    tsv += `Total: ${totalHours.toFixed(1)}h ${totalBonusHours > 0 ? `(+${totalBonusHours.toFixed(1)}h bonus)` : ''}\t\t\t\t\t\t\t\tTure: ${monthShifts.length}\n`;

    try {
      if (navigator.clipboard && navigator.clipboard.write) {
        const htmlBlob = new Blob([html], { type: 'text/html' });
        const textBlob = new Blob([tsv], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          })
        ]);
        showToast('Tabel copiat! Dă Paste (Ctrl+V) în Teams.');
      } else {
        await navigator.clipboard.writeText(tsv);
        showToast('Text copiat în clipboard.');
      }
    } catch (err) {
      console.warn('Clipboard HTML write failed:', err);
      try {
        await navigator.clipboard.writeText(tsv);
        showToast('Tabel copiat (text).');
      } catch (e2) {
        showToast('Eroare la copiere.');
      }
    }
  }

  // --- EXPORT WHATSAPP & PDF (CAPTURARE COMPLETĂ A TOT TABELULUI) ---
  async function captureFullReportCanvas(isLightMode = false) {
    const table = el.officialShiftsTable;
    if (!table || !el.reportCaptureArea) return null;

    // Masuram latimea necesara pentru a afisa toate coloanele aerisit fara scrollbar
    const tableScrollW = table.scrollWidth || 840;
    const targetWidth = Math.max(tableScrollW + 40, 920);
    const targetHeight = (el.reportCaptureArea.scrollHeight || 600) + 60;

    return await html2canvas(el.reportCaptureArea, {
      backgroundColor: isLightMode ? '#ffffff' : '#09090b',
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: targetWidth + 120,
      windowHeight: targetHeight + 100,
      onclone: (clonedDoc) => {
        const clonedArea = clonedDoc.getElementById('report-capture-area');
        const clonedScroll = clonedDoc.querySelector('.table-horizontal-scroll');
        const clonedTable = clonedDoc.getElementById('official-shifts-table');
        const clonedHeader = clonedDoc.getElementById('capture-header-banner');

        // Deblocam complet containerele de scroll pentru ca imaginea sa cuprinda absolut toate coloanele
        if (clonedArea) {
          clonedArea.style.width = `${targetWidth}px`;
          clonedArea.style.minWidth = `${targetWidth}px`;
          clonedArea.style.maxWidth = 'none';
          clonedArea.style.overflow = 'visible';
          clonedArea.style.padding = '20px';
          clonedArea.style.boxSizing = 'border-box';
          clonedArea.style.backgroundColor = isLightMode ? '#ffffff' : '#09090b';
        }

        if (clonedScroll) {
          clonedScroll.style.overflow = 'visible';
          clonedScroll.style.overflowX = 'visible';
          clonedScroll.style.overflowY = 'visible';
          clonedScroll.style.width = '100%';
          clonedScroll.style.maxWidth = 'none';
          clonedScroll.style.border = isLightMode ? '1px solid #d4d4d8' : '1px solid #27272a';
        }

        if (clonedTable) {
          clonedTable.style.width = '100%';
          clonedTable.style.minWidth = `${targetWidth - 40}px`;
          clonedTable.style.tableLayout = 'auto';

          if (isLightMode) {
            clonedTable.style.color = '#18181b';
            clonedTable.querySelectorAll('th').forEach(th => {
              th.style.backgroundColor = '#f4f4f5';
              th.style.color = '#09090b';
              th.style.borderColor = '#d4d4d8';
            });
            clonedTable.querySelectorAll('td').forEach(td => {
              td.style.color = '#18181b';
              td.style.borderColor = '#e4e4e7';
            });
            clonedTable.querySelectorAll('.clean-totals-row td').forEach(td => {
              td.style.backgroundColor = '#f4f4f5';
              td.style.color = '#09090b';
              td.style.borderColor = '#d4d4d8';
            });
          }
        }

        if (clonedHeader) {
          clonedHeader.style.width = '100%';
          if (isLightMode) {
            const titleEl = clonedHeader.querySelector('.capture-title-clinic');
            const subEl = clonedHeader.querySelector('.capture-title-sub');
            if (titleEl) titleEl.style.color = '#09090b';
            if (subEl) subEl.style.color = '#71717a';
            clonedHeader.style.borderBottomColor = '#e4e4e7';
          }
        }
      },
      ignoreElements: (element) => element.classList.contains('no-capture')
    });
  }

  async function generateScreenshot() {
    showToast('Generare screenshot tabel complet...');
    try {
      if (typeof html2canvas === 'undefined') {
        showToast('Se inițializează motorul grafic...');
        await new Promise(r => setTimeout(r, 350));
        if (typeof html2canvas === 'undefined') {
          showToast('Eroare: reîncărcați pagina.');
          return;
        }
      }
      const canvas = await captureFullReportCanvas(false);
      if (!canvas) {
        showToast('Eroare la generare.');
        return;
      }

      canvas.toBlob(blob => {
        if (!blob) {
          showToast('Eroare procesare imagine.');
          return;
        }
        generatedScreenshotBlob = blob;
        const imgUrl = URL.createObjectURL(blob);
        el.screenshotPreviewContainer.innerHTML = `<img src="${imgUrl}" alt="Raport Tabel Complet">`;
        el.screenshotModal.classList.add('active');
      }, 'image/png');
    } catch (err) {
      console.error(err);
      showToast('Eroare la generare imagine.');
    }
  }

  async function shareScreenshot() {
    if (!generatedScreenshotBlob) return;
    try {
      const fileName = `Raport_${MONTHS_SHORT_RO[currentMonth]}_${currentYear}.png`;
      const file = new File([generatedScreenshotBlob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Raport Pontaj ${MONTHS_FULL_RO[currentMonth]} ${currentYear}`,
          files: [file]
        });
        showToast('Raport partajat!');
        return;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Share error:', err);
      } else {
        return;
      }
    }
    // Fallback if navigator.share files is unsupported
    copyScreenshot();
  }

  async function copyScreenshot() {
    if (!generatedScreenshotBlob) return;
    try {
      if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': generatedScreenshotBlob })]);
        showToast('Imagine copiată! Dă Paste (WhatsApp/Teams).');
        return;
      }
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
    downloadScreenshot();
    showToast('Imagine salvată în descărcări.');
  }

  function downloadScreenshot() {
    if (!generatedScreenshotBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(generatedScreenshotBlob);
    a.download = `Raport_${MONTHS_SHORT_RO[currentMonth]}_${currentYear}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function exportPdf() {
    if (typeof window.jspdf !== 'undefined') {
      showToast('Generare PDF tabel complet...');
      try {
        const { jsPDF } = window.jspdf;
        const canvas = await captureFullReportCanvas(true);
        if (!canvas) {
          window.print();
          return;
        }

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
        pdf.save(`Raport_Pontaj_${MONTHS_SHORT_RO[currentMonth]}_${currentYear}.pdf`);
        showToast('PDF descărcat.');
      } catch (err) {
        console.error(err);
        window.print();
      }
    } else {
      window.print();
    }
  }

  // --- MENIU OPȚIUNI (CENTRAT) & TOAST ---
  function openDrawer() {
    el.drawerBackdrop.classList.add('active');
  }

  function closeDrawer() {
    el.drawerBackdrop.classList.remove('active');
  }

  let toastTimer = null;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove('show');
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  // --- BIND EVENIMENTE ---
  function bindEventListeners() {
    el.btnMonthPrev.addEventListener('click', () => changeMonth(-1));
    el.btnMonthNext.addEventListener('click', () => changeMonth(1));
    el.btnGoToday.addEventListener('click', goToday);

    el.btnLogEntry.addEventListener('click', () => openTimePicker('entry'));
    el.btnLogExit.addEventListener('click', () => openTimePicker('exit'));
    el.btnEditExistingDetails.addEventListener('click', () => openDetailsSheet(selectedDateKey));

    el.btnCloseTimePicker.addEventListener('click', closeTimePicker);
    el.timePickerModal.addEventListener('click', (e) => {
      if (e.target === el.timePickerModal) closeTimePicker();
    });

    el.btnConfirmTime.addEventListener('click', () => {
      if (el.selectHour24 && el.selectMin24) {
        applyTimeValue(`${el.selectHour24.value}:${el.selectMin24.value}`);
      }
    });

    if (el.selectHour24) el.selectHour24.addEventListener('change', updateConfirmButtonLabel);
    if (el.selectMin24) el.selectMin24.addEventListener('change', updateConfirmButtonLabel);

    el.detailsBackdrop.addEventListener('click', (e) => {
      if (e.target === el.detailsBackdrop) closeDetailsSheet();
    });
    el.btnCloseDetails.addEventListener('click', closeDetailsSheet);
    el.btnSaveFullShift.addEventListener('click', saveFullShift);
    el.btnDeleteFullShift.addEventListener('click', deleteFullShift);

    // Tip Tură Comutator (Full / Part)
    if (el.btnShiftTypeFull) {
      el.btnShiftTypeFull.addEventListener('click', (e) => {
        e.stopPropagation();
        currentDetailsShiftType = 'full';
        updateDetailsShiftTypeUI();
      });
    }
    if (el.btnShiftTypePart) {
      el.btnShiftTypePart.addEventListener('click', (e) => {
        e.stopPropagation();
        currentDetailsShiftType = 'part';
        updateDetailsShiftTypeUI();
      });
    }
    const shiftToggleWrap = document.getElementById('shift-type-toggle');
    if (shiftToggleWrap) {
      shiftToggleWrap.addEventListener('click', () => {
        currentDetailsShiftType = (currentDetailsShiftType === 'part') ? 'full' : 'part';
        updateDetailsShiftTypeUI();
      });
    }

    // Dynamic KPI Strip clicks
    if (el.detailsKpiStrip) {
      el.detailsKpiStrip.addEventListener('click', (e) => {
        const btn = e.target.closest('.amoled-kpi-chip');
        if (!btn) return;

        const action = btn.dataset.action;
        if (action === 'none') {
          el.inputActivities.value = '—';
          return;
        }
        if (action === 'clear') {
          el.inputActivities.value = '';
          return;
        }

        const kpiType = btn.dataset.kpiType;
        const kpiName = btn.dataset.kpiName;

        if (kpiType === 'volume') {
          handleVolumeKpiClick(kpiName);
        } else if (kpiType === 'duration') {
          openKpiDurationModal(kpiName);
        }
      });
    }

    // Custom KPI Duration & Interval Modal Events
    if (el.btnKpiModeInterval) {
      el.btnKpiModeInterval.addEventListener('click', () => setKpiMode('interval'));
    }
    if (el.btnKpiModeDuration) {
      el.btnKpiModeDuration.addEventListener('click', () => setKpiMode('duration'));
    }
    if (el.selectKpiStartH) el.selectKpiStartH.addEventListener('change', updateKpiIntervalCalc);
    if (el.selectKpiStartM) el.selectKpiStartM.addEventListener('change', updateKpiIntervalCalc);
    if (el.selectKpiEndH) el.selectKpiEndH.addEventListener('change', updateKpiIntervalCalc);
    if (el.selectKpiEndM) el.selectKpiEndM.addEventListener('change', updateKpiIntervalCalc);
    if (el.selectKpiHours) el.selectKpiHours.addEventListener('change', updateKpiDurationCalc);
    if (el.selectKpiMinutes) el.selectKpiMinutes.addEventListener('change', updateKpiDurationCalc);

    if (el.btnConfirmKpiDuration) {
      el.btnConfirmKpiDuration.addEventListener('click', () => {
        if (!activeDurationKpi) return;

        if (activeKpiMode === 'interval') {
          const sH = el.selectKpiStartH ? el.selectKpiStartH.value : '10';
          const sM = el.selectKpiStartM ? el.selectKpiStartM.value : '00';
          const eH = el.selectKpiEndH ? el.selectKpiEndH.value : '11';
          const eM = el.selectKpiEndM ? el.selectKpiEndM.value : '00';
          const start = `${sH}:${sM}`;
          const end = `${eH}:${eM}`;

          let diff = (parseInt(eH, 10) * 60 + parseInt(eM, 10)) - (parseInt(sH, 10) * 60 + parseInt(sM, 10));
          if (diff < 0) diff += 24 * 60; // Trecere peste noapte (overnight)
          if (diff === 0) {
            showToast('Ora de început și de sfârșit sunt identice.');
            return;
          }
          applyIntervalToKpi(activeDurationKpi, start, end);
        } else {
          const h = el.selectKpiHours ? parseInt(el.selectKpiHours.value, 10) : 0;
          const m = el.selectKpiMinutes ? parseInt(el.selectKpiMinutes.value, 10) : 0;
          const total = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
          if (total <= 0) {
            showToast('Selectează o durată validă.');
            return;
          }
          applyDurationToKpi(activeDurationKpi, total);
        }
      });
    }

    if (el.btnCloseKpiDuration) {
      el.btnCloseKpiDuration.addEventListener('click', closeKpiDurationModal);
    }

    if (el.kpiDurationModal) {
      el.kpiDurationModal.addEventListener('click', (e) => {
        if (e.target === el.kpiDurationModal) closeKpiDurationModal();
      });
    }

    // Custom Select: Cabinet
    if (el.btnSelectCabinet) {
      el.btnSelectCabinet.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = el.wrapperCabinet && el.wrapperCabinet.classList.contains('open');
        closeCustomSelects();
        if (!isOpen && el.wrapperCabinet) {
          el.wrapperCabinet.classList.add('open');
          el.btnSelectCabinet.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (el.menuSelectCabinet) {
      el.menuSelectCabinet.addEventListener('click', (e) => {
        const item = e.target.closest('.custom-select-item');
        if (item) {
          const val = item.dataset.value;
          if (el.selectCabinet) el.selectCabinet.value = val;
          renderCustomCabinetOptions();
          closeCustomSelects();
        }
      });
    }

    // Custom Select: Doctor
    if (el.btnSelectDoctor) {
      el.btnSelectDoctor.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = el.wrapperDoctor && el.wrapperDoctor.classList.contains('open');
        closeCustomSelects();
        if (!isOpen && el.wrapperDoctor) {
          el.wrapperDoctor.classList.add('open');
          el.btnSelectDoctor.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (el.menuSelectDoctor) {
      el.menuSelectDoctor.addEventListener('click', (e) => {
        const item = e.target.closest('.custom-select-item');
        if (item) {
          const val = item.dataset.value;
          if (el.selectDoctor) el.selectDoctor.value = val;
          renderCustomDoctorOptions();
          closeCustomSelects();
        }
      });
    }

    // Click outside / Escape closes custom selects
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-select-wrapper')) {
        closeCustomSelects();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCustomSelects();
      }
    });

    // Deschiderea si inchiderea raportului
    if (el.btnToggleReport) {
      el.btnToggleReport.addEventListener('click', () => {
        renderReportTable();
        el.reportViewOverlay.classList.add('open');
      });
    }
    el.btnCloseReportView.addEventListener('click', () => {
      el.reportViewOverlay.classList.remove('open');
    });

    // Sincronizare Cloud (Toate datele)
    if (el.btnSyncUploadAll) {
      el.btnSyncUploadAll.addEventListener('click', (e) => {
        window.DentalApp.uploadAll(e.currentTarget);
      });
    }
    if (el.btnSyncDownloadAll) {
      el.btnSyncDownloadAll.addEventListener('click', (e) => {
        window.DentalApp.downloadAll(e.currentTarget);
      });
    }

    // Copiere pentru Teams
    el.btnCopyTeams.addEventListener('click', copyTableForTeams);

    // Exporturi
    el.btnExportScreenshot.addEventListener('click', generateScreenshot);
    el.btnExportPdf.addEventListener('click', exportPdf);
    if (el.btnShareWhatsapp) el.btnShareWhatsapp.addEventListener('click', shareScreenshot);
    el.btnCopyClipboard.addEventListener('click', copyScreenshot);
    el.btnDownloadImg.addEventListener('click', downloadScreenshot);
    el.btnCloseScreenshotModal.addEventListener('click', () => {
      el.screenshotModal.classList.remove('active');
    });
    el.screenshotModal.addEventListener('click', (e) => {
      if (e.target === el.screenshotModal) {
        el.screenshotModal.classList.remove('active');
      }
    });

    // Drawer / Meniu Opțiuni Centrat
    el.btnOpenDrawer.addEventListener('click', openDrawer);
    el.btnCloseDrawer.addEventListener('click', closeDrawer);
    el.drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === el.drawerBackdrop) closeDrawer();
    });

    el.drawerLinkCalendar.addEventListener('click', () => {
      el.reportViewOverlay.classList.remove('open');
      closeDrawer();
    });
    el.drawerLinkReport.addEventListener('click', () => {
      closeDrawer();
      renderReportTable();
      el.reportViewOverlay.classList.add('open');
    });

    // Profil Asistent
    el.drawerAssistantInput.addEventListener('change', () => {
      assistantName = el.drawerAssistantInput.value.trim() || 'Asistent Medical';
      saveStorage(STORAGE_KEYS.ASSISTANT, assistantName);
      if (el.reportAssistantName) el.reportAssistantName.textContent = assistantName;
      showToast('Nume salvat.');
    });

    // Adaugare medic / cabinet
    el.drawerBtnAddDoc.addEventListener('click', () => {
      const name = el.drawerNewDoctor.value.trim();
      if (name && !doctors.includes(name)) {
        doctors.push(name);
        saveStorage(STORAGE_KEYS.DOCTORS, doctors);
        populateSelectsAndLists();
        el.drawerNewDoctor.value = '';
        showToast(`Medic ${name} adăugat.`);
      }
    });

    el.drawerBtnAddCab.addEventListener('click', () => {
      const name = el.drawerNewCabinet.value.trim();
      if (name && !cabinets.includes(name)) {
        cabinets.push(name);
        saveStorage(STORAGE_KEYS.CABINETS, cabinets);
        populateSelectsAndLists();
        el.drawerNewCabinet.value = '';
        showToast(`Cabinet ${name} adăugat.`);
      }
    });

    // Toggle tip KPI (Volum / Durată)
    if (el.btnKpiTypeVolume && el.btnKpiTypeDuration) {
      el.btnKpiTypeVolume.addEventListener('click', () => {
        newKpiType = 'volume';
        el.btnKpiTypeVolume.classList.add('active');
        el.btnKpiTypeDuration.classList.remove('active');
      });
      el.btnKpiTypeDuration.addEventListener('click', () => {
        newKpiType = 'duration';
        el.btnKpiTypeDuration.classList.add('active');
        el.btnKpiTypeVolume.classList.remove('active');
      });
    }

    // Adăugare KPI
    if (el.drawerBtnAddKpi) {
      el.drawerBtnAddKpi.addEventListener('click', () => {
        const name = el.drawerNewKpiName.value.trim();
        if (!name) return;
        if (kpis.some(k => k.name.toLowerCase() === name.toLowerCase())) {
          showToast(`Activitatea "${name}" există deja.`);
          return;
        }
        const id = 'kpi_' + Date.now();
        kpis.push({ id, name, type: newKpiType });
        saveStorage(STORAGE_KEYS.KPIS, kpis);
        el.drawerNewKpiName.value = '';
        renderDrawerKpisList();
        renderDetailsKpiStrip();
        renderReportTable();
        showToast(`KPI "${name}" adăugat.`);
      });
    }

    if (el.drawerNewKpiName) {
      el.drawerNewKpiName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          el.drawerBtnAddKpi.click();
        }
      });
    }

    // Stergere
    el.drawerDoctorsList.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip-x');
      if (btn) {
        const idx = parseInt(btn.dataset.idx, 10);
        doctors.splice(idx, 1);
        saveStorage(STORAGE_KEYS.DOCTORS, doctors);
        populateSelectsAndLists();
      }
    });

    el.drawerCabinetsList.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip-x');
      if (btn) {
        const idx = parseInt(btn.dataset.idx, 10);
        cabinets.splice(idx, 1);
        saveStorage(STORAGE_KEYS.CABINETS, cabinets);
        populateSelectsAndLists();
      }
    });

    if (el.drawerKpisList) {
      el.drawerKpisList.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip-x');
        if (btn && btn.dataset.type === 'kpi') {
          const idx = parseInt(btn.dataset.idx, 10);
          kpis.splice(idx, 1);
          saveStorage(STORAGE_KEYS.KPIS, kpis);
          renderDrawerKpisList();
          renderDetailsKpiStrip();
          renderReportTable();
          showToast('KPI șters.');
        }
      });
    }

    // Date
    if (el.drawerBtnImportBackup && el.drawerFileImport) {
      el.drawerBtnImportBackup.addEventListener('click', () => {
        el.drawerFileImport.value = '';
        el.drawerFileImport.click();
      });

      el.drawerFileImport.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            if (data && typeof data === 'object') {
              if (data.shifts && typeof data.shifts === 'object') {
                shifts = data.shifts;
              } else if (!data.shifts && !data.doctors && !data.cabinets) {
                shifts = data;
              }
              saveStorage(STORAGE_KEYS.SHIFTS, shifts);

              if (Array.isArray(data.doctors)) {
                doctors = data.doctors;
                saveStorage(STORAGE_KEYS.DOCTORS, doctors);
              }
              if (Array.isArray(data.cabinets)) {
                cabinets = data.cabinets;
                saveStorage(STORAGE_KEYS.CABINETS, cabinets);
              }
              if (Array.isArray(data.kpis)) {
                kpis = data.kpis;
                saveStorage(STORAGE_KEYS.KPIS, kpis);
              }
              if (typeof data.assistantName === 'string') {
                assistantName = data.assistantName;
                saveStorage(STORAGE_KEYS.ASSISTANT, assistantName);
                if (el.drawerAssistantInput) el.drawerAssistantInput.value = assistantName;
              }

              populateSelectsAndLists();
              renderAmoledCalendar();
              updateBottomBarState();
              renderReportTable();
              closeDrawer();
              showToast('Date încărcate.');
            } else {
              showToast('Fișier invalid.');
            }
          } catch (err) {
            console.error('Import error:', err);
            showToast('Eroare la citirea fișierului.');
          }
        };
        reader.readAsText(file);
      });
    }

    if (el.drawerBtnExportBackup) {
      el.drawerBtnExportBackup.addEventListener('click', () => {
        const backup = { shifts, doctors, cabinets, assistantName, kpis };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Backup_Orar_${Date.now()}.json`;
        a.click();
        showToast('Date descărcate.');
      });
    }

    if (el.drawerBtnClear) {
      el.drawerBtnClear.addEventListener('click', () => {
        shifts = {};
        saveStorage(STORAGE_KEYS.SHIFTS, shifts);
        renderAmoledCalendar();
        updateBottomBarState();
        renderReportTable();
        closeDrawer();
        showToast('Toate datele au fost șterse.');
      });
    }
  }

  window.DentalApp = {
    edit: function (dateKey) {
      selectedDateKey = dateKey;
      openDetailsSheet(dateKey);
    },
    del: function (dateKey) {
      delete shifts[dateKey];
      saveStorage(STORAGE_KEYS.SHIFTS, shifts);
      renderAmoledCalendar();
      updateBottomBarState();
      renderReportTable();
      showToast('Tura ștearsă.');
    },
    uploadDay: async function (dateKey, btnEl) {
      if (!window.DentalSync || !window.DentalSync.isConnected()) {
        showToast('Conectează sincronizarea în meniu.');
        openDrawer();
        return;
      }
      const shift = shifts[dateKey];
      if (!shift) {
        showToast('Nicio tură salvată pentru această zi.');
        return;
      }
      if (btnEl) btnEl.classList.add('is-syncing');
      try {
        await window.DentalSync.uploadDay(dateKey, shift);
        showToast(`Ziua ${shift.displayDate || dateKey} încărcată.`);
      } catch (err) {
        showToast(err.message || 'Eroare la încărcare.');
      } finally {
        if (btnEl) btnEl.classList.remove('is-syncing');
      }
    },
    downloadDay: async function (dateKey, btnEl) {
      if (!window.DentalSync || !window.DentalSync.isConnected()) {
        showToast('Conectează sincronizarea în meniu.');
        openDrawer();
        return;
      }
      if (btnEl) btnEl.classList.add('is-syncing');
      try {
        const remoteShift = await window.DentalSync.downloadDay(dateKey);
        if (remoteShift) {
          shifts[dateKey] = remoteShift;
          saveStorage(STORAGE_KEYS.SHIFTS, shifts);
          renderAmoledCalendar();
          updateBottomBarState();
          renderReportTable();
          showToast(`Ziua ${remoteShift.displayDate || dateKey} descărcată.`);
        } else {
          showToast('Nicio dată în cloud pentru această zi.');
        }
      } catch (err) {
        showToast(err.message || 'Eroare la descărcare.');
      } finally {
        if (btnEl) btnEl.classList.remove('is-syncing');
      }
    },
    uploadAll: async function (btnEl) {
      if (!window.DentalSync || !window.DentalSync.isConnected()) {
        showToast('Conectează sincronizarea în meniu.');
        openDrawer();
        return;
      }
      if (btnEl) btnEl.classList.add('is-syncing');
      try {
        await window.DentalSync.uploadAll({
          shifts,
          doctors,
          cabinets,
          assistantName,
          kpis
        });
        showToast('Toate datele au fost încărcate.');
      } catch (err) {
        showToast(err.message || 'Eroare la încărcare.');
      } finally {
        if (btnEl) btnEl.classList.remove('is-syncing');
      }
    },
    downloadAll: async function (btnEl) {
      if (!window.DentalSync || !window.DentalSync.isConnected()) {
        showToast('Conectează sincronizarea în meniu.');
        openDrawer();
        return;
      }
      if (btnEl) btnEl.classList.add('is-syncing');
      try {
        const remoteData = await window.DentalSync.downloadAll();
        if (remoteData) {
          applyRemoteSync(remoteData);
          showToast('Toate datele au fost descărcate.');
        } else {
          showToast('Nicio dată salvată în cloud.');
        }
      } catch (err) {
        showToast(err.message || 'Eroare la descărcare.');
      } finally {
        if (btnEl) btnEl.classList.remove('is-syncing');
      }
    },
    calculateBonusHours,
    extractDurationMinutes,
    applyIntervalToKpi,
    applyDurationToKpi
  };

  document.addEventListener('DOMContentLoaded', init);

})();

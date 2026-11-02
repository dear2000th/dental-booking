/**
 * Dental Clinic Queue System - Main Application Logic
 * Interactive UI, Calendar, Slot Engine, Form Validation, and Staff Management
 */

// Application State
const state = {
  currentView: 'patient',
  activeStaffTab: 'queue',
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(), // 0 - 11
  selectedDateStr: null,
  selectedSlot: null,
  
  // Staff calendar state
  staffYear: new Date().getFullYear(),
  staffMonth: new Date().getMonth(),
  staffSelectedDateStr: null,

  // Staff appointment calendar state
  staffAptYear: new Date().getFullYear(),
  staffAptMonth: new Date().getMonth(),
  staffAptSelectedDateStr: null
};

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// Helper: Find first bookable date for patient (>= 5 days advance, open weekday with capacity)
function findFirstBookableDate() {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() + 5);
  for (let i = 0; i < 90; i++) {
    const dateStr = toDateString(d);
    const check = window.dentalStorage.isDateBookableForPatient(dateStr);
    if (check.isBookable) {
      return dateStr;
    }
    d.setDate(d.getDate() + 1);
  }
  return getMinBookingDateString(today);
}

function initApp() {
  // Set default selected date to the first valid bookable date (advance >= 5 days)
  const firstBookableDate = findFirstBookableDate();
  state.selectedDateStr = firstBookableDate;

  // Sync patient calendar view to the month of the first bookable date
  const parts = firstBookableDate.split('-');
  state.currentYear = parseInt(parts[0], 10);
  state.currentMonth = parseInt(parts[1], 10) - 1;

  // Staff date views default to today
  state.staffSelectedDateStr = getTodayString();
  state.staffAptSelectedDateStr = getTodayString();

  // Render initial views
  renderPatientCalendar();
  loadSlotsForSelectedDate();
  renderPatientSymptomChips();
  updateHeroStats();
  setupBroadcastListener();
  updateStaffCurrentDateTime();
  updateStaffTodayBadge();

  // If already logged in to staff portal
  if (window.dentalStorage.isStaffLoggedIn()) {
    updateStaffLoginLabels(true);
  } else {
    updateStaffLoginLabels(false);
  }
}

// Helper: Update staff navigation labels across desktop, mobile header, drawer & bottom nav
function updateStaffLoginLabels(isLoggedIn) {
  const staff = window.dentalStorage.getLoggedInStaff();
  const isAdmin = window.dentalStorage.isStaffAdmin();
  let labelText = 'ทันตาภิบาล';
  if (isLoggedIn && staff) {
    if (isAdmin) labelText = 'แดชบอร์ด Admin';
    else if (staff.roleType === 'booking_staff') labelText = 'แดชบอร์ดเจ้าหน้าที่';
    else labelText = 'แดชบอร์ดทันตาภิบาล';
  }

  const d1 = document.getElementById('staff-nav-label');
  if (d1) d1.textContent = labelText;

  const d2 = document.getElementById('m-hdr-staff-label');
  if (d2) d2.textContent = isLoggedIn ? 'แดชบอร์ด' : 'เจ้าหน้าที่';

  const d3 = document.getElementById('m-nav-staff-lbl');
  if (d3) d3.textContent = isLoggedIn ? 'แดชบอร์ด' : 'เจ้าหน้าที่';

  const d4 = document.getElementById('d-staff-nav-label');
  if (d4) {
    if (isLoggedIn && staff) {
      const rName = isAdmin ? 'Admin' : (staff.roleType === 'booking_staff' ? 'เจ้าหน้าที่จองคิว' : 'ทันตาภิบาล');
      d4.textContent = `เข้าสู่แดชบอร์ด (${rName})`;
    } else {
      d4.textContent = 'เข้าสู่ระบบเจ้าหน้าที่';
    }
  }
}

// Helper: Format Date object to YYYY-MM-DD
function toDateString(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Get Today's Date String
function getTodayString() {
  return toDateString(new Date());
}

/* ============================================================
   View Navigation
   ============================================================ */
function switchView(viewName) {
  state.currentView = viewName;
  
  // Hide all views
  document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.m-nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.m-hdr-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.drawer-nav-item').forEach(b => b.classList.remove('active'));

  const viewEl = document.getElementById(`view-${viewName}`);
  if (viewEl) viewEl.classList.add('active');

  // Update nav buttons across Desktop, Mobile Header, Mobile Bottom Nav, and Drawer
  if (viewName === 'patient') {
    document.getElementById('nav-patient-btn')?.classList.add('active');
    document.getElementById('m-nav-book')?.classList.add('active');
    document.getElementById('d-nav-patient')?.classList.add('active');
  } else if (viewName === 'check-status') {
    document.getElementById('nav-check-btn')?.classList.add('active');
    document.getElementById('m-nav-check')?.classList.add('active');
    document.getElementById('m-hdr-check-btn')?.classList.add('active');
    document.getElementById('d-nav-check')?.classList.add('active');
  } else if (viewName === 'staff') {
    document.getElementById('nav-staff-btn')?.classList.add('active');
    document.getElementById('m-nav-staff')?.classList.add('active');
    document.getElementById('m-hdr-staff-btn')?.classList.add('active');
    document.getElementById('d-nav-staff')?.classList.add('active');
    renderStaffDashboard();
  }

  // Ensure mobile drawer is closed on view switch
  toggleMobileDrawer(true);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   Mobile Drawer Controller
   ============================================================ */
function toggleMobileDrawer(forceClose = false) {
  const drawer = document.getElementById('mobile-drawer');
  const backdrop = document.getElementById('mobile-drawer-backdrop');
  if (!drawer || !backdrop) return;

  if (forceClose || drawer.classList.contains('show')) {
    drawer.classList.remove('show');
    backdrop.classList.remove('show');
    document.body.style.overflow = '';
  } else {
    drawer.classList.add('show');
    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function openStaffModal() {
  if (window.dentalStorage.isStaffLoggedIn()) {
    switchView('staff');
  } else {
    // Clear credentials for maximum security
    const uInput = document.getElementById('staff-username');
    const pInput = document.getElementById('staff-password');
    if (uInput) uInput.value = '';
    if (pInput) pInput.value = '';
    
    // Reset password visibility
    if (pInput) pInput.type = 'password';
    const pwBtn = document.getElementById('btn-toggle-password');
    if (pwBtn) pwBtn.textContent = '👁️';

    // Check lockout status
    const lockout = window.dentalStorage.getLoginLockoutStatus();
    const banner = document.getElementById('staff-lockout-banner');
    const errEl = document.getElementById('staff-login-error');
    if (errEl) errEl.style.display = 'none';

    if (banner) {
      if (lockout.isLocked) {
        banner.style.display = 'flex';
        document.getElementById('staff-lockout-msg').textContent = `ระงับการเข้าสู่ระบบชั่วคราวเพื่อความปลอดภัย กรุณารออีก ${lockout.remainingSec} วินาที`;
        document.getElementById('btn-staff-login-submit').disabled = true;
      } else {
        banner.style.display = 'none';
        document.getElementById('btn-staff-login-submit').disabled = false;
      }
    }

    document.getElementById('modal-staff-login').classList.add('show');
    if (uInput && !lockout.isLocked) setTimeout(() => uInput.focus(), 100);
  }
}

function closeStaffModal() {
  document.getElementById('modal-staff-login').classList.remove('show');
}

function togglePasswordVisibility() {
  const pInput = document.getElementById('staff-password');
  const btn = document.getElementById('btn-toggle-password');
  if (!pInput || !btn) return;
  if (pInput.type === 'password') {
    pInput.type = 'text';
    btn.textContent = '🙈';
    btn.title = 'ซ่อนรหัสผ่าน';
  } else {
    pInput.type = 'password';
    btn.textContent = '👁️';
    btn.title = 'แสดงรหัสผ่าน';
  }
}

/* ============================================================
   Patient Calendar & Slot Logic
   ============================================================ */
function renderPatientCalendar() {
  const monthLabel = document.getElementById('cal-month-label');
  const daysGrid = document.getElementById('cal-days-grid');
  if (!monthLabel || !daysGrid) return;

  const thaiYear = state.currentYear + 543;
  monthLabel.textContent = `${THAI_MONTHS[state.currentMonth]} ${thaiYear}`;

  daysGrid.innerHTML = '';

  const firstDayIndex = new Date(state.currentYear, state.currentMonth, 1).getDay();
  const totalDaysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(state.currentYear, state.currentMonth, 0).getDate();

  const todayStr = getTodayString();

  // Prev month leading cells
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.innerHTML = `<span class="day-num">${dayNum}</span>`;
    daysGrid.appendChild(cell);
  }

  // Current month day cells
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateObj = new Date(state.currentYear, state.currentMonth, day);
    const dateStr = toDateString(dateObj);
    const bookCheck = window.dentalStorage.isDateBookableForPatient(dateStr);
    const isPast = dateStr < todayStr;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === state.selectedDateStr;

    const cell = document.createElement('div');
    cell.className = 'cal-day-cell';
    if (isToday) cell.classList.add('is-today');

    if (isPast) {
      cell.classList.add('past-day');
      cell.title = 'ไม่สามารถจองคิวย้อนหลังได้';
      cell.innerHTML = `
        <span class="day-num">${day}</span>
        <span class="slot-badge"><span class="badge-full">ผ่านมาแล้ว</span><span class="badge-short">-</span></span>
      `;
      cell.onclick = () => {
        showToast('ไม่สามารถจองคิวย้อนหลังได้ครับ', 'warning');
      };
    } else if (bookCheck.code === 'TOO_SOON') {
      cell.classList.add('too-soon-day');
      cell.title = bookCheck.reason;
      cell.innerHTML = `
        <span class="day-num">${day}</span>
        <span class="slot-badge"><span class="badge-full">&lt;5 วัน</span><span class="badge-short">&lt;5ว</span></span>
      `;
      cell.onclick = () => {
        showToast(bookCheck.reason, 'warning');
      };
    } else if (bookCheck.code === 'CLOSED') {
      if (bookCheck.isPublicHoliday) {
        cell.classList.add('status-holiday');
        cell.title = bookCheck.reason;
        cell.innerHTML = `
          <span class="day-num">${day}</span>
          <span class="slot-badge holiday-badge"><span class="badge-full">หยุดราชการ</span><span class="badge-short">หยุด</span></span>
        `;
      } else {
        cell.classList.add('status-closed');
        cell.title = bookCheck.reason;
        cell.innerHTML = `
          <span class="day-num">${day}</span>
          <span class="slot-badge"><span class="badge-full">ปิดทำการ</span><span class="badge-short">ปิด</span></span>
        `;
      }
      cell.onclick = () => {
        showToast(`วันที่ ${formatThaiDate(dateStr)}: ${bookCheck.reason}`, 'warning');
      };
    } else if (bookCheck.code === 'NO_SLOTS') {
      cell.classList.add('status-no-slots');
      cell.title = bookCheck.reason;
      cell.innerHTML = `
        <span class="day-num">${day}</span>
        <span class="slot-badge"><span class="badge-full">ยังไม่เปิดรอบ</span><span class="badge-short">ไม่เปิด</span></span>
      `;
      cell.onclick = () => {
        showToast(`วันที่ ${formatThaiDate(dateStr)}: ${bookCheck.reason}`, 'warning');
      };
    } else if (bookCheck.code === 'FULL') {
      cell.classList.add('status-full');
      cell.title = bookCheck.reason;
      cell.innerHTML = `
        <span class="day-num">${day}</span>
        <span class="slot-badge"><span class="badge-full">คิวเต็ม</span><span class="badge-short">เต็ม</span></span>
      `;
      cell.onclick = () => {
        showToast(`วันที่ ${formatThaiDate(dateStr)} คิวเต็มทุกช่วงเวลาแล้ว`, 'warning');
      };
    } else {
      // OPEN & Bookable
      cell.classList.add('status-open');
      cell.title = `เปิดรับจอง (ว่าง ${bookCheck.availableCount} คิว)`;
      cell.innerHTML = `
        <span class="day-num">${day}</span>
        <span class="slot-badge"><span class="badge-full">ว่าง ${bookCheck.availableCount}</span><span class="badge-short">${bookCheck.availableCount}คิว</span></span>
      `;
      cell.onclick = () => selectBookingDate(dateStr);
    }

    if (isSelected && bookCheck.isBookable) {
      cell.classList.add('selected');
    }

    daysGrid.appendChild(cell);
  }
}

function prevMonth() {
  state.currentMonth--;
  if (state.currentMonth < 0) {
    state.currentMonth = 11;
    state.currentYear--;
  }
  renderPatientCalendar();
}

function nextMonth() {
  state.currentMonth++;
  if (state.currentMonth > 11) {
    state.currentMonth = 0;
    state.currentYear++;
  }
  renderPatientCalendar();
}

function selectBookingDate(dateStr) {
  const bookCheck = window.dentalStorage.isDateBookableForPatient(dateStr);
  if (!bookCheck.isBookable) {
    showToast(bookCheck.reason, 'warning');
    return;
  }
  state.selectedDateStr = dateStr;
  state.selectedSlot = null; // reset slot selection
  renderPatientCalendar();
  loadSlotsForSelectedDate();
  updateSummaryBar();
}

function loadSlotsForSelectedDate() {
  const label = document.getElementById('selected-date-label');
  const countBadge = document.getElementById('slots-count-badge');
  const listEl = document.getElementById('slots-list');

  if (!state.selectedDateStr) {
    label.textContent = '-';
    countBadge.textContent = 'กรุณาเลือกวัน';
    listEl.innerHTML = '<div class="empty-hint">กรุณาคลิกเลือกวันที่เปิดให้บริการจากปฏิทิน (ต้องล่วงหน้าอย่างน้อย 5 วัน)</div>';
    return;
  }

  const bookCheck = window.dentalStorage.isDateBookableForPatient(state.selectedDateStr);
  label.textContent = formatThaiDate(state.selectedDateStr);

  if (!bookCheck.isBookable) {
    countBadge.textContent = 'ไม่สามารถจองได้';
    listEl.innerHTML = `
      <div class="empty-hint warning-box" style="padding: 1.5rem; text-align: center; color: #b91c1c; background: #fef2f2; border: 1px dashed #fca5a5; border-radius: 8px;">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
        <div style="font-weight: 600; margin-bottom: 0.25rem;">ไม่สามารถจองคิวในวันที่เลือกได้</div>
        <div style="font-size: 0.88rem; color: #7f1d1d;">${escapeHtml(bookCheck.reason)}</div>
      </div>
    `;
    return;
  }

  const slots = window.dentalStorage.getSlotsForDate(state.selectedDateStr);

  if (slots.length === 0) {
    countBadge.textContent = 'ไม่มีรอบเวลา';
    listEl.innerHTML = '<div class="empty-hint">วันนี้ไม่มีรอบเวลาเปิดให้บริการ</div>';
    return;
  }

  const availableSlots = slots.filter(s => !s.isFull).length;
  countBadge.textContent = `ว่าง ${availableSlots} จาก ${slots.length} รอบ`;

  listEl.innerHTML = '';
  slots.forEach(slot => {
    const card = document.createElement('div');
    card.className = `slot-card ${slot.isFull ? 'disabled' : ''}`;
    if (state.selectedSlot && state.selectedSlot.id === slot.id) {
      card.classList.add('selected');
    }

    card.innerHTML = `
      <div class="slot-time">${slot.start} - ${slot.end}</div>
      <div class="slot-seats">${slot.isFull ? 'เต็มแล้ว (0 คิว)' : `ว่าง ${slot.remaining} จาก ${slot.capacity} คิว`}</div>
    `;

    if (!slot.isFull) {
      card.onclick = () => selectSlot(slot);
    }

    listEl.appendChild(card);
  });
}

function selectSlot(slot) {
  state.selectedSlot = slot;
  
  // Update slot cards UI
  document.querySelectorAll('#slots-list .slot-card').forEach(c => c.classList.remove('selected'));
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('selected');
  } else {
    loadSlotsForSelectedDate();
  }

  updateSummaryBar();
  showToast(`เลือกรอบเวลา ${slot.start} - ${slot.end} น. เรียบร้อย`, 'success');
}

function updateSummaryBar() {
  const sumBar = document.getElementById('selected-summary-bar');
  if (!sumBar) return;

  if (state.selectedDateStr && state.selectedSlot) {
    sumBar.classList.add('has-selection');
    sumBar.innerHTML = `
      <div class="sum-icon">✅</div>
      <div class="sum-details">
        <div class="sum-title">นัดหมาย: ${formatThaiDate(state.selectedDateStr)} เวลา ${state.selectedSlot.start} - ${state.selectedSlot.end} น.</div>
        <div class="sum-sub">กรอกข้อมูลผู้รับบริการด้านล่างแล้วกด "ยืนยันการจองคิว"</div>
      </div>
    `;
  } else if (state.selectedDateStr) {
    sumBar.classList.remove('has-selection');
    sumBar.innerHTML = `
      <div class="sum-icon">⏰</div>
      <div class="sum-details">
        <div class="sum-title">วันที่เลือก: ${formatThaiDate(state.selectedDateStr)}</div>
        <div class="sum-sub">กรุณาเลือกรอบเวลาบริการด้านบน</div>
      </div>
    `;
  } else {
    sumBar.classList.remove('has-selection');
    sumBar.innerHTML = `
      <div class="sum-icon">⏰</div>
      <div class="sum-details">
        <div class="sum-title">ยังไม่ได้เลือกรอบเวลา</div>
        <div class="sum-sub">กรุณาเลือกวันที่และรอบเวลาจากขั้นตอนที่ 1</div>
      </div>
    `;
  }
}

// Render dynamic patient symptom chips
function renderPatientSymptomChips() {
  const container = document.getElementById('patient-symptom-chips');
  if (!container) return;

  const services = window.dentalStorage.getServices();
  const textarea = document.getElementById('p-symptoms');
  const currentVal = textarea ? textarea.value : '';

  container.innerHTML = services.map(s => {
    const isSelected = currentVal && currentVal.includes(s.title);
    return `<button type="button" class="chip ${isSelected ? 'active' : ''}" onclick="selectChip(this, '${escapeHtml(s.title)}')">${escapeHtml(s.title)}</button>`;
  }).join('');
}

// Symptom quick chips selection
function selectChip(btn, text) {
  const textarea = document.getElementById('p-symptoms');
  if (!textarea) return;
  btn.classList.toggle('active');

  const currentVal = textarea.value.trim();
  if (btn.classList.contains('active')) {
    if (!currentVal) {
      textarea.value = text;
    } else if (!currentVal.includes(text)) {
      textarea.value = `${currentVal}, ${text}`;
    }
  } else {
    let updated = currentVal.replace(text, '').trim();
    updated = updated.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ', ').trim();
    textarea.value = updated;
  }
}

// Staff Service Management Controller
function renderStaffServicesList() {
  const container = document.getElementById('staff-services-list');
  if (!container) return;

  const services = window.dentalStorage.getServices();
  if (!services || services.length === 0) {
    container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">ยังไม่มีปุ่มบริการ กรุณาพิมพ์ชื่อบริการแล้วกดเพิ่มด้านบน</span>`;
    return;
  }

  container.innerHTML = services.map(s => `
    <div class="staff-service-tag">
      <span>${escapeHtml(s.title)}</span>
      <button type="button" class="btn-delete-service" onclick="handleDeleteService('${escapeHtml(s.id)}')" title="ลบปุ่มบริการนี้">✕</button>
    </div>
  `).join('');
}

function handleAddServiceSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('new-service-title');
  if (!input) return;
  const title = input.value.trim();
  if (!title) return;

  const res = window.dentalStorage.addService(title);
  if (res.success) {
    input.value = '';
    renderStaffServicesList();
    renderPatientSymptomChips();
    showToast(`เพิ่มปุ่มบริการ "${title}" เรียบร้อยแล้ว`, 'success');
  } else {
    alert(res.error || 'ไม่สามารถเพิ่มบริการได้');
  }
}

function handleDeleteService(serviceId) {
  if (!confirm('ต้องการลบปุ่มบริการนี้ใช่หรือไม่? ผู้ป่วยจะไม่เห็นปุ่มนี้ในหน้าจองคิว')) {
    return;
  }
  const res = window.dentalStorage.deleteService(serviceId);
  if (res.success) {
    renderStaffServicesList();
    renderPatientSymptomChips();
    showToast('ลบปุ่มบริการเรียบร้อยแล้ว', 'info');
  } else {
    alert(res.error || 'ไม่สามารถลบบริการได้');
  }
}

function handleResetServices() {
  if (!confirm('ยืนยันคืนค่าปุ่มบริการเป็นค่าเริ่มต้นของคลินิกทันตกรรมหรือไม่?')) {
    return;
  }
  const res = window.dentalStorage.resetServicesToDefault();
  if (res.success) {
    renderStaffServicesList();
    renderPatientSymptomChips();
    showToast('คืนค่าปุ่มบริการเริ่มต้นสำเร็จ', 'success');
  }
}

// Citizen ID live formatting / check
function validateCitizenIdInput(input) {
  input.value = input.value.replace(/[^0-9]/g, '');
  const errEl = document.getElementById('err-p-citizen-id');
  if (input.value.length === 13) {
    if (isValidThaiCitizenId(input.value)) {
      errEl.classList.remove('show');
      input.classList.remove('is-invalid');
    } else {
      errEl.textContent = 'เลขบัตรประชาชน 13 หลักไม่ถูกต้อง (รหัสตรวจสอบไม่ผ่าน)';
      errEl.classList.add('show');
      input.classList.add('is-invalid');
    }
  } else {
    errEl.textContent = 'กรุณาระบุเลขบัตรประชาชนให้ครบ 13 หลัก';
    if (input.value.length > 0) {
      errEl.classList.add('show');
      input.classList.add('is-invalid');
    } else {
      errEl.classList.remove('show');
      input.classList.remove('is-invalid');
    }
  }
}

/* ============================================================
   Patient Booking Form Submission
   ============================================================ */
function handleBookingSubmit(event) {
  event.preventDefault();

  // Validate slot selection
  if (!state.selectedDateStr || !state.selectedSlot) {
    showToast('กรุณาเลือกวันที่และรอบเวลารับบริการในขั้นตอนที่ 1 ก่อนครับ', 'error');
    document.querySelector('.booking-calendar-card').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // Check if date is eligible for patient booking (locking past, <5 days, holiday, slot capacity)
  const bookCheck = window.dentalStorage.isDateBookableForPatient(state.selectedDateStr);
  if (!bookCheck.isBookable) {
    showToast(`ขออภัย ${bookCheck.reason}`, 'error');
    renderPatientCalendar();
    loadSlotsForSelectedDate();
    return;
  }

  const nameInput = document.getElementById('p-name');
  const citizenInput = document.getElementById('p-citizen-id');
  const phoneInput = document.getElementById('p-phone');
  const symptomsInput = document.getElementById('p-symptoms');
  const medicalNotesInput = document.getElementById('p-medical-notes');

  let hasError = false;

  // Validate Name
  if (!nameInput.value.trim() || nameInput.value.trim().length < 3) {
    document.getElementById('err-p-name').classList.add('show');
    nameInput.classList.add('is-invalid');
    hasError = true;
  } else {
    document.getElementById('err-p-name').classList.remove('show');
    nameInput.classList.remove('is-invalid');
  }

  // Validate Citizen ID
  const cleanCId = citizenInput.value.replace(/[^0-9]/g, '');
  if (!isValidThaiCitizenId(cleanCId)) {
    document.getElementById('err-p-citizen-id').classList.add('show');
    citizenInput.classList.add('is-invalid');
    hasError = true;
  } else {
    document.getElementById('err-p-citizen-id').classList.remove('show');
    citizenInput.classList.remove('is-invalid');
  }

  // Validate Phone
  const cleanPhone = phoneInput.value.replace(/[^0-9]/g, '');
  if (!cleanPhone || cleanPhone.length !== 10 || !cleanPhone.startsWith('0')) {
    document.getElementById('err-p-phone').classList.add('show');
    phoneInput.classList.add('is-invalid');
    hasError = true;
  } else {
    document.getElementById('err-p-phone').classList.remove('show');
    phoneInput.classList.remove('is-invalid');
  }

  // Validate Symptoms
  if (!symptomsInput.value.trim()) {
    document.getElementById('err-p-symptoms').classList.add('show');
    symptomsInput.classList.add('is-invalid');
    hasError = true;
  } else {
    document.getElementById('err-p-symptoms').classList.remove('show');
    symptomsInput.classList.remove('is-invalid');
  }

  if (hasError) {
    showToast('กรุณากรอกข้อมูลให้ครบถ้วนถูกต้อง', 'error');
    return;
  }

  // Create Appointment
  let newAppointment;
  try {
    newAppointment = window.dentalStorage.createAppointment({
      date: state.selectedDateStr,
      slotId: state.selectedSlot.id,
      slotTime: `${state.selectedSlot.start} - ${state.selectedSlot.end}`,
      patientName: nameInput.value,
      citizenId: cleanCId,
      phone: cleanPhone,
      symptoms: symptomsInput.value,
      medicalNotes: medicalNotesInput.value
    });
  } catch (err) {
    showToast(err.message || 'ไม่สามารถทำการจองได้', 'error');
    renderPatientCalendar();
    loadSlotsForSelectedDate();
    return;
  }

  // Reset form
  document.getElementById('booking-form').reset();
  document.querySelectorAll('.symptom-chips .chip').forEach(c => c.classList.remove('active'));
  state.selectedSlot = null;

  // Refresh calendar & slots
  renderPatientCalendar();
  loadSlotsForSelectedDate();
  updateSummaryBar();
  updateHeroStats();

  // Show Success Slip
  showSuccessModal(newAppointment);
}

function showSuccessModal(apt) {
  const modal = document.getElementById('modal-booking-success');
  const content = document.getElementById('slip-content');

  const maskedCId = apt.citizenId.substring(0, 3) + '-XXXXX-' + apt.citizenId.substring(8);

  content.innerHTML = `
    <div class="slip-ref-box">
      <div class="lbl">รหัสคิวนัดหมายของคุณ</div>
      <div class="code">${apt.id}</div>
    </div>
    <table class="slip-details-table">
      <tr>
        <td>วันที่นัดหมาย</td>
        <td>${formatThaiDate(apt.date)}</td>
      </tr>
      <tr>
        <td>ช่วงเวลาที่นัด</td>
        <td>${apt.slotTime} น.</td>
      </tr>
      <tr>
        <td>ชื่อ - สกุล</td>
        <td>${escapeHtml(apt.patientName)}</td>
      </tr>
      <tr>
        <td>เลขบัตรประชาชน</td>
        <td>${maskedCId}</td>
      </tr>
      <tr>
        <td>เบอร์โทรศัพท์</td>
        <td>${escapeHtml(apt.phone)}</td>
      </tr>
      <tr>
        <td>อาการที่แจ้ง</td>
        <td>${escapeHtml(apt.symptoms)}</td>
      </tr>
      <tr>
        <td>สถานะคิว</td>
        <td><span class="status-pill badge-pending">⏳ รอยืนยันจากทันตาภิบาล</span></td>
      </tr>
    </table>
    <div style="margin-top:1.25rem; font-size:0.8rem; color:#64748b; background:#f8fafc; padding:0.75rem; border-radius:8px;">
      📌 <strong>คำแนะนำ:</strong> ทันตาภิบาลจะตรวจสอบคิวและตอบกลับการนัดหมาย ท่านสามารถเข้ามาตรวจสอบสถานะได้ตลอดเวลาผ่านเมนู <strong>"ตรวจสอบคิว"</strong> โดยใช้เลขบัตรประชาชนหรือเบอร์โทรศัพท์
    </div>
  `;

  modal.classList.add('show');
  window.currentBookingSlip = apt;
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch (e) {}
  document.body.removeChild(ta);
}

function copySlipToClipboard() {
  const apt = window.currentBookingSlip;
  if (!apt) return;

  const text = `🦷 บัตรนัดคิวทันตกรรมออนไลน์\n` +
    `--------------------------------\n` +
    `รหัสคิว: ${apt.id}\n` +
    `วันที่นัด: ${formatThaiDate(apt.date)}\n` +
    `ช่วงเวลา: ${apt.slotTime} น.\n` +
    `ผู้รับบริการ: ${apt.patientName}\n` +
    `อาการที่แจ้ง: ${apt.symptoms}\n` +
    `สถานะ: ⏳ รอยืนยันจากทันตาภิบาล\n` +
    `--------------------------------\n` +
    `กรุณามาก่อนเวลานัด 15 นาที และนำบัตรประชาชนตัวจริงมาด้วยครับ/ค่ะ`;

  copyToClipboard(text);
  showToast('คัดลอกข้อมูลบัตรนัดคิวเรียบร้อยแล้ว', 'success');
}

function closeSuccessModal() {
  document.getElementById('modal-booking-success').classList.remove('show');
  switchView('check-status');
}

/* ============================================================
   Check Queue Status Logic
   ============================================================ */
function handleSearchQueue(event) {
  event.preventDefault();
  const query = document.getElementById('search-query').value.trim();
  if (!query) {
    showToast('กรุณากรอกเลขบัตรประชาชน หรือเบอร์โทรศัพท์', 'error');
    return;
  }

  const results = window.dentalStorage.searchAppointments(query);
  const container = document.getElementById('search-results-list');

  if (results.length === 0) {
    container.innerHTML = `
      <div class="card text-center" style="padding:2.5rem 1rem;">
        <div style="font-size:2.5rem; margin-bottom:0.5rem;">📂</div>
        <h3>ไม่พบข้อมูลการนัดหมาย</h3>
        <p style="color:#64748b;">ไม่พบคิวที่ตรงกับ "${escapeHtml(query)}" กรุณาตรวจสอบเลขบัตรประชาชน หรือเบอร์โทรศัพท์อีกครั้ง</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="font-size:0.9rem; color:#64748b; margin-bottom:0.5rem;">
      พบการนัดหมายจำนวน <strong>${results.length}</strong> รายการ:
    </div>
  `;

  results.forEach(apt => {
    const card = document.createElement('div');
    card.className = 'patient-queue-card';

    let badgeClass = 'badge-pending';
    let statusText = '⏳ รอยืนยันจากทันตาภิบาล';
    if (apt.status === 'CONFIRMED') {
      badgeClass = 'badge-confirmed';
      statusText = '✅ ทันตาภิบาลยืนยันนัดหมายแล้ว';
    } else if (apt.status === 'RESCHEDULED') {
      badgeClass = 'badge-rescheduled';
      statusText = '⏳ ขอเสนอเลื่อนเวลานัด';
    } else if (apt.status === 'COMPLETED') {
      badgeClass = 'badge-completed';
      statusText = '🎉 รับการตรวจเสร็จสิ้นแล้ว';
    } else if (apt.status === 'CANCELLED') {
      badgeClass = 'badge-cancelled';
      statusText = '❌ ยกเลิกการนัดหมาย';
    }

    const maskedCId = apt.citizenId.substring(0, 3) + '-XXXXX-' + apt.citizenId.substring(8);

    // Build reply box if reply exists
    let replyHtml = '';
    if (apt.reply && apt.reply.message) {
      let replyBoxClass = 'pq-reply-box';
      if (apt.status === 'RESCHEDULED') replyBoxClass += ' rescheduled';
      if (apt.status === 'CANCELLED') replyBoxClass += ' cancelled';

      const replyDate = new Date(apt.reply.repliedAt);
      const replyDateStr = `${replyDate.toLocaleDateString('th-TH')} เวลา ${replyDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;

      replyHtml = `
        <div class="${replyBoxClass}">
          <div class="reply-badge">
            <span>💬 ข้อความตอบกลับจากทันตาภิบาล:</span>
          </div>
          <div class="reply-content">
            ${escapeHtml(apt.reply.message)}
          </div>
          <div class="reply-meta">
            ตอบกลับโดย: <strong>${escapeHtml(apt.reply.repliedBy)}</strong> • ${replyDateStr}
          </div>
        </div>
      `;
    } else {
      replyHtml = `
        <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; padding:0.85rem; font-size:0.85rem; color:#64748b; margin-top:1rem;">
          ⏳ <em>ยังไม่มีข้อความตอบกลับจากทันตาภิบาล อยู่ระหว่างการตรวจทานคิว</em>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="pq-header">
        <div class="pq-code">${apt.id}</div>
        <span class="status-pill ${badgeClass}">${statusText}</span>
      </div>
      <div class="pq-body">
        <div class="pq-grid">
          <div>
            <span class="pq-label">วันเวลานัดหมาย</span>
            <span class="pq-val">${formatThaiDate(apt.date)} (${apt.slotTime} น.)</span>
          </div>
          <div>
            <span class="pq-label">ชื่อ - สกุล ผู้รับบริการ</span>
            <span class="pq-val">${escapeHtml(apt.patientName)}</span>
          </div>
          <div>
            <span class="pq-label">เลขประจำตัวประชาชน</span>
            <span class="pq-val">${maskedCId}</span>
          </div>
          <div>
            <span class="pq-label">เบอร์โทรศัพท์</span>
            <span class="pq-val">${escapeHtml(apt.phone)}</span>
          </div>
        </div>

        <div style="background:#f1f5f9; padding:0.75rem 1rem; border-radius:6px; font-size:0.88rem; margin-bottom:0.5rem;">
          <strong style="color:#334155;">อาการเบื้องต้นที่แจ้ง:</strong> ${escapeHtml(apt.symptoms)}
          ${apt.medicalNotes ? `<br><span style="color:#b91c1c; font-size:0.8rem;">⚠️ โรคประจำตัว/แพ้ยา: ${escapeHtml(apt.medicalNotes)}</span>` : ''}
        </div>

        ${replyHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

/* ============================================================
   Staff Authentication Logic
   ============================================================ */
function handleStaffLogin(event) {
  event.preventDefault();
  const u = document.getElementById('staff-username').value.trim();
  const p = document.getElementById('staff-password').value.trim();
  const errEl = document.getElementById('staff-login-error');
  const errText = document.getElementById('staff-login-error-text');
  const banner = document.getElementById('staff-lockout-banner');

  const lockoutBefore = window.dentalStorage.getLoginLockoutStatus();
  if (lockoutBefore.isLocked) {
    if (banner) {
      banner.style.display = 'flex';
      document.getElementById('staff-lockout-msg').textContent = `ระงับการเข้าสู่ระบบชั่วคราวเพื่อความปลอดภัย กรุณารออีก ${lockoutBefore.remainingSec} วินาที`;
    }
    return;
  }

  const success = window.dentalStorage.loginStaff(u, p);
  if (success) {
    if (errEl) errEl.style.display = 'none';
    if (banner) banner.style.display = 'none';
    closeStaffModal();
    
    // Clear inputs immediately
    document.getElementById('staff-username').value = '';
    document.getElementById('staff-password').value = '';

    const staff = window.dentalStorage.getLoggedInStaff();
    const displayName = (staff && staff.name) ? staff.name : 'ทันตาภิบาลผู้ดูแลระบบ';
    updateStaffLoginLabels(true);
    const staffNameEl = document.getElementById('staff-name-display');
    if (staffNameEl) staffNameEl.textContent = displayName;

    showToast(`เข้าสู่ระบบสำเร็จ: ยินดีต้อนรับ ${displayName}`, 'success');
    switchView('staff');
  } else {
    const lockoutAfter = window.dentalStorage.getLoginLockoutStatus();
    if (lockoutAfter.isLocked) {
      if (banner) {
        banner.style.display = 'flex';
        document.getElementById('staff-lockout-msg').textContent = `ระบุรหัสผ่านผิดเกิน 5 ครั้ง ระบบถูกระงับชั่วคราว 5 นาทีเพื่อความปลอดภัย`;
      }
      if (errEl) errEl.style.display = 'none';
      const submitBtn = document.getElementById('btn-staff-login-submit');
      if (submitBtn) submitBtn.disabled = true;
    } else {
      if (errEl) errEl.style.display = 'flex';
      if (errText) errText.textContent = `ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง (ลองผิดแล้ว ${lockoutAfter.failedCount}/5 ครั้ง)`;
    }
  }
}

function openChangePasswordModal() {
  const staff = window.dentalStorage.getLoggedInStaff();
  if (!staff) {
    showToast('กรุณาเข้าสู่ระบบก่อนเปลี่ยนรหัสผ่าน', 'warning');
    return;
  }
  document.getElementById('cp-old-password').value = '';
  document.getElementById('cp-new-password').value = '';
  document.getElementById('cp-confirm-password').value = '';
  const errBox = document.getElementById('cp-error-box');
  if (errBox) errBox.style.display = 'none';
  document.getElementById('modal-change-password').classList.add('show');
}

function closeChangePasswordModal() {
  document.getElementById('modal-change-password').classList.remove('show');
}

function handleChangePasswordSubmit(event) {
  event.preventDefault();
  const staff = window.dentalStorage.getLoggedInStaff();
  if (!staff) return;

  const oldP = document.getElementById('cp-old-password').value;
  const newP = document.getElementById('cp-new-password').value;
  const confirmP = document.getElementById('cp-confirm-password').value;
  const errBox = document.getElementById('cp-error-box');

  if (newP !== confirmP) {
    errBox.style.display = 'block';
    errBox.textContent = 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน';
    return;
  }

  const result = window.dentalStorage.changeStaffPassword(staff.username, oldP, newP);
  if (result.success) {
    closeChangePasswordModal();
    showToast('เปลี่ยนรหัสผ่านสำเร็จเรียบร้อย', 'success');
  } else {
    errBox.style.display = 'block';
    errBox.textContent = result.error || 'ไม่สามารถเปลี่ยนรหัสผ่านได้';
  }
}

function logoutStaff() {
  window.dentalStorage.logoutStaff();
  updateStaffLoginLabels(false);
  showToast('ออกจากระบบเรียบร้อย', 'info');
  switchView('patient');
}

/* ============================================================
   Staff Portal Management (Queue, Schedule & Statistics)
   ============================================================ */
function renderStaffDashboard() {
  const staff = window.dentalStorage.getLoggedInStaff();
  const isAdmin = window.dentalStorage.isStaffAdmin();

  // Update staff profile name & role badge in dashboard header
  const staffNameEl = document.getElementById('staff-name-display');
  if (staffNameEl && staff && staff.name) {
    staffNameEl.textContent = staff.name;
  }

  const roleBadge = document.getElementById('staff-role-badge');
  if (roleBadge) {
    if (isAdmin) {
      roleBadge.textContent = '👑 ผู้ดูแลระบบ (Admin)';
      roleBadge.className = 'staff-badge badge-admin-role';
    } else {
      roleBadge.textContent = '🩺 ' + ((staff && staff.role) || 'ทันตาภิบาลปฏิบัติการ');
      roleBadge.className = 'staff-badge badge-nurse-role';
    }
  }

  // Toggle visibility of Admin User Management Tab button
  const userTabBtn = document.getElementById('tab-btn-users');
  if (userTabBtn) {
    userTabBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  }

  updateStaffCurrentDateTime();
  renderStaffQueueTable();
  renderStaffAppointmentCalendar();
  renderStaffAppointmentAgenda();
  renderStaffCalendar();
  loadStaffSlotManagement();
  renderStaffStats();
  updateStaffTodayBadge();

  if (isAdmin) {
    renderAdminUsersTab();
  }
}

function switchStaffTab(tabName) {
  state.activeStaffTab = tabName;
  document.querySelectorAll('.staff-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.staff-tab-content').forEach(c => c.classList.remove('active'));

  const tabBtn = document.getElementById(`tab-btn-${tabName}`);
  const tabContent = document.getElementById(`staff-tab-${tabName}`);
  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');

  if (tabName === 'queue') renderStaffQueueTable();
  if (tabName === 'calendar') {
    renderStaffAppointmentCalendar();
    renderStaffAppointmentAgenda();
  }
  if (tabName === 'schedule') {
    renderStaffCalendar();
    loadStaffSlotManagement();
  }
  if (tabName === 'stats') renderStaffStats();
  if (tabName === 'users') renderAdminUsersTab();
}

function updateStaffCurrentDateTime() {
  const dtEl = document.getElementById('staff-current-datetime');
  if (dtEl) {
    const now = new Date();
    dtEl.textContent = `${formatThaiDate(toDateString(now))} ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
  }
}

/* Staff Tab 1: Queue Table & Reply System */
function renderStaffQueueTable() {
  const tbody = document.getElementById('staff-queue-tbody');
  const emptyState = document.getElementById('queue-empty-state');
  const badgePending = document.getElementById('badge-pending-count');
  if (!tbody) return;

  const keyword = (document.getElementById('filter-keyword')?.value || '').toLowerCase().trim();
  const filterStatus = document.getElementById('filter-status')?.value || 'ALL';
  const filterDate = document.getElementById('filter-date')?.value || '';

  let list = window.dentalStorage.getAppointments();

  // Update pending badge
  const pendingCount = list.filter(a => a.status === 'PENDING').length;
  if (badgePending) badgePending.textContent = pendingCount;

  // Apply filters
  if (filterStatus !== 'ALL') {
    list = list.filter(a => a.status === filterStatus);
  }
  if (filterDate) {
    list = list.filter(a => a.date === filterDate);
  }
  if (keyword) {
    list = list.filter(a => 
      a.patientName.toLowerCase().includes(keyword) ||
      a.citizenId.includes(keyword) ||
      a.phone.includes(keyword) ||
      a.id.toLowerCase().includes(keyword) ||
      a.symptoms.toLowerCase().includes(keyword)
    );
  }

  tbody.innerHTML = '';
  if (list.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  list.forEach(apt => {
    const tr = document.createElement('tr');

    let badgeClass = 'badge-pending';
    let statusText = 'รอยืนยัน';
    if (apt.status === 'CONFIRMED') { badgeClass = 'badge-confirmed'; statusText = 'ยืนยันแล้ว'; }
    if (apt.status === 'RESCHEDULED') { badgeClass = 'badge-rescheduled'; statusText = 'ขอเลื่อนนัด'; }
    if (apt.status === 'COMPLETED') { badgeClass = 'badge-completed'; statusText = 'ตรวจแล้ว'; }
    if (apt.status === 'CANCELLED') { badgeClass = 'badge-cancelled'; statusText = 'ยกเลิก'; }

    // Format citizen ID with hyphens
    const cIdFormatted = apt.citizenId.length === 13 
      ? `${apt.citizenId[0]}-${apt.citizenId.substring(1,5)}-${apt.citizenId.substring(5,10)}-${apt.citizenId.substring(10,12)}-${apt.citizenId[12]}`
      : apt.citizenId;

    let replyPreview = '<span class="no-reply">ยังไม่ได้ตอบกลับ</span>';
    if (apt.reply && apt.reply.message) {
      replyPreview = `
        <div class="reply-preview" title="${escapeHtml(apt.reply.message)}">
          💬 ${escapeHtml(apt.reply.message.length > 40 ? apt.reply.message.substring(0, 40) + '...' : apt.reply.message)}
          <br><small style="color:#64748b;">(${escapeHtml(apt.reply.repliedBy)})</small>
        </div>
      `;
    }

    tr.innerHTML = `
      <td><strong>${apt.id}</strong></td>
      <td>
        <span style="font-weight:600;">${formatThaiDate(apt.date, false)}</span><br>
        <span style="font-size:0.8rem; color:#64748b;">${apt.slotTime} น.</span>
      </td>
      <td>
        <span class="patient-cell-name">${escapeHtml(apt.patientName)}</span>
        <span class="patient-cell-sub">🪪 ${cIdFormatted}</span>
        <span class="patient-cell-sub">📞 <a href="tel:${apt.phone}">${escapeHtml(apt.phone)}</a></span>
      </td>
      <td class="symptoms-cell">
        <div>${escapeHtml(apt.symptoms)}</div>
        ${apt.medicalNotes ? `<span class="medical-alert">โรค/แพ้ยา: ${escapeHtml(apt.medicalNotes)}</span>` : ''}
      </td>
      <td><span class="status-pill ${badgeClass}">${statusText}</span></td>
      <td class="reply-cell">${replyPreview}</td>
      <td>
        <button class="btn btn-primary btn-xs" onclick="openReplyModal('${apt.id}')">
          💬 ตอบกลับ
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function clearQueueFilters() {
  if (document.getElementById('filter-keyword')) document.getElementById('filter-keyword').value = '';
  if (document.getElementById('filter-status')) document.getElementById('filter-status').value = 'ALL';
  if (document.getElementById('filter-date')) document.getElementById('filter-date').value = '';
  renderStaffQueueTable();
}

/* Staff Reply Modal Logic */
function openReplyModal(appointmentId) {
  const apt = window.dentalStorage.getAppointments().find(a => a.id === appointmentId);
  if (!apt) return;

  window.currentReplyingAppointment = apt;
  document.getElementById('reply-appointment-id').value = apt.id;
  
  // Set patient summary
  const summaryEl = document.getElementById('modal-patient-summary');
  summaryEl.innerHTML = `
    <div><strong>รหัสคิว:</strong> ${apt.id}</div>
    <div><strong>วันเวลานัด:</strong> ${formatThaiDate(apt.date)} (${apt.slotTime} น.)</div>
    <div><strong>ผู้ป่วย:</strong> ${escapeHtml(apt.patientName)}</div>
    <div><strong>เบอร์โทรศัพท์:</strong> <a href="tel:${apt.phone}">${escapeHtml(apt.phone)}</a></div>
    <div><strong>เลขบัตรประชาชน:</strong> ${formatCitizenId(apt.citizenId)}</div>
    <div><strong>โรคประจำตัว/แพ้ยา:</strong> ${escapeHtml(apt.medicalNotes || 'ไม่มี')}</div>
    <div style="grid-column: 1 / -1;"><strong>อาการ:</strong> ${escapeHtml(apt.symptoms)}</div>
  `;

  // Set current status radio
  const radios = document.getElementsByName('reply-status');
  radios.forEach(r => {
    r.checked = (r.value === apt.status);
  });

  // Pre-fill existing reply message if any
  const msgField = document.getElementById('reply-message');
  if (apt.reply && apt.reply.message) {
    msgField.value = apt.reply.message;
  } else {
    msgField.value = 'ทันตาภิบาลยืนยันนัดหมายเรียบร้อยแล้ว กรุณานำบัตรประชาชนตัวจริงมาด้วย และมาก่อนเวลานัดอย่างน้อย 15 นาทีครับ/ค่ะ';
  }

  document.getElementById('modal-reply').classList.add('show');
}

function closeReplyModal() {
  document.getElementById('modal-reply').classList.remove('show');
}

/* ============================================================
   Staff Tab: Appointment Calendar Overview (หน้านัดหมายที่เป็นปฏิทิน)
   ============================================================ */
function renderStaffAppointmentCalendar() {
  const titleEl = document.getElementById('staff-apt-cal-title');
  const gridEl = document.getElementById('staff-apt-grid');
  if (!titleEl || !gridEl) return;

  const thaiYear = state.staffAptYear + 543;
  titleEl.textContent = `${THAI_MONTHS[state.staffAptMonth]} ${thaiYear}`;
  gridEl.innerHTML = '';

  const filterStatus = document.getElementById('staff-apt-cal-status-filter')?.value || 'ALL';

  const firstDayIndex = new Date(state.staffAptYear, state.staffAptMonth, 1).getDay();
  const totalDaysInMonth = new Date(state.staffAptYear, state.staffAptMonth + 1, 0).getDate();
  const prevMonthDays = new Date(state.staffAptYear, state.staffAptMonth, 0).getDate();

  const todayStr = getTodayString();

  if (!state.staffAptSelectedDateStr) {
    state.staffAptSelectedDateStr = todayStr;
  }

  // Prev month leading cells
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const cell = document.createElement('div');
    cell.className = 'staff-apt-cell other-month';
    cell.innerHTML = `
      <div class="apt-cell-top">
        <span class="cell-day-num">${dayNum}</span>
      </div>
    `;
    gridEl.appendChild(cell);
  }

  // Current month day cells
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateObj = new Date(state.staffAptYear, state.staffAptMonth, day);
    const dateStr = toDateString(dateObj);
    const dateStatus = window.dentalStorage.isDateOpen(dateStr);
    const isToday = (dateStr === todayStr);
    const isSelected = (dateStr === state.staffAptSelectedDateStr);

    let dayAppointments = window.dentalStorage.getAppointmentsForDate(dateStr);

    // Apply status filter
    if (filterStatus !== 'ALL') {
      dayAppointments = dayAppointments.filter(a => a.status === filterStatus);
    }

    const pendingCount = dayAppointments.filter(a => a.status === 'PENDING').length;
    const confirmedCount = dayAppointments.filter(a => a.status === 'CONFIRMED').length;
    const rescheduledCount = dayAppointments.filter(a => a.status === 'RESCHEDULED').length;
    const completedCount = dayAppointments.filter(a => a.status === 'COMPLETED').length;
    const totalCount = dayAppointments.length;

    const cell = document.createElement('div');
    cell.className = 'staff-apt-cell';
    if (isToday) cell.classList.add('is-today');
    if (isSelected) cell.classList.add('is-selected');
    if (!dateStatus.isOpen) cell.classList.add('is-closed');

    let chipsHtml = '';
    if (!dateStatus.isOpen) {
      chipsHtml = `<div class="apt-chips-container"><span class="cell-clinic-tag closed">⛔ ปิดทำการ</span></div>`;
    } else if (totalCount === 0) {
      chipsHtml = `<div class="apt-chips-container"><span style="font-size:0.65rem; color:#94a3b8; padding:2px;">- ไม่มีคิว -</span></div>`;
    } else {
      let chips = [];
      if (pendingCount > 0) {
        chips.push(`<span class="apt-summary-pill pending">⏳ รอยืนยัน ${pendingCount}</span>`);
      }
      if (confirmedCount > 0) {
        chips.push(`<span class="apt-summary-pill confirmed">✅ ยืนยัน ${confirmedCount}</span>`);
      }
      if (rescheduledCount > 0) {
        chips.push(`<span class="apt-summary-pill rescheduled">🔵 เลื่อน ${rescheduledCount}</span>`);
      }
      if (completedCount > 0) {
        chips.push(`<span class="apt-summary-pill completed">🎉 ตรวจแล้ว ${completedCount}</span>`);
      }
      chipsHtml = `<div class="apt-chips-container">${chips.join('')}</div>`;
    }

    cell.innerHTML = `
      <div class="apt-cell-top">
        <span class="cell-day-num">${day}</span>
        ${totalCount > 0 ? `<span class="status-pill ${pendingCount > 0 ? 'badge-pending' : 'badge-confirmed'}" style="font-size:0.65rem; padding:1px 5px;">${totalCount} นัด</span>` : ''}
      </div>
      ${chipsHtml}
    `;

    cell.onclick = () => selectStaffAptDay(dateStr);
    gridEl.appendChild(cell);
  }

  renderStaffAppointmentAgenda();
  updateStaffTodayBadge();
}

function selectStaffAptDay(dateStr) {
  state.staffAptSelectedDateStr = dateStr;
  renderStaffAppointmentCalendar();
}

function prevStaffAptMonth() {
  state.staffAptMonth--;
  if (state.staffAptMonth < 0) {
    state.staffAptMonth = 11;
    state.staffAptYear--;
  }
  renderStaffAppointmentCalendar();
}

function nextStaffAptMonth() {
  state.staffAptMonth++;
  if (state.staffAptMonth > 11) {
    state.staffAptMonth = 0;
    state.staffAptYear++;
  }
  renderStaffAppointmentCalendar();
}

function todayStaffAptMonth() {
  const now = new Date();
  state.staffAptYear = now.getFullYear();
  state.staffAptMonth = now.getMonth();
  state.staffAptSelectedDateStr = toDateString(now);
  renderStaffAppointmentCalendar();
}

function updateStaffTodayBadge() {
  const todayStr = getTodayString();
  const todayApts = window.dentalStorage.getAppointmentsForDate(todayStr);
  const badgeEl = document.getElementById('badge-calendar-today');
  if (badgeEl) {
    badgeEl.textContent = `วันนี้ ${todayApts.length}`;
  }
}

function renderStaffAppointmentAgenda() {
  const titleEl = document.getElementById('agenda-selected-date-text');
  const countBadge = document.getElementById('agenda-day-count-badge');
  const listEl = document.getElementById('agenda-appointment-list');
  if (!titleEl || !listEl) return;

  const dateStr = state.staffAptSelectedDateStr || getTodayString();
  titleEl.textContent = formatThaiDate(dateStr);

  const dateStatus = window.dentalStorage.isDateOpen(dateStr);
  let list = window.dentalStorage.getAppointmentsForDate(dateStr);

  const filterStatus = document.getElementById('staff-apt-cal-status-filter')?.value || 'ALL';
  if (filterStatus !== 'ALL') {
    list = list.filter(a => a.status === filterStatus);
  }

  // Sort by time
  list.sort((a, b) => (a.slotTime || '').localeCompare(b.slotTime || ''));

  countBadge.textContent = `${list.length} นัดหมาย`;

  if (!dateStatus.isOpen) {
    listEl.innerHTML = `
      <div style="background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; padding:1.25rem; text-align:center; color:#991b1b;">
        <div style="font-size:1.5rem; margin-bottom:0.25rem;">⛔ ปิดทำการ</div>
        <strong>${escapeHtml(dateStatus.reason || 'ปิดทำการตามประกาศ')}</strong>
        <p style="font-size:0.82rem; margin-top:0.25rem; color:#7f1d1d;">ผู้รับบริการไม่สามารถจองคิวในวันนี้ได้</p>
      </div>
    `;
    return;
  }

  if (list.length === 0) {
    listEl.innerHTML = `
      <div class="empty-hint" style="padding:2.5rem 1rem;">
        <div style="font-size:2rem; margin-bottom:0.5rem;">📅</div>
        <h4>ไม่มีคิวนัดหมายในวันนี้</h4>
        <p style="font-size:0.85rem; color:#64748b;">สามารถคลิกเลือกวันอื่นที่มีตัวเลขคิวนัดจากปฏิทินด้านซ้าย</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  list.forEach(apt => {
    let badgeClass = 'badge-pending';
    let statusText = '⏳ รอยืนยัน';
    if (apt.status === 'CONFIRMED') { badgeClass = 'badge-confirmed'; statusText = '✅ ยืนยันแล้ว'; }
    if (apt.status === 'RESCHEDULED') { badgeClass = 'badge-rescheduled'; statusText = '🔵 ขอเลื่อนนัด'; }
    if (apt.status === 'COMPLETED') { badgeClass = 'badge-completed'; statusText = '🎉 ตรวจเสร็จแล้ว'; }
    if (apt.status === 'CANCELLED') { badgeClass = 'badge-cancelled'; statusText = '❌ ยกเลิก'; }

    const item = document.createElement('div');
    item.className = `agenda-item status-${apt.status}`;

    let replySnippet = '';
    if (apt.reply && apt.reply.message) {
      replySnippet = `
        <div class="agenda-reply-preview">
          <strong>💬 ตอบกลับแล้ว:</strong> "${escapeHtml(apt.reply.message)}"
        </div>
      `;
    }

    item.innerHTML = `
      <div class="agenda-item-top">
        <span class="agenda-slot-time">⏰ ${apt.slotTime} น.</span>
        <span class="status-pill ${badgeClass}">${statusText}</span>
      </div>
      <div class="agenda-patient-title">${escapeHtml(apt.patientName)}</div>
      <div class="agenda-contact-row">
        <span>🪪 ${apt.citizenId}</span>
        <span>📞 <a href="tel:${apt.phone}">${escapeHtml(apt.phone)}</a></span>
        <span>🏷️ ${apt.id}</span>
      </div>
      <div class="agenda-symptoms-box">
        <strong>อาการ:</strong> ${escapeHtml(apt.symptoms)}
        ${apt.medicalNotes ? `<br><span style="color:#b91c1c; font-size:0.78rem;">⚠️ โรค/แพ้ยา: ${escapeHtml(apt.medicalNotes)}</span>` : ''}
      </div>
      ${replySnippet}
      <div class="agenda-actions-row">
        <button class="btn btn-primary btn-sm" onclick="openReplyModal('${apt.id}')">
          💬 ตอบกลับ / เปลี่ยนสถานะ
        </button>
      </div>
    `;

    listEl.appendChild(item);
  });
}

function insertReplyTemplate(text) {
  document.getElementById('reply-message').value = text;
}

function handleSaveReply(event) {
  event.preventDefault();
  const id = document.getElementById('reply-appointment-id').value;
  const message = document.getElementById('reply-message').value.trim();
  const repliedBy = document.getElementById('reply-by').value.trim();

  let selectedStatus = 'CONFIRMED';
  const radios = document.getElementsByName('reply-status');
  for (const r of radios) {
    if (r.checked) {
      selectedStatus = r.value;
      break;
    }
  }

  const updated = window.dentalStorage.updateAppointmentReply(id, {
    message: message,
    repliedBy: repliedBy
  }, selectedStatus);

  if (updated) {
    showToast(`บันทึกการตอบกลับและอัปเดตสถานะคิว ${id} เรียบร้อยแล้ว`, 'success');
    closeReplyModal();
    renderStaffQueueTable();
    renderStaffAppointmentCalendar();
    renderStaffAppointmentAgenda();
    renderStaffStats();
    updateStaffTodayBadge();
  }
}

/* Staff Tab 2: Schedule & Slots Management */
function renderStaffCalendar() {
  const monthLabel = document.getElementById('staff-cal-month-label');
  const daysGrid = document.getElementById('staff-cal-days-grid');
  if (!monthLabel || !daysGrid) return;

  const thaiYear = state.staffYear + 543;
  monthLabel.textContent = `${THAI_MONTHS[state.staffMonth]} ${thaiYear}`;
  daysGrid.innerHTML = '';

  const firstDayIndex = new Date(state.staffYear, state.staffMonth, 1).getDay();
  const totalDaysInMonth = new Date(state.staffYear, state.staffMonth + 1, 0).getDate();
  const prevMonthDays = new Date(state.staffYear, state.staffMonth, 0).getDate();

  // Prev month cells
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.innerHTML = `<span class="day-num">${dayNum}</span>`;
    daysGrid.appendChild(cell);
  }

  // Current month cells
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dateObj = new Date(state.staffYear, state.staffMonth, day);
    const dateStr = toDateString(dateObj);
    const dateStatus = window.dentalStorage.isDateOpen(dateStr);
    const isSelected = dateStr === state.staffSelectedDateStr;

    const cell = document.createElement('div');
    cell.className = 'cal-day-cell';
    cell.classList.add(dateStatus.isOpen ? 'status-open' : 'status-closed');

    cell.innerHTML = `
      <span class="day-num">${day}</span>
      <span class="slot-badge">${dateStatus.isOpen ? 'เปิดบริการ' : 'ปิด'}</span>
    `;

    if (isSelected) {
      cell.classList.add('selected');
    }

    cell.onclick = () => selectStaffDate(dateStr);
    daysGrid.appendChild(cell);
  }

  updateStaffDateControlPanel();
}

function prevStaffMonth() {
  state.staffMonth--;
  if (state.staffMonth < 0) {
    state.staffMonth = 11;
    state.staffYear--;
  }
  renderStaffCalendar();
}

function nextStaffMonth() {
  state.staffMonth++;
  if (state.staffMonth > 11) {
    state.staffMonth = 0;
    state.staffYear++;
  }
  renderStaffCalendar();
}

function selectStaffDate(dateStr) {
  state.staffSelectedDateStr = dateStr;
  renderStaffCalendar();
  loadStaffSlotManagement();
}

function updateStaffDateControlPanel() {
  const dateText = document.getElementById('staff-selected-date-text');
  const statusPill = document.getElementById('staff-selected-date-status-pill');
  const reasonBox = document.getElementById('close-reason-box');
  const reasonInput = document.getElementById('close-reason-input');

  if (!state.staffSelectedDateStr) return;

  dateText.textContent = formatThaiDate(state.staffSelectedDateStr);
  const dateStatus = window.dentalStorage.isDateOpen(state.staffSelectedDateStr);

  if (dateStatus.isOpen) {
    statusPill.className = 'status-pill badge-confirmed';
    statusPill.textContent = 'เปิดให้บริการ';
    reasonBox.style.display = 'none';
  } else {
    statusPill.className = 'status-pill badge-cancelled';
    statusPill.textContent = 'ปิดทำการ (ผู้ป่วยจองไม่ได้)';
    reasonBox.style.display = 'block';
    reasonInput.value = dateStatus.reason || '';
  }
}

function toggleSelectedDateOpen(isOpen) {
  if (!state.staffSelectedDateStr) return;

  const reason = isOpen ? '' : (document.getElementById('close-reason-input')?.value || 'ปิดทำการตามประกาศ');
  window.dentalStorage.setDateStatus(state.staffSelectedDateStr, isOpen, reason);

  showToast(`ตั้งค่าวันที่ ${formatThaiDate(state.staffSelectedDateStr)} เป็น "${isOpen ? 'เปิดบริการ' : 'ปิดทำการ'}" เรียบร้อย`, isOpen ? 'success' : 'warning');

  renderStaffCalendar();
  renderPatientCalendar();
  loadSlotsForSelectedDate();
}

function saveCloseReason(reason) {
  if (!state.staffSelectedDateStr) return;
  window.dentalStorage.setDateStatus(state.staffSelectedDateStr, false, reason);
  showToast('บันทึกเหตุผลการปิดทำการแล้ว', 'info');
}

/* Staff Slots Management */
function loadStaffSlotManagement() {
  const container = document.getElementById('staff-slots-list');
  const countEl = document.getElementById('staff-slot-count');
  if (!container || !state.staffSelectedDateStr) return;

  const slots = window.dentalStorage.getSlotsForDate(state.staffSelectedDateStr);
  countEl.textContent = slots.length;

  if (slots.length === 0) {
    container.innerHTML = '<div class="empty-hint">ยังไม่มีรอบเวลาในวันนี้ (หรือเป็นวันที่ปิดทำการ)</div>';
    return;
  }

  container.innerHTML = '';
  slots.forEach((slot, index) => {
    const item = document.createElement('div');
    item.className = 'staff-slot-item';

    item.innerHTML = `
      <div class="staff-slot-info">
        <span class="staff-slot-time">⏰ ${slot.start} - ${slot.end} น.</span>
        <span class="staff-slot-cap">รับได้สูงสุด ${slot.capacity} คิว (จองแล้ว ${slot.bookedCount})</span>
      </div>
      <div>
        <button class="btn btn-outline btn-xs" onclick="deleteSlot('${slot.id}')" title="ลบรอบเวลานี้">
          🗑️ ลบ
        </button>
      </div>
    `;
    container.appendChild(item);
  });
}

function handleAddSlot(event) {
  event.preventDefault();
  const start = document.getElementById('new-slot-start').value;
  const end = document.getElementById('new-slot-end').value;
  const cap = parseInt(document.getElementById('new-slot-capacity').value, 10);

  if (start >= end) {
    showToast('เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด', 'error');
    return;
  }

  const schedule = window.dentalStorage.getSchedule();
  const dateStr = state.staffSelectedDateStr;
  const currentSlots = (schedule.customSlotsPerDate && schedule.customSlotsPerDate[dateStr]) 
    ? [...schedule.customSlotsPerDate[dateStr]] 
    : [...schedule.defaultSlots];

  const newId = `${start}-${end}`;
  if (currentSlots.some(s => s.id === newId)) {
    showToast('มีรอบเวลานี้อยู่แล้ว', 'warning');
    return;
  }

  currentSlots.push({
    id: newId,
    start: start,
    end: end,
    capacity: cap
  });

  // Sort slots by start time
  currentSlots.sort((a, b) => a.start.localeCompare(b.start));

  window.dentalStorage.saveSlotsForDate(dateStr, currentSlots);
  showToast(`เพิ่มรอบเวลา ${start} - ${end} เรียบร้อย`, 'success');

  loadStaffSlotManagement();
  loadSlotsForSelectedDate();
}

function deleteSlot(slotId) {
  if (!confirm(`คุณต้องการลบรอบเวลานี้ใช่หรือไม่?`)) return;

  const schedule = window.dentalStorage.getSchedule();
  const dateStr = state.staffSelectedDateStr;
  let currentSlots = (schedule.customSlotsPerDate && schedule.customSlotsPerDate[dateStr]) 
    ? [...schedule.customSlotsPerDate[dateStr]] 
    : [...schedule.defaultSlots];

  currentSlots = currentSlots.filter(s => s.id !== slotId);
  window.dentalStorage.saveSlotsForDate(dateStr, currentSlots);

  showToast('ลบรอบเวลาเรียบร้อย', 'info');
  loadStaffSlotManagement();
  loadSlotsForSelectedDate();
}

function resetSlotsToDefault() {
  if (!confirm('ต้องการคืนค่ารอบเวลามาตรฐาน (09:00 - 16:00 น.) สำหรับวันนี้ใช่หรือไม่?')) return;
  const schedule = window.dentalStorage.getSchedule();
  if (schedule.customSlotsPerDate && state.staffSelectedDateStr) {
    delete schedule.customSlotsPerDate[state.staffSelectedDateStr];
    window.dentalStorage.saveSchedule(schedule);
  }
  showToast('คืนค่ารอบเวลามาตรฐานเรียบร้อย', 'success');
  loadStaffSlotManagement();
  loadSlotsForSelectedDate();
}

/* Staff Tab 3: Statistics Dashboard */
function renderStaffStats() {
  const list = window.dentalStorage.getAppointments();

  const total = list.length;
  const pending = list.filter(a => a.status === 'PENDING').length;
  const confirmed = list.filter(a => a.status === 'CONFIRMED').length;
  const completed = list.filter(a => a.status === 'COMPLETED').length;

  document.getElementById('stat-total-bookings').textContent = total;
  document.getElementById('stat-pending-bookings').textContent = pending;
  document.getElementById('stat-confirmed-bookings').textContent = confirmed;
  document.getElementById('stat-completed-bookings').textContent = completed;

  // Breakdown by symptoms
  const categories = {
    'ขูดหินปูน / ขัดฟัน': 0,
    'อุดฟัน': 0,
    'ถอนฟัน': 0,
    'ปวดฟัน / เสียวฟัน': 0,
    'ตรวจสุขภาพช่องปากทั่วไป': 0,
    'อื่นๆ': 0
  };

  list.forEach(a => {
    const s = a.symptoms;
    let matched = false;
    for (const cat of Object.keys(categories)) {
      if (s.includes(cat) || (cat.includes('ขูดหินปูน') && s.includes('หินปูน')) || (cat.includes('ปวดฟัน') && (s.includes('ปวด') || s.includes('เสียว')))) {
        categories[cat]++;
        matched = true;
        break;
      }
    }
    if (!matched) categories['อื่นๆ']++;
  });

  const breakdownContainer = document.getElementById('stats-symptom-breakdown');
  if (!breakdownContainer) return;

  breakdownContainer.innerHTML = '';
  Object.entries(categories).forEach(([name, count]) => {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    row.innerHTML = `
      <div class="breakdown-info">
        <span>${name}</span>
        <strong>${count} ราย (${percent}%)</strong>
      </div>
      <div class="breakdown-bar-bg">
        <div class="breakdown-bar-fill" style="width: ${percent}%;"></div>
      </div>
    `;
    breakdownContainer.appendChild(row);
  });
}

function updateHeroStats() {
  // Count available slots for this month
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();

  let totalAvailableSlots = 0;
  for (let d = today.getDate(); d <= totalDays; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const slots = window.dentalStorage.getSlotsForDate(dStr);
    totalAvailableSlots += slots.reduce((sum, s) => sum + s.remaining, 0);
  }

  const statEl = document.getElementById('stat-slots-available');
  if (statEl) {
    statEl.textContent = `${totalAvailableSlots} คิว`;
  }
}

/* Export to CSV */
function exportAppointmentsData() {
  const list = window.dentalStorage.getAppointments();
  if (list.length === 0) {
    showToast('ไม่มีข้อมูลการนัดหมายที่จะส่งออก', 'warning');
    return;
  }

  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel in Thai
  csvContent += 'รหัสคิว,วันที่นัด,เวลานัด,ชื่อ-สกุล,เลขประจำตัวประชาชน,เบอร์โทร,อาการเบื้องต้น,โรคประจำตัวและแพ้ยา,สถานะ,ข้อความตอบกลับจากทันตาภิบาล,ผู้ตอบกลับ\n';

  list.forEach(a => {
    const replyMsg = a.reply ? a.reply.message.replace(/"/g, '""') : '';
    const replier = a.reply ? a.reply.repliedBy.replace(/"/g, '""') : '';
    const row = [
      `"${a.id}"`,
      `"${a.date}"`,
      `"${a.slotTime}"`,
      `"${a.patientName.replace(/"/g, '""')}"`,
      `"'${a.citizenId}"`, // single quote to preserve 13 digits in Excel
      `"'${a.phone}"`,
      `"${a.symptoms.replace(/"/g, '""')}"`,
      `"${(a.medicalNotes || '').replace(/"/g, '""')}"`,
      `"${a.status}"`,
      `"${replyMsg}"`,
      `"${replier}"`
    ];
    csvContent += row.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `dental_appointments_${getTodayString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('ส่งออกไฟล์รายชื่อผู้ป่วย (CSV) สำเร็จ', 'success');
}

/* ============================================================
   Admin User Management & Password Reset Controller
   ============================================================ */
function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.`;
    return `${formatThaiDate(dateStr)} ${timeStr}`;
  } catch (e) {
    return isoStr;
  }
}

function renderAdminUsersTab() {
  const users = window.dentalStorage.getStaffUsers();
  
  // Update KPI counters
  const totalEl = document.getElementById('stat-user-total');
  const adminEl = document.getElementById('stat-user-admin');
  const nurseEl = document.getElementById('stat-user-nurse');
  const badgeCountEl = document.getElementById('badge-users-count');

  const adminCount = users.filter(u => u.roleType === 'admin').length;
  const nurseCount = users.filter(u => u.roleType !== 'admin').length;

  if (totalEl) totalEl.textContent = `${users.length} คน`;
  if (adminEl) adminEl.textContent = `${adminCount} คน`;
  if (nurseEl) nurseEl.textContent = `${nurseCount} คน`;
  if (badgeCountEl) badgeCountEl.textContent = `${users.length} บัญชี`;

  renderAdminUsersTable();
}

function renderAdminUsersTable() {
  const tbody = document.getElementById('admin-user-table-body');
  if (!tbody) return;

  const currentStaff = window.dentalStorage.getLoggedInStaff();
  const keyword = (document.getElementById('filter-user-keyword')?.value || '').trim().toLowerCase();
  let users = window.dentalStorage.getStaffUsers();

  if (keyword) {
    users = users.filter(u => 
      u.username.toLowerCase().includes(keyword) ||
      u.name.toLowerCase().includes(keyword) ||
      (u.role && u.role.toLowerCase().includes(keyword))
    );
  }

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          <div>ไม่พบข้อมูลผู้ใช้งานที่ตรงกับคำค้นหา</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  users.forEach(u => {
    const isCurrent = currentStaff && currentStaff.username.toLowerCase() === u.username.toLowerCase();
    const isAdmin = u.roleType === 'admin';
    const isBookingStaff = u.roleType === 'booking_staff';
    const lastLoginText = u.lastLogin ? formatDateTime(u.lastLogin) : 'ยังไม่เคยเข้าสู่ระบบ';

    let roleClass = 'nurse';
    let roleLabel = '🩺 ทันตาภิบาล';
    if (isAdmin) {
      roleClass = 'admin';
      roleLabel = '👑 ผู้ดูแลระบบ (Admin)';
    } else if (isBookingStaff) {
      roleClass = 'booking-staff';
      roleLabel = '📋 เจ้าหน้าที่จองคิว';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="font-weight: 700; color: #0284c7;">
          ${escapeHtml(u.username)}
          ${isCurrent ? '<span style="font-size: 0.7rem; color: #16a34a; background: #dcfce7; padding: 1px 6px; border-radius: 4px; margin-left: 4px;">(บัญชีคุณ)</span>' : ''}
        </div>
      </td>
      <td>
        <div style="font-weight: 600; color: #1e293b;">${escapeHtml(u.name)}</div>
      </td>
      <td>
        <div style="font-size: 0.85rem; color: #64748b;">${escapeHtml(u.role || '-')}</div>
      </td>
      <td>
        <span class="user-role-pill ${roleClass}">
          ${roleLabel}
        </span>
      </td>
      <td>
        <span class="user-status-dot"></span>
        <span style="font-size: 0.82rem; color: #15803d; font-weight: 500;">ใช้งานปกติ</span>
      </td>
      <td>
        <div style="font-size: 0.8rem; color: #64748b;">${lastLoginText}</div>
      </td>
      <td>
        <div class="action-btn-group">
          <button class="btn-action-icon edit" onclick="openEditUserModal('${escapeHtml(u.username)}')" title="แก้ไขข้อมูลผู้ใช้งานนี้">
            <span>✏️ แก้ไข</span>
          </button>
          <button class="btn-action-icon" onclick="openAdminResetModal('${escapeHtml(u.username)}')" title="รีเซ็ตรหัสผ่านใหม่เมื่อผู้ใช้ลืม">
            <span>🔑 รีเซ็ตรหัส</span>
          </button>
          <button class="btn-action-icon danger" onclick="handleDeleteUser('${escapeHtml(u.username)}')" ${isCurrent ? 'disabled title="ไม่สามารถลบบัญชีของตนเองได้"' : 'title="ลบผู้ใช้งานนี้"'}>
            <span>🗑️ ลบ</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openAddUserModal() {
  document.getElementById('form-add-user').reset();
  const roleTitleInput = document.getElementById('new-role-title');
  if (roleTitleInput) roleTitleInput.value = 'ทันตาภิบาลปฏิบัติการ';
  const errBox = document.getElementById('add-user-error');
  if (errBox) errBox.style.display = 'none';
  document.getElementById('modal-add-user').classList.add('show');
}

function closeAddUserModal() {
  document.getElementById('modal-add-user').classList.remove('show');
}

function handleRoleTypeChange() {
  const roleType = document.getElementById('new-role-type').value;
  const roleTitleInput = document.getElementById('new-role-title');
  if (roleTitleInput) {
    if (roleType === 'admin') {
      roleTitleInput.value = 'ผู้ดูแลระบบ (Admin)';
    } else if (roleType === 'booking_staff') {
      roleTitleInput.value = 'เจ้าหน้าที่จองคิวและเวชระเบียน';
    } else {
      roleTitleInput.value = 'ทันตาภิบาลปฏิบัติการ';
    }
  }
}

function openEditUserModal(username) {
  const users = window.dentalStorage.getStaffUsers();
  const user = users.find(u => u.username.toLowerCase() === (username || '').toLowerCase());
  if (!user) {
    showToast('ไม่พบบัญชีผู้ใช้งานที่ต้องการแก้ไข', 'error');
    return;
  }

  document.getElementById('edit-username').value = user.username;
  document.getElementById('edit-name').value = user.name || '';
  
  let roleType = user.roleType;
  if (!roleType) {
    if (user.username.toLowerCase() === 'admin' || (user.role && user.role.includes('ผู้ดูแลระบบ'))) roleType = 'admin';
    else if (user.username.toLowerCase() === 'staff' || (user.role && user.role.includes('จองคิว'))) roleType = 'booking_staff';
    else roleType = 'dentist';
  }
  if (roleType === 'nurse') roleType = 'dentist';

  document.getElementById('edit-role-type').value = roleType;
  document.getElementById('edit-role-title').value = user.role || '';
  document.getElementById('edit-password').value = '';

  const errBox = document.getElementById('edit-user-error');
  if (errBox) errBox.style.display = 'none';

  document.getElementById('modal-edit-user').classList.add('show');
}

function closeEditUserModal() {
  document.getElementById('modal-edit-user').classList.remove('show');
}

function handleEditRoleTypeChange() {
  const roleType = document.getElementById('edit-role-type').value;
  const roleTitleInput = document.getElementById('edit-role-title');
  if (roleTitleInput) {
    if (roleType === 'admin') {
      roleTitleInput.value = 'ผู้ดูแลระบบ (Admin)';
    } else if (roleType === 'booking_staff') {
      roleTitleInput.value = 'เจ้าหน้าที่จองคิวและเวชระเบียน';
    } else {
      roleTitleInput.value = 'ทันตาภิบาลปฏิบัติการ';
    }
  }
}

function handleEditUserSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('edit-username').value;
  const name = document.getElementById('edit-name').value.trim();
  const roleType = document.getElementById('edit-role-type').value;
  const role = document.getElementById('edit-role-title').value.trim();
  const password = document.getElementById('edit-password').value.trim();
  const errBox = document.getElementById('edit-user-error');

  const updateData = {
    name,
    role,
    roleType
  };
  if (password) {
    if (password.length < 4) {
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร';
      }
      return;
    }
    updateData.password = password;
  }

  const res = window.dentalStorage.updateStaffUser(username, updateData);
  if (res.success) {
    closeEditUserModal();
    renderAdminUsersTab();
    showToast(`แก้ไขข้อมูลผู้ใช้งาน "${username}" สำเร็จ`, 'success');
  } else {
    if (errBox) {
      errBox.style.display = 'block';
      errBox.textContent = res.error || 'ไม่สามารถแก้ไขข้อมูลได้';
    }
  }
}

function handleAddUserSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('new-username').value;
  const name = document.getElementById('new-name').value;
  const roleType = document.getElementById('new-role-type').value;
  const role = document.getElementById('new-role-title').value;
  const password = document.getElementById('new-password').value;
  const passwordConfirm = document.getElementById('new-password-confirm').value;
  const errBox = document.getElementById('add-user-error');

  if (password !== passwordConfirm) {
    if (errBox) {
      errBox.style.display = 'block';
      errBox.textContent = 'รหัสผ่านเริ่มต้นและการยืนยันรหัสผ่านไม่ตรงกัน';
    }
    return;
  }

  const res = window.dentalStorage.addStaffUser({
    username,
    name,
    role,
    roleType,
    password
  });

  if (res.success) {
    closeAddUserModal();
    renderAdminUsersTab();
    showToast(`เพิ่มผู้ใช้งาน "${res.user.name}" (${res.user.username}) เรียบร้อยแล้ว`, 'success');
  } else {
    if (errBox) {
      errBox.style.display = 'block';
      errBox.textContent = res.error || 'ไม่สามารถเพิ่มผู้ใช้งานได้';
    }
  }
}

function openAdminResetModal(username) {
  const users = window.dentalStorage.getStaffUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    showToast('ไม่พบบัญชีผู้ใช้งานนี้ในระบบ', 'error');
    return;
  }

  document.getElementById('form-admin-reset-pw').reset();
  document.getElementById('admin-reset-target-user').value = user.username;
  document.getElementById('admin-reset-name').textContent = user.name;
  document.getElementById('admin-reset-username').textContent = user.username;

  const errBox = document.getElementById('admin-reset-error');
  if (errBox) errBox.style.display = 'none';

  document.getElementById('modal-admin-reset-pw').classList.add('show');
}

function closeAdminResetModal() {
  document.getElementById('modal-admin-reset-pw').classList.remove('show');
}

function handleAdminResetSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('admin-reset-target-user').value;
  const newPw = document.getElementById('admin-reset-new-pw').value;
  const confirmPw = document.getElementById('admin-reset-confirm-pw').value;
  const errBox = document.getElementById('admin-reset-error');

  if (newPw !== confirmPw) {
    if (errBox) {
      errBox.style.display = 'block';
      errBox.textContent = 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน';
    }
    return;
  }

  const res = window.dentalStorage.adminResetPassword(username, newPw);
  if (res.success) {
    closeAdminResetModal();
    renderAdminUsersTab();
    showToast(`รีเซ็ตรหัสผ่านสำหรับ "${res.name}" เรียบร้อยแล้ว! สามารถนำรหัสผ่านใหม่ไปเข้าใช้งานได้ทันที`, 'success');
  } else {
    if (errBox) {
      errBox.style.display = 'block';
      errBox.textContent = res.error || 'ไม่สามารถรีเซ็ตรหัสผ่านได้';
    }
  }
}

function handleDeleteUser(username) {
  const users = window.dentalStorage.getStaffUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return;

  const confirmed = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีผู้ใช้งาน:\n"${user.name}" (Username: ${user.username})\n\nเมื่อลบแล้วจะไม่สามารถกู้คืนได้`);
  if (!confirmed) return;

  const res = window.dentalStorage.deleteStaffUser(username);
  if (res.success) {
    renderAdminUsersTab();
    showToast(`ลบบัญชีผู้ใช้งาน "${user.username}" ออกจากระบบเรียบร้อย`, 'info');
  } else {
    showToast(res.error || 'ไม่สามารถลบผู้ใช้งานได้', 'error');
  }
}

/* ============================================================
   BroadcastChannel Sync Listener
   ============================================================ */
function setupBroadcastListener() {
  // Listen for Firebase Real-time Cloud Firestore updates
  window.addEventListener('dental:data-synced', (event) => {
    renderPatientCalendar();
    loadSlotsForSelectedDate();
    renderPatientSymptomChips();
    updateHeroStats();
    if (state.currentView === 'staff') {
      renderStaffQueueTable();
      renderStaffAppointmentCalendar();
      renderStaffAppointmentAgenda();
      renderStaffServicesList();
      renderStaffStats();
      updateStaffTodayBadge();
      if (window.dentalStorage.isStaffAdmin()) {
        renderAdminUsersTab();
      }
    }
  });

  if (window.BroadcastChannel) {
    try {
      const bc = new BroadcastChannel('dental_app_channel');
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'DATA_UPDATED') {
          // Re-render components quietly
          renderPatientCalendar();
          loadSlotsForSelectedDate();
          renderPatientSymptomChips();
          if (state.currentView === 'staff') {
            renderStaffQueueTable();
            renderStaffAppointmentCalendar();
            renderStaffAppointmentAgenda();
            renderStaffServicesList();
            renderStaffStats();
            updateStaffTodayBadge();
            if (window.dentalStorage.isStaffAdmin()) {
              renderAdminUsersTab();
            }
          }
        }
      };
    } catch (e) {
      // BroadcastChannel optional fallback
    }
  }
}

/* ============================================================
   Toast Notification Utility
   ============================================================ */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';
  if (type === 'warning') icon = '🔔';

  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Utility: Escape HTML for security
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

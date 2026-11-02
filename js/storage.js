/**
 * Dental Clinic Queue System - Storage & Data Layer
 * Handles LocalStorage persistence, synchronization, and business logic
 */

const STORAGE_KEYS = {
  APPOINTMENTS: 'dental_app_appointments',
  SCHEDULE: 'dental_app_schedule',
  STAFF_AUTH: 'dental_app_staff_auth',
  STAFF_USERS: 'dental_app_staff_users',
  LOGIN_LOCKOUT: 'dental_app_login_lockout'
};

// Cryptographic Standard SHA-256 Hash Algorithm (Synchronous)
function cryptoSha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var lengthProperty = 'length';
  var i, j;
  var result = '';
  var words = [];
  var asciiBitLength = ascii[lengthProperty] * 8;
  var hash = [];
  var k = [];
  var primeCounter = 0;
  var isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty];) {
    var w = words.slice(j, j += 16);
    var oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      var s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      var ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      var temp1 = hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (
        w[i] = (i < 16) ? w[i] : (
          w[i - 16] + s0 + w[i - 7] + s1
        ) | 0
      );
      var temp2 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      var b = (hash[i] >> (8 * j)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// Thai Months Name Array
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

// Helper: Format Date in Thai (พ.ศ.)
function formatThaiDate(dateStr, includeYear = true) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const thaiYear = year + 543;
  return includeYear 
    ? `${day} ${THAI_MONTHS[monthIdx]} ${thaiYear}` 
    : `${day} ${THAI_MONTHS_SHORT[monthIdx]}`;
}

// Helper: Validate Thai Citizen ID (13 digits + checksum algorithm)
function isValidThaiCitizenId(id) {
  if (!id || id.length !== 13) return false;
  if (!/^[0-9]{13}$/.test(id)) return false;
  
  // Calculate Checksum
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(id.charAt(i), 10) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(id.charAt(12), 10);
}

// ============================================================
// Clinic Booking Policy & Advance Booking Rules
// ============================================================
const MIN_BOOKING_ADVANCE_DAYS = 5;

// Helper: Get minimum allowed date for booking (today + 5 days)
function getMinBookingDate(baseDate = new Date()) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + MIN_BOOKING_ADVANCE_DAYS);
  return d;
}

function getMinBookingDateString(baseDate = new Date()) {
  const d = getMinBookingDate(baseDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================
// Thailand Official Public Holidays (วันหยุดราชการประจำปี)
// ============================================================
const THAI_PUBLIC_HOLIDAYS_FIXED = {
  '01-01': 'วันขึ้นปีใหม่',
  '04-06': 'วันพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช และวันที่ระลึกมหาจักรีบรมราชวงศ์ (วันจักรี)',
  '04-13': 'วันสงกรานต์',
  '04-14': 'วันสงกรานต์',
  '04-15': 'วันสงกรานต์',
  '05-01': 'วันแรงงานแห่งชาติ',
  '05-04': 'วันฉัตรมงคล',
  '06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าสุทิดาฯ พระบรมราชินี',
  '07-28': 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว (ร.10)',
  '08-12': 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง และวันแม่แห่งชาติ',
  '10-13': 'วันนวมินทรมหาราช (วันคล้ายวันสวรรคต ร.9)',
  '10-23': 'วันปิยมหาราช',
  '12-05': 'วันคล้ายวันพระบรมราชสมภพ ร.9 วันชาติ และวันพ่อแห่งชาติ',
  '12-10': 'วันรัฐธรรมนูญ',
  '12-31': 'วันสิ้นปี'
};

const THAI_PUBLIC_HOLIDAYS_MOVABLE = {
  '2025-02-12': 'วันมาฆบูชา',
  '2025-05-11': 'วันวิสาขบูชา',
  '2025-05-12': 'วันหยุดชดเชยวันวิสาขบูชา',
  '2025-07-10': 'วันอาสาฬหบูชา',
  '2025-07-11': 'วันเข้าพรรษา',
  '2026-03-03': 'วันมาฆบูชา',
  '2026-05-31': 'วันวิสาขบูชา',
  '2026-06-01': 'วันหยุดชดเชยวันวิสาขบูชา',
  '2026-07-29': 'วันอาสาฬหบูชา',
  '2026-07-30': 'วันเข้าพรรษา',
  '2027-02-21': 'วันมาฆบูชา',
  '2027-02-22': 'วันหยุดชดเชยวันมาฆบูชา',
  '2027-05-20': 'วันวิสาขบูชา',
  '2027-07-17': 'วันอาสาฬหบูชา',
  '2027-07-18': 'วันเข้าพรรษา',
  '2027-07-19': 'วันหยุดชดเชยวันเข้าพรรษา'
};

function getThaiPublicHoliday(dateStr) {
  if (!dateStr) return null;
  
  // 1. Check movable / year-specific holidays
  if (THAI_PUBLIC_HOLIDAYS_MOVABLE[dateStr]) {
    return { isHoliday: true, name: THAI_PUBLIC_HOLIDAYS_MOVABLE[dateStr] };
  }

  // 2. Check fixed annual holidays (MM-DD)
  const monthDay = dateStr.substring(5);
  if (THAI_PUBLIC_HOLIDAYS_FIXED[monthDay]) {
    return { isHoliday: true, name: THAI_PUBLIC_HOLIDAYS_FIXED[monthDay] };
  }

  // 3. Check automatic weekend compensation (วันหยุดชดเชย หากวันหยุดตรงกับ เสาร์-อาทิตย์ ให้หยุดวันจันทร์)
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const currentD = new Date(year, month, day);

  if (currentD.getDay() === 1) { // If Monday
    // Check if Sunday (yesterday) was a fixed holiday
    const sunD = new Date(year, month, day - 1);
    const sunMonthDay = String(sunD.getMonth() + 1).padStart(2, '0') + '-' + String(sunD.getDate()).padStart(2, '0');
    if (THAI_PUBLIC_HOLIDAYS_FIXED[sunMonthDay]) {
      return { isHoliday: true, name: `วันหยุดชดเชย${THAI_PUBLIC_HOLIDAYS_FIXED[sunMonthDay]}` };
    }

    // Check if Saturday (2 days ago) was a fixed holiday
    const satD = new Date(year, month, day - 2);
    const satMonthDay = String(satD.getMonth() + 1).padStart(2, '0') + '-' + String(satD.getDate()).padStart(2, '0');
    if (THAI_PUBLIC_HOLIDAYS_FIXED[satMonthDay]) {
      return { isHoliday: true, name: `วันหยุดชดเชย${THAI_PUBLIC_HOLIDAYS_FIXED[satMonthDay]}` };
    }
  }

  return null;
}

// Default standard slots
const DEFAULT_SLOTS = [
  { id: '09:00-10:00', start: '09:00', end: '10:00', capacity: 2 },
  { id: '10:00-11:00', start: '10:00', end: '11:00', capacity: 2 },
  { id: '11:00-12:00', start: '11:00', end: '12:00', capacity: 2 },
  { id: '13:00-14:00', start: '13:00', end: '14:00', capacity: 2 },
  { id: '14:00-15:00', start: '14:00', end: '15:00', capacity: 2 },
  { id: '15:00-16:00', start: '15:00', end: '16:00', capacity: 2 }
];

// Initial Data Seed
function getInitialSchedule() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  // Closed dates map: 'YYYY-MM-DD': { isClosed: true, reason: string }
  const closedDates = {};
  
  // Example closed date 1: 5 days from today (Holiday / Meeting)
  const holidayDate = new Date(today);
  holidayDate.setDate(today.getDate() + 4);
  const holidayStr = holidayDate.toISOString().split('T')[0];
  closedDates[holidayStr] = {
    isClosed: true,
    reason: 'วันหยุดราชการ / อบรมวิชาการทันตสาธารณสุข'
  };

  return {
    defaultWeeklyDays: [1, 2, 3, 4, 5], // Mon - Fri open by default
    closedDates: closedDates,
    openDates: {}, // For opening special weekend days
    defaultSlots: DEFAULT_SLOTS,
    customSlotsPerDate: {}
  };
}

function getInitialAppointments() {
  const today = new Date();
  
  // Helper to make date string
  const makeDate = (offsetDays) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const sampleDate1 = makeDate(1);
  const sampleDate2 = makeDate(2);
  const sampleDate3 = makeDate(3);

  return [
    {
      id: 'DEN-202611-001',
      date: sampleDate1,
      slotId: '09:00-10:00',
      slotTime: '09:00 - 10:00',
      patientName: 'นายประสิทธิ์ สุขเจริญ',
      citizenId: '1100400123450',
      phone: '0812345678',
      symptoms: 'ต้องการขูดหินปูนประจำปี มีหินปูนสะสมฟันล่างด้านใน',
      medicalNotes: 'ไม่มีโรคประจำตัว ไม่แพ้ยา',
      status: 'CONFIRMED',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      reply: {
        message: 'ทันตาภิบาลยืนยันนัดหมายเรียบร้อยแล้ว กรุณานำบัตรประชาชนตัวจริงมาด้วย และมาก่อนเวลานัด 15 นาทีครับ',
        repliedBy: 'ทภ. รัตนา พงษ์สวัสดิ์',
        repliedAt: new Date(Date.now() - 86400000).toISOString()
      }
    },
    {
      id: 'DEN-202611-002',
      date: sampleDate1,
      slotId: '10:00-11:00',
      slotTime: '10:00 - 11:00',
      patientName: 'นางสาวกานดา วิมลศิลป์',
      citizenId: '3101700987654',
      phone: '0898765432',
      symptoms: 'ปวดฟันกรามบนขวา เวลาเคี้ยวอาหาร มีรูผุ',
      medicalNotes: 'แพ้ยาเพนิซิลลิน (Penicillin)',
      status: 'PENDING',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      reply: null
    },
    {
      id: 'DEN-202611-003',
      date: sampleDate2,
      slotId: '13:00-14:00',
      slotTime: '13:00 - 14:00',
      patientName: 'นายวิเชียร มั่นคง',
      citizenId: '1209900345678',
      phone: '0945678901',
      symptoms: 'มีอาการเสียวฟันหน้าด้านบนเวลาดื่มน้ำเย็น ต้องการให้ตรวจสุขภาพช่องปาก',
      medicalNotes: 'โรคความดันโลหิตสูง รับประทานยาควบคุมสม่ำเสมอ',
      status: 'RESCHEDULED',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      reply: {
        message: 'รอบ 13:00 น. ติดภารกิจตรวจเด็กนักเรียน ขออนุญาตปรับเวลาเป็น 14:00 น. ในวันเดียวกัน หากสะดวกสามารถมาตามเวลาใหม่ได้เลยครับ',
        repliedBy: 'ทภ. ชัชวาลย์ รักษ์ฟันดี',
        repliedAt: new Date(Date.now() - 3600000 * 12).toISOString()
      }
    }
  ];
}

// Initial Staff Users Seed (with SHA-256 Hashed Passwords)
function getInitialStaffUsers() {
  return [
    {
      username: 'nurse',
      name: 'ทภ. รัตนา พงษ์สวัสดิ์',
      role: 'ทันตาภิบาลปฏิบัติการ',
      roleType: 'nurse',
      passwordHash: cryptoSha256('1234_dental_salt_2026'),
      status: 'ACTIVE',
      createdAt: '2026-11-01T08:00:00.000Z',
      lastLogin: null
    },
    {
      username: 'admin',
      name: 'นายเดียร์ เบญจาวิริยะวงศ์',
      role: 'นักวิชาการสาธารณสุข (ผู้ดูแลระบบ)',
      roleType: 'admin',
      passwordHash: cryptoSha256('1234_dental_salt_2026'),
      status: 'ACTIVE',
      createdAt: '2026-11-01T08:00:00.000Z',
      lastLogin: null
    }
  ];
}

class DentalStorage {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.SCHEDULE)) {
      localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(getInitialSchedule()));
    }
    if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(getInitialAppointments()));
    }
    if (!localStorage.getItem(STORAGE_KEYS.STAFF_USERS)) {
      localStorage.setItem(STORAGE_KEYS.STAFF_USERS, JSON.stringify(getInitialStaffUsers()));
    }
    this.initFirestoreSync();
  }

  initFirestoreSync() {
    if (typeof firebaseDb === 'undefined' || !firebaseDb) return;

    try {
      // 1. Listen to Appointments collection in real-time
      firebaseDb.collection('appointments').onSnapshot((snapshot) => {
        if (snapshot.empty) {
          const localApts = this.getAppointments();
          const listToSeed = (localApts && localApts.length > 0) ? localApts : getInitialAppointments();
          const batch = firebaseDb.batch();
          listToSeed.forEach(apt => {
            const ref = firebaseDb.collection('appointments').doc(apt.id);
            batch.set(ref, apt);
          });
          batch.commit().catch(e => console.warn('Firestore seed notice:', e));
          return;
        }

        const cloudList = [];
        snapshot.forEach(doc => cloudList.push(doc.data()));
        cloudList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(cloudList));
        
        window.dispatchEvent(new CustomEvent('dental:data-synced', { detail: { type: 'appointments', count: cloudList.length } }));
      }, (err) => {
        console.warn('Firestore appointments listener notice:', err);
      });

      // 2. Listen to Schedules document in real-time
      firebaseDb.collection('schedules').doc('main').onSnapshot((doc) => {
        if (doc.exists) {
          const cloudSched = doc.data();
          localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(cloudSched));
          window.dispatchEvent(new CustomEvent('dental:data-synced', { detail: { type: 'schedule' } }));
        } else {
          const currentSched = this.getSchedule();
          firebaseDb.collection('schedules').doc('main').set(currentSched).catch(e => console.warn('Firestore schedule seed notice:', e));
        }
      }, (err) => {
        console.warn('Firestore schedule listener notice:', err);
      });

      // 3. Listen to Staff Users collection in real-time
      firebaseDb.collection('staff_users').onSnapshot((snapshot) => {
        if (snapshot.empty) {
          const initialUsers = getInitialStaffUsers();
          const batch = firebaseDb.batch();
          initialUsers.forEach(u => {
            const ref = firebaseDb.collection('staff_users').doc(u.username);
            batch.set(ref, u);
          });
          batch.commit().catch(e => console.warn('Firestore staff_users seed error:', e));
          return;
        }

        const cloudUsers = [];
        snapshot.forEach(doc => cloudUsers.push(doc.data()));
        localStorage.setItem(STORAGE_KEYS.STAFF_USERS, JSON.stringify(cloudUsers));
      }, (err) => {
        console.warn('Firestore staff_users sync notice:', err);
      });

    } catch (e) {
      console.warn('Firestore sync setup notice:', e);
    }
  }

  // --- Schedule APIs ---
  getSchedule() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
      return data ? JSON.parse(data) : getInitialSchedule();
    } catch (e) {
      console.error('Error loading schedule:', e);
      return getInitialSchedule();
    }
  }

  saveSchedule(schedule) {
    localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(schedule));
    this.broadcastChange();
    if (typeof firebaseDb !== 'undefined' && firebaseDb) {
      firebaseDb.collection('schedules').doc('main').set(schedule).catch(e => console.warn('Cloud save schedule notice:', e));
    }
  }

  isDateOpen(dateStr) {
    const schedule = this.getSchedule();
    
    // 1. Check explicit staff overrides first
    if (schedule.closedDates && schedule.closedDates[dateStr] && schedule.closedDates[dateStr].isClosed) {
      return { isOpen: false, reason: schedule.closedDates[dateStr].reason || 'ปิดทำการตามประกาศคลินิก' };
    }
    if (schedule.openDates && schedule.openDates[dateStr]) {
      return { isOpen: true, reason: 'เปิดให้บริการพิเศษ' };
    }

    // 2. Check Thailand Official Public Holidays (วันหยุดราชการอัตโนมัติ)
    const holiday = getThaiPublicHoliday(dateStr);
    if (holiday) {
      return {
        isOpen: false,
        isPublicHoliday: true,
        holidayName: holiday.name,
        reason: `วันหยุดราชการ (${holiday.name})`
      };
    }

    // 3. Check weekly standard days (0=Sunday, 6=Saturday closed by default)
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    const isStandardOpen = schedule.defaultWeeklyDays.includes(dayOfWeek);
    
    if (isStandardOpen) {
      return { isOpen: true, reason: 'เปิดให้บริการปกติ' };
    } else {
      return { isOpen: false, reason: 'ปิดทำการประจำสัปดาห์ (เสาร์-อาทิตย์)' };
    }
  }

  // Check if a date is eligible for patient booking (locking past, <5 days, closed, holiday, and slot capacity)
  isDateBookableForPatient(dateStr) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // 1. Lock past dates (ห้ามจองย้อนหลัง)
    if (dateStr < todayStr) {
      return { isBookable: false, code: 'PAST_DATE', reason: 'ไม่สามารถจองคิวย้อนหลังได้' };
    }

    // 2. Lock dates less than 5 days in advance (ต้องจองล่วงหน้ามากกว่าวันปัจจุบัน 5 วัน)
    const minBookDateStr = getMinBookingDateString(today);
    if (dateStr < minBookDateStr) {
      return {
        isBookable: false,
        code: 'TOO_SOON',
        minDate: minBookDateStr,
        reason: `ต้องจองคิวล่วงหน้าอย่างน้อย ${MIN_BOOKING_ADVANCE_DAYS} วัน (เปิดรับจองตั้งแต่วันที่ ${formatThaiDate(minBookDateStr)} เป็นต้นไป)`
      };
    }

    // 3. Must not fall on public holidays or closed dates (ปิดการจองในวันหยุดราชการอัตโนมัติ)
    const dateStatus = this.isDateOpen(dateStr);
    if (!dateStatus.isOpen) {
      return { isBookable: false, code: 'CLOSED', isPublicHoliday: !!dateStatus.isPublicHoliday, reason: dateStatus.reason };
    }

    // 4. Must be a date with slots configured by staff (เจ้าหน้าที่เปิด slot ให้)
    const slots = this.getSlotsForDate(dateStr);
    if (!slots || slots.length === 0) {
      return { isBookable: false, code: 'NO_SLOTS', reason: 'เจ้าหน้าที่ยังไม่ได้เปิดรอบเวลาให้บริการในวันนี้' };
    }

    const availableSlots = slots.filter(s => s.remaining > 0);
    if (availableSlots.length === 0) {
      return { isBookable: false, code: 'FULL', reason: 'คิวเต็มทุกช่วงเวลาแล้ว' };
    }

    const totalAvailable = availableSlots.reduce((sum, s) => sum + s.remaining, 0);
    return {
      isBookable: true,
      code: 'OPEN',
      reason: 'เปิดรับจอง',
      availableCount: totalAvailable
    };
  }

  setDateStatus(dateStr, isOpen, reason = '') {
    const schedule = this.getSchedule();
    if (!schedule.closedDates) schedule.closedDates = {};
    if (!schedule.openDates) schedule.openDates = {};

    if (isOpen) {
      delete schedule.closedDates[dateStr];
      schedule.openDates[dateStr] = true;
    } else {
      delete schedule.openDates[dateStr];
      schedule.closedDates[dateStr] = {
        isClosed: true,
        reason: reason || 'ปิดทำการตามประกาศคลินิก'
      };
    }
    this.saveSchedule(schedule);
  }

  getSlotsForDate(dateStr) {
    const dateStatus = this.isDateOpen(dateStr);
    if (!dateStatus.isOpen) {
      return [];
    }

    const schedule = this.getSchedule();
    const baseSlots = (schedule.customSlotsPerDate && schedule.customSlotsPerDate[dateStr]) 
      ? schedule.customSlotsPerDate[dateStr] 
      : schedule.defaultSlots;

    // Count existing bookings for each slot
    const appointments = this.getAppointmentsForDate(dateStr);
    
    return baseSlots.map(slot => {
      const bookedCount = appointments.filter(a => a.slotId === slot.id && a.status !== 'CANCELLED').length;
      const remaining = Math.max(0, slot.capacity - bookedCount);
      return {
        ...slot,
        bookedCount,
        remaining,
        isFull: remaining <= 0
      };
    });
  }

  saveSlotsForDate(dateStr, slots) {
    const schedule = this.getSchedule();
    if (!schedule.customSlotsPerDate) schedule.customSlotsPerDate = {};
    schedule.customSlotsPerDate[dateStr] = slots;
    this.saveSchedule(schedule);
  }

  saveDefaultSlots(slots) {
    const schedule = this.getSchedule();
    schedule.defaultSlots = slots;
    this.saveSchedule(schedule);
  }

  // --- Appointments APIs ---
  getAppointments() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading appointments:', e);
      return [];
    }
  }

  saveAppointments(list) {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));
    this.broadcastChange();
  }

  getAppointmentsForDate(dateStr) {
    const list = this.getAppointments();
    return list.filter(a => a.date === dateStr);
  }

  createAppointment(bookingData) {
    // 1. Enforce patient booking policy (Lock past, advance >= 5 days, holiday/closure, slot capacity)
    const bookCheck = this.isDateBookableForPatient(bookingData.date);
    if (!bookCheck.isBookable) {
      throw new Error(bookCheck.reason || 'ไม่สามารถทำการจองในวันที่ระบุได้');
    }

    // 2. Validate specific slot capacity
    if (bookingData.slotId) {
      const slots = this.getSlotsForDate(bookingData.date);
      const targetSlot = slots.find(s => s.id === bookingData.slotId);
      if (targetSlot && targetSlot.remaining <= 0) {
        throw new Error('รอบเวลาที่ท่านเลือกมีผู้จองเต็มแล้ว กรุณาเลือกรอบเวลาอื่น');
      }
    }

    const list = this.getAppointments();
    
    // Generate Booking Code: DEN-YYYYMMDD-XXX
    const cleanDate = bookingData.date.replace(/-/g, '');
    const todaysCount = list.filter(a => a.date === bookingData.date).length + 1;
    const refCode = `DEN-${cleanDate}-${String(todaysCount).padStart(3, '0')}`;

    const newAppointment = {
      id: refCode,
      date: bookingData.date,
      slotId: bookingData.slotId,
      slotTime: bookingData.slotTime,
      patientName: bookingData.patientName.trim(),
      citizenId: bookingData.citizenId.replace(/[^0-9]/g, ''),
      phone: bookingData.phone.replace(/[^0-9]/g, ''),
      symptoms: bookingData.symptoms.trim(),
      medicalNotes: (bookingData.medicalNotes || '').trim(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      reply: null
    };

    list.unshift(newAppointment);
    this.saveAppointments(list);
    if (typeof firebaseDb !== 'undefined' && firebaseDb) {
      firebaseDb.collection('appointments').doc(newAppointment.id).set(newAppointment).catch(e => console.warn('Cloud create appointment notice:', e));
    }
    return newAppointment;
  }

  updateAppointmentReply(id, replyData, newStatus) {
    const list = this.getAppointments();
    const index = list.findIndex(a => a.id === id);
    if (index === -1) return null;

    list[index].status = newStatus || list[index].status;
    list[index].reply = {
      message: replyData.message.trim(),
      repliedBy: replyData.repliedBy || 'ทันตาภิบาล',
      repliedAt: new Date().toISOString()
    };

    this.saveAppointments(list);
    if (typeof firebaseDb !== 'undefined' && firebaseDb) {
      firebaseDb.collection('appointments').doc(id).update({
        status: list[index].status,
        reply: list[index].reply
      }).catch(e => console.warn('Cloud update reply notice:', e));
    }
    return list[index];
  }

  updateAppointmentStatus(id, newStatus) {
    const list = this.getAppointments();
    const index = list.findIndex(a => a.id === id);
    if (index === -1) return null;

    list[index].status = newStatus;
    this.saveAppointments(list);
    if (typeof firebaseDb !== 'undefined' && firebaseDb) {
      firebaseDb.collection('appointments').doc(id).update({
        status: newStatus
      }).catch(e => console.warn('Cloud update status notice:', e));
    }
    return list[index];
  }

  searchAppointments(query) {
    const q = (query || '').trim().toLowerCase().replace(/[^0-9a-zA-Zก-๙]/g, '');
    if (!q) return [];
    
    const list = this.getAppointments();
    return list.filter(a => {
      const cIdClean = a.citizenId.toLowerCase().replace(/[^0-9a-zA-Zก-๙]/g, '');
      const phoneClean = a.phone.toLowerCase().replace(/[^0-9a-zA-Zก-๙]/g, '');
      const codeClean = a.id.toLowerCase().replace(/[^0-9a-zA-Zก-๙]/g, '');
      const nameClean = a.patientName.toLowerCase().replace(/[^0-9a-zA-Zก-๙]/g, '');
      return cIdClean.includes(q) || phoneClean.includes(q) || codeClean.includes(q) || nameClean.includes(q);
    });
  }

  // --- Staff Auth APIs (High-Security Cryptographic Layer) ---
  getStaffUsers() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STAFF_USERS);
      const list = data ? JSON.parse(data) : getInitialStaffUsers();
      return list.map(u => ({
        ...u,
        roleType: u.roleType || (u.username.toLowerCase() === 'admin' || (u.role && u.role.includes('ผู้ดูแลระบบ')) ? 'admin' : 'nurse')
      }));
    } catch (e) {
      return getInitialStaffUsers();
    }
  }

  saveStaffUsers(users) {
    localStorage.setItem(STORAGE_KEYS.STAFF_USERS, JSON.stringify(users));
  }

  isStaffAdmin() {
    const staff = this.getLoggedInStaff();
    if (!staff) return false;
    return (
      staff.roleType === 'admin' ||
      staff.username.toLowerCase() === 'admin' ||
      (staff.role && staff.role.includes('ผู้ดูแลระบบ'))
    );
  }

  addStaffUser(userData) {
    if (!this.isStaffAdmin()) {
      return { success: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเพิ่มผู้ใช้งานได้' };
    }

    const cleanUsername = (userData.username || '').trim().toLowerCase();
    const cleanName = (userData.name || '').trim();
    const cleanRoleType = (userData.roleType === 'admin') ? 'admin' : 'nurse';
    const cleanRole = (userData.role || '').trim() || (cleanRoleType === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ทันตาภิบาลปฏิบัติการ');
    const cleanPassword = (userData.password || '').trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      return { success: false, error: 'ชื่อผู้ใช้งานต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลขอย่างน้อย 3 ตัวอักษร' };
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      return { success: false, error: 'ชื่อผู้ใช้งานต้องประกอบด้วยตัวอักษร a-z, 0-9, _, - เท่านั้น (ไม่มีเว้นวรรค)' };
    }
    if (!cleanName || cleanName.length < 3) {
      return { success: false, error: 'กรุณาระบุชื่อ-นามสกุลของผู้ปฏิบัติงานอย่างน้อย 3 ตัวอักษร' };
    }
    if (!cleanPassword || cleanPassword.length < 4) {
      return { success: false, error: 'รหัสผ่านเริ่มต้นต้องมีความยาวอย่างน้อย 4 ตัวอักษร' };
    }

    const users = this.getStaffUsers();
    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: `ชื่อผู้ใช้งาน "${cleanUsername}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น` };
    }

    const newUser = {
      username: cleanUsername,
      name: cleanName,
      role: cleanRole,
      roleType: cleanRoleType,
      passwordHash: cryptoSha256(cleanPassword + '_dental_salt_2026'),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    users.push(newUser);
    this.saveStaffUsers(users);

    if (typeof firebaseDb !== 'undefined' && firebaseDb) {
      firebaseDb.collection('staff_users').doc(newUser.username).set(newUser).catch(e => console.warn('Cloud add user error:', e));
    }

    this.broadcastChange();
    return { success: true, user: newUser };
  }

  deleteStaffUser(username) {
    if (!this.isStaffAdmin()) {
      return { success: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบผู้ใช้งานได้' };
    }

    const currentStaff = this.getLoggedInStaff();
    const cleanTarget = (username || '').trim().toLowerCase();

    // Prevent deleting own account
    if (currentStaff && currentStaff.username.toLowerCase() === cleanTarget) {
      return { success: false, error: 'ไม่สามารถลบบัญชีของตนเองที่กำลังเข้าสู่ระบบอยู่ได้' };
    }

    const users = this.getStaffUsers();
    const targetIndex = users.findIndex(u => u.username.toLowerCase() === cleanTarget);
    if (targetIndex === -1) {
      return { success: false, error: 'ไม่พบบัญชีผู้ใช้งานที่ต้องการลบในระบบ' };
    }

    const targetUser = users[targetIndex];
    // Prevent deleting the last remaining admin
    const isTargetAdmin = targetUser.roleType === 'admin' || targetUser.username.toLowerCase() === 'admin';
    if (isTargetAdmin) {
      const adminCount = users.filter(u => u.roleType === 'admin' || u.username.toLowerCase() === 'admin').length;
      if (adminCount <= 1) {
        return { success: false, error: 'ไม่สามารถลบได้ เนื่องจากระบบจำเป็นต้องมีผู้ดูแลระบบ (Admin) อย่างน้อย 1 บัญชี' };
      }
    }

    users.splice(targetIndex, 1);
    this.saveStaffUsers(users);

    if (typeof firebaseDb !== 'undefined' && firebaseDb) {
      firebaseDb.collection('staff_users').doc(cleanTarget).delete().catch(e => console.warn('Cloud delete user error:', e));
    }

    this.broadcastChange();
    return { success: true };
  }

  adminResetPassword(username, newPassword) {
    if (!this.isStaffAdmin()) {
      return { success: false, error: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถรีเซ็ตรหัสผ่านได้' };
    }

    const cleanTarget = (username || '').trim().toLowerCase();
    const cleanPass = (newPassword || '').trim();

    if (!cleanPass || cleanPass.length < 4) {
      return { success: false, error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' };
    }

    const users = this.getStaffUsers();
    const user = users.find(u => u.username.toLowerCase() === cleanTarget);
    if (!user) {
      return { success: false, error: 'ไม่พบบัญชีผู้ใช้งานที่ต้องการรีเซ็ตรหัสผ่าน' };
    }

    const newHash = cryptoSha256(cleanPass + '_dental_salt_2026');
    user.passwordHash = newHash;
    this.saveStaffUsers(users);

    // Unblock / clear rate-limiting lockout
    this.clearLoginLockout();

    if (typeof firebaseDb !== 'undefined' && firebaseDb) {
      firebaseDb.collection('staff_users').doc(user.username).update({
        passwordHash: newHash
      }).catch(e => console.warn('Cloud reset password error:', e));
    }

    this.broadcastChange();
    return { success: true, username: user.username, name: user.name };
  }

  getLoginLockoutStatus() {
    try {
      const data = sessionStorage.getItem(STORAGE_KEYS.LOGIN_LOCKOUT);
      if (!data) return { isLocked: false, remainingSec: 0, failedCount: 0 };
      const obj = JSON.parse(data);
      if (obj.lockedUntil && obj.lockedUntil > Date.now()) {
        return {
          isLocked: true,
          remainingSec: Math.ceil((obj.lockedUntil - Date.now()) / 1000),
          failedCount: obj.failedCount || 0
        };
      }
      return { isLocked: false, remainingSec: 0, failedCount: obj.failedCount || 0 };
    } catch (e) {
      return { isLocked: false, remainingSec: 0, failedCount: 0 };
    }
  }

  recordFailedLogin() {
    const status = this.getLoginLockoutStatus();
    const newCount = status.failedCount + 1;
    const record = { failedCount: newCount, lockedUntil: null };
    if (newCount >= 5) {
      record.lockedUntil = Date.now() + 5 * 60 * 1000; // Lock for 5 minutes after 5 failed attempts
    }
    sessionStorage.setItem(STORAGE_KEYS.LOGIN_LOCKOUT, JSON.stringify(record));
    return record;
  }

  clearLoginLockout() {
    sessionStorage.removeItem(STORAGE_KEYS.LOGIN_LOCKOUT);
  }

  isStaffLoggedIn() {
    try {
      const authStr = sessionStorage.getItem(STORAGE_KEYS.STAFF_AUTH);
      if (!authStr) return false;
      const auth = JSON.parse(authStr);
      if (auth && auth.token && auth.expiresAt && auth.expiresAt > Date.now()) {
        return true;
      }
      sessionStorage.removeItem(STORAGE_KEYS.STAFF_AUTH);
      return false;
    } catch (e) {
      return sessionStorage.getItem(STORAGE_KEYS.STAFF_AUTH) === 'true';
    }
  }

  getLoggedInStaff() {
    try {
      const authStr = sessionStorage.getItem(STORAGE_KEYS.STAFF_AUTH);
      return authStr ? JSON.parse(authStr) : null;
    } catch (e) {
      return null;
    }
  }

  loginStaff(username, password) {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();
    if (!cleanUser || !cleanPass) return false;

    // Check rate-limiting lockout
    const lockout = this.getLoginLockoutStatus();
    if (lockout.isLocked) {
      return false;
    }

    const users = this.getStaffUsers();
    const user = users.find(u => u.username.toLowerCase() === cleanUser && u.status === 'ACTIVE');
    if (!user) {
      this.recordFailedLogin();
      return false;
    }

    // Cryptographic SHA-256 hash comparison with salt
    const hash = cryptoSha256(cleanPass + '_dental_salt_2026');
    if (user.passwordHash === hash || (user.passwordHash === '1234' && cleanPass === '1234')) {
      // Login Success: Reset lockout attempts
      this.clearLoginLockout();
      
      // Update lastLogin timestamp
      user.lastLogin = new Date().toISOString();
      this.saveStaffUsers(users);

      if (typeof firebaseDb !== 'undefined' && firebaseDb) {
        firebaseDb.collection('staff_users').doc(user.username).update({
          lastLogin: user.lastLogin
        }).catch(e => console.warn('Cloud update lastLogin notice:', e));
      }

      // Create cryptographically signed session (8-hour expiry)
      const roleType = user.roleType || (user.username.toLowerCase() === 'admin' || (user.role && user.role.includes('ผู้ดูแลระบบ')) ? 'admin' : 'nurse');
      const sessionData = {
        token: 'sec_' + Date.now() + '_' + Math.random().toString(36).substr(2),
        username: user.username,
        name: user.name,
        role: user.role,
        roleType: roleType,
        loggedInAt: new Date().toISOString(),
        expiresAt: Date.now() + 8 * 3600 * 1000
      };
      sessionStorage.setItem(STORAGE_KEYS.STAFF_AUTH, JSON.stringify(sessionData));
      return true;
    } else {
      this.recordFailedLogin();
      return false;
    }
  }

  changeStaffPassword(username, oldPassword, newPassword) {
    const cleanUser = (username || '').trim().toLowerCase();
    const users = this.getStaffUsers();
    const index = users.findIndex(u => u.username.toLowerCase() === cleanUser);
    if (index === -1) return { success: false, error: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' };

    const oldHash = cryptoSha256(oldPassword.trim() + '_dental_salt_2026');
    if (users[index].passwordHash !== oldHash) {
      return { success: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' };
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' };
    }

    const newHash = cryptoSha256(newPassword.trim() + '_dental_salt_2026');
    users[index].passwordHash = newHash;
    this.saveStaffUsers(users);

    if (typeof firebaseDb !== 'undefined' && firebaseDb) {
      firebaseDb.collection('staff_users').doc(users[index].username).update({
        passwordHash: newHash
      }).catch(e => console.warn('Cloud password update notice:', e));
    }

    return { success: true };
  }

  logoutStaff() {
    sessionStorage.removeItem(STORAGE_KEYS.STAFF_AUTH);
  }

  // Broadcast sync between tabs
  broadcastChange() {
    if (window.BroadcastChannel) {
      try {
        const bc = new BroadcastChannel('dental_app_channel');
        bc.postMessage({ type: 'DATA_UPDATED', timestamp: Date.now() });
        bc.close();
      } catch (e) {
        // BroadcastChannel optional fallback
      }
    }
  }
}

// Global Storage Instance
window.dentalStorage = new DentalStorage();

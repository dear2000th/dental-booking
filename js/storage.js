/**
 * Dental Clinic Queue System - Storage & Data Layer
 * Handles LocalStorage persistence, synchronization, and business logic
 */

const STORAGE_KEYS = {
  APPOINTMENTS: 'dental_app_appointments',
  SCHEDULE: 'dental_app_schedule',
  STAFF_AUTH: 'dental_app_staff_auth'
};

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
    
    // Check specific date override first
    if (schedule.closedDates && schedule.closedDates[dateStr] && schedule.closedDates[dateStr].isClosed) {
      return { isOpen: false, reason: schedule.closedDates[dateStr].reason || 'ปิดทำการ' };
    }
    if (schedule.openDates && schedule.openDates[dateStr]) {
      return { isOpen: true, reason: 'เปิดให้บริการพิเศษ' };
    }

    // Check weekly standard days (0=Sunday, 6=Saturday)
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    const isStandardOpen = schedule.defaultWeeklyDays.includes(dayOfWeek);
    
    if (isStandardOpen) {
      return { isOpen: true, reason: 'เปิดให้บริการปกติ' };
    } else {
      return { isOpen: false, reason: 'ปิดทำการประจำสัปดาห์ (เสาร์-อาทิตย์)' };
    }
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

  // --- Staff Auth APIs ---
  isStaffLoggedIn() {
    return sessionStorage.getItem(STORAGE_KEYS.STAFF_AUTH) === 'true';
  }

  loginStaff(username, password) {
    if ((username === 'nurse' || username === 'admin') && password === '1234') {
      sessionStorage.setItem(STORAGE_KEYS.STAFF_AUTH, 'true');
      return true;
    }
    return false;
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

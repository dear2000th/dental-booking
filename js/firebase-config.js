// ============================================================
// Firebase Cloud Firestore Configuration
// Project: dental-khuanlang (Hospital Promoting Hospital Khuan Lang)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDtTxYKVar9_J9u6YnbgdqvBpPX7Rux0HU",
  authDomain: "dental-khuanlang.firebaseapp.com",
  projectId: "dental-khuanlang",
  storageBucket: "dental-khuanlang.firebasestorage.app",
  messagingSenderId: "260575157794",
  appId: "1:260575157794:web:c109cfd07032854c7c747b",
  measurementId: "G-WYYPG322C4"
};

// Initialize Firebase App & Firestore Database
let firebaseDb = null;
let isFirebaseOnline = false;

try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    firebaseDb = firebase.firestore();
    isFirebaseOnline = true;
    console.log('✅ Google Cloud Firestore เชื่อมต่อสำเร็จ: dental-khuanlang');
  } else {
    console.warn('⚠️ ไม่พบ Firebase SDK หรือทำงานในโหมด Local');
  }
} catch (err) {
  console.warn('⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อ Firebase (ใช้งานโหมด Local Storage):', err);
}

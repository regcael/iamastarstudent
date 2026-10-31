import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB913d4s5DkXQRwDiyTX9NTpyF-Ut1MaNk",
  authDomain: "highachievers-283f1.firebaseapp.com",
  projectId: "highachievers-283f1",
  storageBucket: "highachievers-283f1.firebasestorage.app",
  messagingSenderId: "381374978361",
  appId: "1:381374978361:web:4155c52245f00d6c44f0e8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let xp = 0;
let logs = [];
let isProUnlocked = false;

// New Timer Variables
let sprintActive = false;
let isPaused = false;
let timerInterval = null;
let durationMs = 15 * 60 * 1000;
let remainingMs = durationMs;

let currentSubject = 'General Studies';
let currentActivity = 'Reading';
let currentActivityXp = 20;

// Auth Listeners
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('authScreen').classList.add('hidden');
    await loadUserData(user.uid);
  } else {
    currentUser = null;
    document.getElementById('authScreen').classList.remove('hidden');
  }
});

// Mobile Auth Fix: Looping Glow & Auto-Scroll
function handleAuthError() {
  const errBox = document.getElementById('authErrorMsg');
  const agreeCheckbox = document.getElementById('agreeTosCheckbox');
  
  if (!agreeCheckbox.checked) {
    errBox.textContent = "Please agree to the Terms of Service to continue.";
    errBox.classList.remove('hidden');
    
    const tosContainer = document.getElementById('tosCheckboxContainer');
    tosContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    tosContainer.classList.remove('animate-gentle-attention');
    void tosContainer.offsetWidth; // Trigger reflow
    tosContainer.classList.add('animate-gentle-attention');
    return true;
  }
  return false;
}

document.getElementById('agreeTosCheckbox').addEventListener('change', function() {
  if (this.checked) {
    document.getElementById('tosCheckboxContainer').classList.remove('animate-gentle-attention');
  }
});

// Auth Bindings
if(document.getElementById('googleSignInBtn')) {
  document.getElementById('googleSignInBtn').onclick = async () => {
    if (handleAuthError()) return;
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (err) { document.getElementById('authErrorMsg').textContent = err.message; }
  };
}

// Database Interactions
async function loadUserData(uid) {
  const docRef = doc(db, 'students', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    xp = data.xp || 0;
    logs = data.logs || [];
    isProUnlocked = data.isPro || false;
  } else {
    await setDoc(docRef, { xp: 0, logs: [], isPro: false });
  }
  updateStatsUI();
}

async function saveUserData() {
  if (!currentUser) return;
  const docRef = doc(db, 'students', currentUser.uid);
  await setDoc(docRef, { xp, logs }, { merge: true }); 
}

function updateStatsUI() {
  const xpBadge = document.getElementById('stickyXpText');
  if(xpBadge) xpBadge.textContent = `${xp} XP`;
  saveUserData();
}

// Custom Activity Handling
window.selectActivity = function(activity, xpValue) {
  currentActivity = activity;
  currentActivityXp = xpValue;
  
  if (activity === 'Custom Study Sprint') {
    document.getElementById('customActivityInputSection').classList.remove('hidden');
  } else {
    document.getElementById('customActivityInputSection').classList.add('hidden');
  }
}

window.updateSubject = function(val) {
    currentSubject = val.trim() !== '' ? val : 'General Studies';
}

window.logHabitXP = function(habitName, amount, msg) {
    xp += amount;
    updateStatsUI();
    const toast = document.getElementById('actionToast');
    document.getElementById('actionToastMsg').textContent = `✨ ${msg}! +${amount} XP`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3200);
}

// Timer Logic with Pause and Custom Time
document.getElementById('timerDurationSelect').addEventListener('change', (e) => {
  if(e.target.value === 'custom') {
    const customMins = prompt("Enter custom minutes:");
    if(customMins && !isNaN(customMins)) {
      durationMs = customMins * 60 * 1000;
    } else {
      e.target.value = "15"; // fallback
      durationMs = 15 * 60 * 1000;
    }
  } else {
    durationMs = parseInt(e.target.value) * 60 * 1000;
  }
  if(!sprintActive) resetTimerDisplay();
});

function resetTimerDisplay() {
  remainingMs = durationMs;
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  document.getElementById('hourglassTimerText').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerUI() {
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  document.getElementById('hourglassTimerText').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

document.getElementById('startSprintBtn').onclick = () => {
  sprintActive = true;
  isPaused = false;
  document.getElementById('startSprintBtn').classList.add('hidden');
  document.getElementById('pauseSprintBtn').classList.remove('hidden');
  document.getElementById('stopSprintBtn').classList.remove('hidden');
  document.getElementById('hourglassStatusText').textContent = 'Sand Flowing...';
  
  timerInterval = setInterval(() => {
    if (!isPaused) {
      remainingMs -= 1000;
      updateTimerUI();
      if (remainingMs <= 0) completeSprint();
    }
  }, 1000);
};

document.getElementById('pauseSprintBtn').onclick = () => {
  isPaused = true;
  document.getElementById('pauseSprintBtn').classList.add('hidden');
  document.getElementById('resumeSprintBtn').classList.remove('hidden');
  document.getElementById('hourglassStatusText').textContent = 'Paused';
};

document.getElementById('resumeSprintBtn').onclick = () => {
  isPaused = false;
  document.getElementById('resumeSprintBtn').classList.add('hidden');
  document.getElementById('pauseSprintBtn').classList.remove('hidden');
  document.getElementById('hourglassStatusText').textContent = 'Sand Flowing...';
};

document.getElementById('stopSprintBtn').onclick = () => {
  clearInterval(timerInterval);
  sprintActive = false;
  isPaused = false;
  resetTimerDisplay();
  
  document.getElementById('startSprintBtn').classList.remove('hidden');
  document.getElementById('pauseSprintBtn').classList.add('hidden');
  document.getElementById('resumeSprintBtn').classList.add('hidden');
  document.getElementById('stopSprintBtn').classList.add('hidden');
  document.getElementById('hourglassStatusText').textContent = 'Ready to Flow';
};

function completeSprint() {
  clearInterval(timerInterval);
  
  // Custom Name Logging Logic
  let activityName = currentActivity;
  if(currentActivity === 'Custom Study Sprint') {
    const customName = document.getElementById('customActivityName').value.trim();
    if(customName) activityName = `Custom: ${customName}`;
  }
  
  xp += currentActivityXp;
  updateStatsUI();
  const toast = document.getElementById('actionToast');
  document.getElementById('actionToastMsg').textContent = `✨ Sprint Completed! +${currentActivityXp} XP`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3200);
  
  resetTimerDisplay();
  document.getElementById('startSprintBtn').onclick(); // Auto-restart next sprint
}

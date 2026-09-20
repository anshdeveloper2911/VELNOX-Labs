import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB5QPgEDVDPj56gVSKWwOZxnDQOw_6UEJ8',
  authDomain: 'velnoxapp.firebaseapp.com',
  projectId: 'velnoxapp',
  storageBucket: 'velnoxapp.firebasestorage.app',
  messagingSenderId: '436554485752',
  appId: '1:436554485752:web:d6567aa8c09017e528100d',
  measurementId: 'G-S5GQY8KTVF'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const $ = (selector) => document.querySelector(selector);

function setAuthUI(user) {
  const login = $('#velnox-login');
  const account = $('#velnox-account');
  const avatar = $('#velnox-avatar');
  const name = $('#velnox-user-name');
  if (!login || !account) return;
  login.hidden = Boolean(user);
  account.hidden = !user;
  if (user) {
    if (avatar) avatar.src = user.photoURL || 'assets/favicon.png';
    if (name) name.textContent = user.displayName || user.email || 'Account';
  }
}

window.VELNOX_USER = null;
window.VELNOX_SIGN_IN = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    alert(error.code === 'auth/popup-blocked' ? 'Please allow popups for this site.' : 'Google login failed. Please try again.');
  }
};
window.VELNOX_SIGN_OUT = () => signOut(auth).catch(console.error);

onAuthStateChanged(auth, (user) => {
  window.VELNOX_USER = user;
  setAuthUI(user);
  document.dispatchEvent(new CustomEvent('velnoxAuthChanged', { detail: user }));
});


const authModal = document.querySelector('#velnox-auth-modal');
const closeAuthModal = () => {
  if (authModal) authModal.hidden = true;
  document.body.classList.remove('auth-modal-open');
};
window.VELNOX_OPEN_AUTH = () => {
  if (!authModal) return;
  authModal.hidden = false;
  document.body.classList.add('auth-modal-open');
};
document.querySelectorAll('[data-auth-close]').forEach((element) => {
  element.addEventListener('click', closeAuthModal);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeAuthModal();
});
const originalSignIn = window.VELNOX_SIGN_IN;
window.VELNOX_SIGN_IN = async () => {
  await originalSignIn?.();
  closeAuthModal();
};

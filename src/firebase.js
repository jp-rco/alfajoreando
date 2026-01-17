// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCA0Bxm76R_f1cAElln_kHlSoYO5tNTWM0",
  authDomain: "alfajoreando-d7fef.firebaseapp.com",
  projectId: "alfajoreando-d7fef",
  storageBucket: "alfajoreando-d7fef.firebasestorage.app",
  messagingSenderId: "338119529502",
  appId: "1:338119529502:web:54049b28a1f1ba1d648a0f",
  measurementId: "G-VHS98MVKC6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);

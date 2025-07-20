// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCSDKMADOppPN_MXtIR2W8fAqV_dVU9FN4",
    authDomain: "gestorclientestad.firebaseapp.com",
    projectId: "gestorclientestad",
    storageBucket: "gestorclientestad.firebasestorage.app",
    messagingSenderId: "160832989277",
    appId: "1:160832989277:web:d2522269812d9d3381c5b4",
    measurementId: "G-BKBQEE5Z7Y"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAxS94kQcWjc7NmnfTdEAOq5g9OBVO0c7s",
    authDomain: "pocket-6-4be46.firebaseapp.com",
    projectId: "pocket-6-4be46",
    storageBucket: "pocket-6-4be46.firebasestorage.app",
    messagingSenderId: "42030089552",
    appId: "1:42030089552:web:f003ccf778a88283b1d855",
    measurementId: "G-9HYV2XLVRV"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

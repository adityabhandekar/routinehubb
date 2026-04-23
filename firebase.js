const firebaseConfig = {
    apiKey: "AIzaSyDpsV1bhJU1yPvSdCM8cOrhd9CQwLqq2x0",
    authDomain: "routine-6c88f.firebaseapp.com",
    projectId: "routine-6c88f",
    storageBucket: "routine-6c88f.firebasestorage.app",
    messagingSenderId: "143702093059",
    appId: "1:143702093059:web:dd383a289b6e99cfc24d36"

};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const messaging = firebase.messaging();
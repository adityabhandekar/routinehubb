importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDpsV1bhJU1yPvSdCM8cOrhd9CQwLqq2x0",
    authDomain: "routine-6c88f.firebaseapp.com",
    projectId: "routine-6c88f",
    messagingSenderId: "143702093059",
    appId: "1:143702093059:web:dd383a289b6e99cfc24d36"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
  });
});
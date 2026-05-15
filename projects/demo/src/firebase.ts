import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyD44r_UmJDdHMlhz_3hi1xmJEUwlJGzb3s',
  authDomain: 'ngx-document-signer.firebaseapp.com',
  projectId: 'ngx-document-signer',
  storageBucket: 'ngx-document-signer.firebasestorage.app',
  messagingSenderId: '474613769046',
  appId: '1:474613769046:web:12db0452e2cc319f57ecf7',
  measurementId: 'G-15137CGFSE'
};

export const firebaseApp = initializeApp(firebaseConfig);

if (firebaseConfig.measurementId) {
  void isSupported().then((supported) => {
    if (supported) {
      const analytics = getAnalytics(firebaseApp);
      logEvent(analytics, 'page_view', {
        page_location: window.location.href,
        page_path: window.location.pathname,
        page_title: document.title
      });
    }
  });
}

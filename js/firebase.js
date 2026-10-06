import {initializeApp} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {getAuth} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,getFirestore} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig={
  apiKey:"AIzaSyCYEe6hR3GVd8S_rWB8_Y08FELShxMJ7F4",
  authDomain:"chat-262f9.firebaseapp.com",
  projectId:"chat-262f9",
  storageBucket:"chat-262f9.firebasestorage.app",
  messagingSenderId:"641073259211",
  appId:"1:641073259211:web:27a919cf6875ccb8c5f14e"
};

const app=initializeApp(firebaseConfig);
export const auth=getAuth(app);

// local cache: padha hua data phone yaad rakhta hai, to reads kam lagte hain
let _db;
try{_db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})})}
catch(e){_db=getFirestore(app)}
export const db=_db;

export const MAILDOMAIN="baatify.app";   // baad mein kabhi mat badalna
export const mail=u=>u+"@"+MAILDOMAIN;
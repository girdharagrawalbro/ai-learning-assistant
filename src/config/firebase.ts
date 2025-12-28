// Firebase configuration
// Replace these values with your actual Firebase project configuration
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

// Google Gemini API configuration
export const geminiConfig = {
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || "your-gemini-api-key",
  // Use gemini-1.5-pro for paid tier with higher limits
  // Or gemini-2.5-flash for free tier (60 requests/minute)
  model: "gemini-2.5-flash"
};

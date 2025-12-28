# AI Study Buddy - AI-Powered Learning Assistant

An interactive educational web application that leverages Google's Gemini AI to help students learn more effectively. Features include an AI chatbot for answering questions, automatic quiz generation from study materials, and personalized learning paths with progress tracking.

<img width="2108" height="991" alt="image" src="https://github.com/user-attachments/assets/5235d751-db9a-4e4a-998f-45d0344a20d4" />



## 🌟 Features

### 🤖 AI Study Buddy Chatbot
- Powered by Google Gemini AI (gemini-2.5-flash model)
- Context-aware responses using your uploaded study materials
- Markdown-formatted explanations with code highlighting
- Chat history preservation for continued conversations
- Friendly, encouraging, and educational tone

### 📝 Smart Quiz Generator
- Upload lecture notes (TXT, MD, PDF, DOC, DOCX)
- AI automatically extracts key concepts
- Generate custom quizzes with configurable:
  - Number of questions (5-20)
  - Difficulty level (Easy/Medium/Hard)
  - Subject area
- Instant scoring with detailed explanations
- Track quiz attempts and performance

### 📚 Study Materials Management
- Upload and organize lecture notes
- AI-powered content summarization
- Automatic key concept extraction
- Tag-based organization
- Search and filter capabilities

### 🎯 Personalized Learning Path
- Track study progress and streaks
- View quiz score history with charts
- Topic mastery visualization
- AI-generated study recommendations
- Achievement system with badges
- Identify strengths and weak areas

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Lucide React** for icons
- **React Markdown** for content rendering
- **React Dropzone** for file uploads

### Backend
- **Firebase Firestore** - Real-time NoSQL database
- **Firebase Authentication** - Google Sign-In
- **Firebase Cloud Functions** - Serverless backend
- **Firebase Hosting** - Web app deployment

### AI/ML
- **Google Gemini API** (gemini-2.5-flash) - AI chat and content generation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- A Firebase project
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   cd ai-learning-assistant
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   npm install

   # Install Cloud Functions dependencies
   cd functions
   npm install
   cd ..
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   ```

   Edit `.env` with your Firebase and Gemini API credentials:
   ```env
   VITE_FIREBASE_API_KEY=your-firebase-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_GEMINI_API_KEY=your-gemini-api-key
   ```

4. **Set up Firebase**
   ```bash
   # Login to Firebase
   firebase login

   # Initialize Firebase (select your project)
   firebase use your-project-id
   ```

5. **Configure Cloud Functions Gemini API key**
   ```bash
   firebase functions:config:set gemini.apikey="your-gemini-api-key"
   ```

6. **Deploy Firestore rules and indexes**
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

### Development

```bash
# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Running Firebase Emulators

```bash
# Start Firebase emulators for local development
firebase emulators:start
```

### Building for Production

```bash
# Build the frontend
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Deploy Cloud Functions
firebase deploy --only functions
```

## 📁 Project Structure

```
ai-learning-assistant/
├── src/
│   ├── components/
│   │   ├── LandingPage.tsx      # Welcome page with sign-in
│   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   ├── StudyBuddyChat.tsx   # AI chatbot interface
│   │   ├── QuizGenerator.tsx    # Quiz creation and taking
│   │   ├── StudyMaterials.tsx   # Material management
│   │   └── LearningPath.tsx     # Progress tracking
│   ├── context/
│   │   └── AppContext.tsx       # Global state management
│   ├── services/
│   │   ├── geminiService.ts     # Gemini AI integration
│   │   └── firebaseService.ts   # Firebase operations
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   ├── config/
│   │   └── firebase.ts          # Firebase configuration
│   ├── App.tsx                  # Main application
│   ├── main.tsx                 # Entry point
│   └── index.css                # Global styles
├── functions/
│   └── src/
│       └── index.ts             # Cloud Functions
├── firebase.json                # Firebase configuration
├── firestore.rules              # Security rules
├── firestore.indexes.json       # Database indexes
└── README.md
```

## 🔐 Firebase Setup Guide

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" and follow the setup wizard
3. Enable Google Analytics (optional)

### 2. Enable Authentication
1. Go to Authentication > Sign-in method
2. Enable Google provider
3. Add your domain to authorized domains

### 3. Create Firestore Database
1. Go to Firestore Database
2. Create database in production mode
3. Deploy the security rules from this project

### 4. Get Firebase Configuration
1. Go to Project Settings > General
2. Scroll to "Your apps" and click the web icon (</>)
3. Register your app and copy the configuration

## 🤖 Gemini API Setup

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add the key to your `.env` file and Firebase config

## 📊 Database Schema

### Collections

- **users** - User profiles
- **studyMaterials** - Uploaded study content
- **chatSessions** - Chat history
- **quizzes** - Generated quizzes
- **quizAttempts** - Quiz results
- **learningProgress** - Progress tracking
- **dailyGoals** - Daily study goals
- **chatLogs** - Analytics (admin only)

## 🎨 Customization

### Theming
Edit `tailwind.config.js` to customize colors:
```javascript
colors: {
  primary: {
    // Your primary color palette
  },
  accent: {
    // Your accent color palette
  }
}
```

### AI Behavior
Modify the system prompts in `geminiService.ts` to customize the AI's personality and response style.

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🔒 Security

- Firebase Authentication protects all routes
- Firestore security rules ensure data isolation
- API keys are stored in environment variables
- No sensitive data exposed to client

## 🧪 Testing

```bash
# Run tests (when configured)
npm test

# Run Firebase security rules tests
npm run test:rules
```

## 📈 Analytics & Monitoring

Consider adding:
- Firebase Analytics for user behavior
- Firebase Performance Monitoring
- Firebase Crashlytics for error tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Google Gemini AI for powering the intelligent features
- Firebase for the backend infrastructure
- Tailwind CSS for the beautiful styling
- The React community for amazing tools and libraries

---

Built with ❤️ for students everywhere | Powered by Google AI & Firebase

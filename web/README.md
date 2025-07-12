# Firebase Authentication App

A React application with Firebase authentication supporting email/password and Google sign-in.

## Features

- 🔐 Email and password authentication
- 🌐 Google OAuth authentication
- 📱 Responsive design
- 🎨 Modern UI with gradient backgrounds
- 🔄 Automatic authentication state management

## Setup

### 1. Firebase Configuration

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication in your Firebase project:
   - Go to Authentication > Sign-in method
   - Enable Email/Password
   - Enable Google sign-in
3. Get your Firebase configuration:
   - Go to Project Settings > General
   - Scroll down to "Your apps" section
   - Click on the web app icon (</>) to add a web app
   - Copy the configuration object

### 2. Update Firebase Config

Replace the placeholder configuration in `src/firebase.ts` with your actual Firebase config:

```typescript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
src/
├── components/
│   ├── AuthForm.tsx      # Authentication form component
│   ├── AuthPage.tsx      # Auth page with login/register toggle
│   └── Dashboard.tsx     # Main dashboard (placeholder)
├── contexts/
│   └── AuthContext.tsx   # Authentication context and hooks
├── firebase.ts           # Firebase configuration
├── App.tsx              # Main app component
└── main.tsx             # App entry point
```

## Usage

1. **Unauthenticated Users**: Will see the authentication page with options to sign in or register
2. **Authenticated Users**: Will be redirected to the dashboard
3. **Logout**: Use the logout button in the dashboard header

## Next Steps

- Add your main app features to the Dashboard component
- Implement user profile management
- Add additional authentication providers (GitHub, Twitter, etc.)
- Set up Firestore for data storage
- Add protected routes and role-based access control

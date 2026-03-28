# Anis Brothers Savings Management

A community-driven savings and expense management application built with React, Vite, Tailwind CSS, and Firebase.

## Features
- **Dashboard:** Real-time summary of total savings, income, expenses, and net balance.
- **Member Management:** Register and manage community members and their shares.
- **Transaction History:** Record and track deposits and withdrawals for each member.
- **Income & Expense Tracking:** Manage general community funds with categorized records.
- **Full Activity History:** A unified view of all financial activities.
- **Admin Controls:** Secure administrative access for data entry and member management.

## Tech Stack
- **Frontend:** React 19, Vite, Tailwind CSS, Motion (Framer Motion)
- **Backend:** Firebase (Firestore, Authentication)
- **Icons:** Lucide React
- **Date Handling:** date-fns

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone <your-repository-url>
   cd anis-brothers-savings
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up Firebase:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
   - Enable Firestore and Google Authentication.
   - Copy your Firebase configuration to `src/firebase.ts` or create a `firebase-applet-config.json` file in the root directory.
4. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment
This project is ready for deployment to any static hosting provider (GitHub Pages, Vercel, Netlify, etc.).

### Build for Production
```bash
npm run build
```

## License
MIT

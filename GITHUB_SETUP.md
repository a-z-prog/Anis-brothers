# GitHub Setup Instructions

To take this project to GitHub and set up a CI/CD pipeline, follow these steps:

## 1. Create a New Repository on GitHub
- Go to [GitHub](https://github.com/) and create a new public or private repository.
- Do **not** initialize it with a README, `.gitignore`, or license (since we already have them).

## 2. Push Your Code to GitHub
Open your terminal and run the following commands:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```

## 3. Set Up GitHub Actions (CI/CD)
GitHub Actions will automatically build and test your code every time you push changes.

### Option A: Use the existing workflow file
Since I've already created `.github/workflows/ci.yml`, GitHub will automatically detect it once you push your code.

### Option B: "Set up a workflow yourself"
If you want to manually create it on GitHub:
1. Go to your repository on GitHub.
2. Click on the **Actions** tab.
3. Click on **"set up a workflow yourself"**.
4. Copy and paste the following code into the editor:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run Lint
      run: npm run lint

    - name: Build project
      run: npm run build
      env:
        VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
        VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
        VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
        VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
        VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
        VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
        VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
        VITE_FIRESTORE_DATABASE_ID: ${{ secrets.VITE_FIRESTORE_DATABASE_ID }}
```

## 4. Configure GitHub Secrets
For the build to succeed, you need to add your Firebase configuration as secrets in GitHub:
1. Go to your repository on GitHub.
2. Click on **Settings** > **Secrets and variables** > **Actions**.
3. Click on **New repository secret**.
4. Add the following secrets (get the values from your `firebase-applet-config.json`):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
   - `VITE_FIRESTORE_DATABASE_ID`

## 5. Deployment (Optional)
If you want to deploy to GitHub Pages, you can add a deployment job to the workflow.
Alternatively, you can connect your repository to Vercel or Netlify for automatic deployments.

# YusraPOS Netlify Deployment Guide

This application is pre-configured for seamless deployment to **Netlify**, including support for its cloud-based features and API routes.

## Deployment Steps

### 1. Connect to GitHub
The easiest way to deploy is to connect your GitHub repository to Netlify:
1. Log in to [Netlify](https://app.netlify.com/).
2. Click **"Add new site"** > **"Import an existing project"**.
3. Select **GitHub** and choose your `YusraPOS` repository.

### 2. Build Settings
Netlify should automatically detect the settings from `netlify.toml`, but verify they match:
- **Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Functions Directory:** `netlify/functions`

### 3. Environment Variables
If you have any custom API keys (like a real Stripe key or custom Firebase settings), add them in Netlify:
1. Go to **Site Configuration** > **Environment variables**.
2. Add your variables (e.g., `GEMINI_API_KEY`, `VITE_STRIPE_PUBLIC_KEY`).
3. *Note: The Firebase configuration is already bundled into the frontend from `firebase-applet-config.json`.*

### 4. Domain Authorization (CRITICAL)
Once your app is deployed (e.g., `yusra-pos.netlify.app`), you **MUST** authorize this domain in Firebase:
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project > **Authentication** > **Settings** > **Authorized Domains**.
3. Add your Netlify URL (e.g., `yusra-pos.netlify.app`).

## Features Included
- **SPA Routing:** All frontend routes are automatically handled (no 404s on refresh).
- **API Backend:** The Express server is automatically converted to a **Netlify Function**, allowing `/api/health` and other routes to work in the cloud.
- **HTTPS:** Netlify provides automatic SSL/HTTPS for your domain.

## Local Testing
To test the Netlify environment locally:
1. Install Netlify CLI: `npm install -g netlify-cli`
2. Run: `netlify dev`

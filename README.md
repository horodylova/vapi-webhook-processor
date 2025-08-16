# VAPI Webhook Processor
A Next.js application that processes VAPI webhooks with Firebase storage and signature verification.

## Quick Deploy
1. 1.
   Clone and push to GitHub
2. 2.
   Deploy to Netlify - connect your GitHub repo
3. 3.
   Set environment variables in Netlify:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_k
   ey
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_p
   roject.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_pr
   oject_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=you
   r_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_I
   D=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=you
   r_measurement_id
   VAPI_KEY=your_vapi_secret_key
   ```
## Webhook Endpoint
URL: https://your-app.netlify.app/api/webhook Method: POST Headers: x-vapi-signature (HMAC SHA-256)

## Features
✅ Signature Verification - Validates VAPI webhook signatures ✅ Idempotency - Prevents duplicate webhook processing ✅ Firebase Storage - Stores webhook data in Firestore ✅ Real-time Dashboard - View recent webhooks

## Local Development
```
npm install
npm run dev
```
Create .env.local with the same environment variables (without NEXT_PUBLIC_ prefix for server-side vars). 
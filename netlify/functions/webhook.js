const { createHmac } = require('crypto');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, Timestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    const vapiSecret = process.env.VAPI_WEBHOOK_SECRET;
    
    if (!vapiSecret) {
      console.error('VAPI_WEBHOOK_SECRET not found');
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Server configuration error' })
      };
    }

    const rawBody = event.body;
    const vapiSignature = event.headers['x-vapi-signature'];
    
    console.log('Received signature:', vapiSignature);
    console.log('Body length:', rawBody.length);
    
    const hmac = createHmac('sha256', vapiSecret);
    const generatedSignature = 'sha256=' + hmac.update(rawBody, 'utf8').digest('hex');
    
    console.log('Generated signature:', generatedSignature);
    
    if (!vapiSignature || !vapiSignature.startsWith('sha256=')) {
      console.error('Invalid signature format:', vapiSignature);
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid signature format' })
      };
    }
    
    if (vapiSignature !== generatedSignature) {
      console.error('Signature mismatch');
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized' })
      };
    }
    
    const requestBody = JSON.parse(rawBody);
    const callId = requestBody.call?.id || requestBody.id;
    
    if (!callId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing call ID' })
      };
    }
    
    const docRef = doc(db, 'webhooks', callId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Webhook already processed' })
      };
    }
    
    await setDoc(docRef, {
      callId: callId,
      call: requestBody.call,
      type: requestBody.type,
      data: requestBody,
      timestamp: Timestamp.now(),
      processedAt: new Date().toISOString(),
      signature: vapiSignature
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' })
    };
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

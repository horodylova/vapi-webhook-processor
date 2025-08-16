import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

export async function POST(request) {
  try {
     
    const vapiSecret = process.env.VAPI_KEY;
     
    if (!vapiSecret) {
      console.error('VAPI_KEY не найден в переменных окружения');
      return NextResponse.json({ 
        message: 'Server configuration error',
        debug: 'Missing VAPI_KEY' 
      }, { status: 500 });
    }

    const rawBody = await request.text();
    const vapiSignature = request.headers.get('x-vapi-signature');
    
    console.log('Received signature:', vapiSignature);
    console.log('Body length:', rawBody.length);
    console.log('Secret length:', vapiSecret.length);
     
    const hmac = createHmac('sha256', vapiSecret);
    const generatedSignature = 'sha256=' + hmac.update(rawBody, 'utf8').digest('hex');
    
    console.log('Generated signature:', generatedSignature);
    
    if (!vapiSignature || !vapiSignature.startsWith('sha256=')) {
      console.error('Invalid signature format:', vapiSignature);
      return NextResponse.json({ 
        message: 'Invalid signature format',
        debug: `Expected sha256=..., got: ${vapiSignature}` 
      }, { status: 401 });
    }
    
    if (vapiSignature !== generatedSignature) {
      console.error('Signature mismatch');
      console.error('Expected:', generatedSignature);
      console.error('Received:', vapiSignature);
      return NextResponse.json({ 
        message: 'Unauthorized',
        debug: 'Signature verification failed' 
      }, { status: 401 });
    }
    
    const requestBody = JSON.parse(rawBody);
    const callId = requestBody.call?.id || requestBody.id;
    
    if (!callId) {
      return NextResponse.json({ message: 'Missing call ID' }, { status: 400 });
    }
    
    const docRef = doc(db, 'webhooks', callId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return NextResponse.json({ message: 'Webhook already processed' }, { status: 200 });
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
    
    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ 
      message: 'Internal server error',
      debug: error.message 
    }, { status: 500 });
  }
}
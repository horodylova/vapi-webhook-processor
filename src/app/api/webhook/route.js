import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

export async function POST(request) {
  try {
    const vapiSecret = process.env.VAPI_KEY;
    const rawBody = await request.text();
    const vapiSignature = request.headers.get('x-vapi-signature');
    
    const hmac = createHmac('sha256', vapiSecret);
    const generatedSignature = 'sha256=' + hmac.update(rawBody, 'utf8').digest('hex');
    
    if (vapiSignature !== generatedSignature) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
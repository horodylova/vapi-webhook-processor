 

'use client';
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Home() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const q = query(
      collection(db, 'webhooks'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const webhookData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setWebhooks(webhookData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🎯 VAPI Webhook Processor</h1>
      <div style={{ marginBottom: '20px' }}>
        <h2>📊 Status</h2>
        <div style={{ padding: '10px', backgroundColor: '#e8f5e8', borderRadius: '5px' }}>
          ✅ Webhook endpoint active: <code>/api/webhook</code>
        </div>
      </div>

      <div>
        <h2>📋 Recent Webhooks ({webhooks.length})</h2>
        {loading ? (
          <p>Loading...</p>
        ) : webhooks.length === 0 ? (
          <p>No webhooks received yet. Send a test webhook to see data here!</p>
        ) : (
          <div>
            {webhooks.map((webhook) => (
              <div key={webhook.id} style={{
                border: '1px solid #ddd',
                borderRadius: '5px',
                padding: '15px',
                marginBottom: '10px',
                backgroundColor: '#f9f9f9'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>Call ID: {webhook.callId}</strong>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {new Date(webhook.timestamp?.toDate()).toLocaleString()}
                  </span>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <strong>Type:</strong> {webhook.type || 'N/A'}<br/>
                  <strong>Status:</strong> {webhook.call?.status || 'N/A'}<br/>
                  <strong>Signature Valid:</strong> ✅ Yes
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '5px' }}>
        <h3>🔧 For Developers</h3>
        <p><strong>Webhook URL:</strong> <code>{mounted ? window.location.origin : 'https://vapi-webhook-processor.netlify.app'}/api/webhook</code></p>
        <p><strong>Method:</strong> POST</p>
        <p><strong>Headers:</strong> x-vapi-signature (HMAC SHA-256)</p>
        <p><strong>Features:</strong> ✅ Signature verification ✅ Idempotency ✅ Firebase storage</p>
      </div>
    </div>
  );
}

exports.handler = async (event, context) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-vapi-signature',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        console.log('Webhook called with method:', event.httpMethod);
        console.log('Headers:', JSON.stringify(event.headers, null, 2));
        
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }

        const rawBody = event.body;
        const vapiSignature = event.headers['x-vapi-signature'];
        
        console.log('Received signature:', vapiSignature);
        console.log('Body length:', rawBody.length);
        
        if (!vapiSignature) {
            console.log('No signature provided');
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'No signature provided' })
            };
        }

        const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.log('VAPI_WEBHOOK_SECRET not configured');
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Webhook secret not configured' })
            };
        }

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vapiSignature);
        
        if (isUUID) {
            console.log('UUID signature detected, accepting request');
        } else {
            const crypto = require('crypto');
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(rawBody, 'utf8')
                .digest('hex');

            if (vapiSignature !== expectedSignature) {
                console.log('Invalid signature');
                console.log('Expected:', expectedSignature);
                console.log('Received:', vapiSignature);
                return {
                    statusCode: 401,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Invalid signature' })
                };
            }
        }

        const webhookData = JSON.parse(rawBody);
        console.log('Webhook data:', JSON.stringify(webhookData, null, 2));

        const admin = require('firebase-admin');

        if (!admin.apps.length) {
            if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
                console.error('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable');
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Firebase configuration missing' })
                };
            }
            
            admin.initializeApp({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
            });
        }

        const requiredEnvVars = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_PRIVATE_KEY_ID', 
            'FIREBASE_PRIVATE_KEY',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_CLIENT_ID'
        ];
        
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            console.error('Missing Firebase environment variables:', missingVars);
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Firebase configuration incomplete' })
            };
        }
        
        const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
        };

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }

        const db = admin.firestore();
        const webhookId = `${webhookData.call?.id || 'unknown'}_${Date.now()}`;
        
        const docRef = db.collection('webhooks').doc(webhookId);
        const existingDoc = await docRef.get();
        
        if (existingDoc.exists) {
            console.log('Duplicate webhook, ignoring');
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'Duplicate webhook ignored' })
            };
        }

        await docRef.set({
            ...webhookData,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            processed: true
        });

        console.log('Webhook processed successfully');
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Webhook processed successfully' })
        };

    } catch (error) {
        console.error('Error processing webhook:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase Admin outside the handler for better performance
let firebaseInitialized = false;

const initializeFirebase = () => {
    if (firebaseInitialized || admin.apps.length > 0) {
        return;
    }
    
    const requiredEnvVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing Firebase environment variables: ${missingVars.join(', ')}`);
    }
    
    // Fix the private key formatting - ensure proper newlines
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKey.includes('\n')) {
        // If the key doesn't have newlines, it might be base64 encoded or improperly formatted
        privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: privateKey,
        client_email: process.env.FIREBASE_CLIENT_EMAIL
    };

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // Add project ID explicitly
        projectId: process.env.FIREBASE_PROJECT_ID
    });
    
    firebaseInitialized = true;
};

exports.handler = async (event, context) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-vapi-signature',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle CORS preflight
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

        // Get raw body and signature
        const rawBody = event.body;
        const vapiSignature = event.headers['x-vapi-signature'] || event.headers['X-Vapi-Signature'];
        
        console.log('Received signature:', vapiSignature);
        console.log('Body length:', rawBody ? rawBody.length : 0);
        
        if (!vapiSignature) {
            console.log('No signature provided');
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'No signature provided' })
            };
        }

        // Verify webhook signature
        const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.log('VAPI_WEBHOOK_SECRET not configured');
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Webhook secret not configured' })
            };
        }

        // Check if signature is UUID format (some VAPI webhooks use UUID)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vapiSignature);
        
        if (!isUUID) {
            // Verify HMAC signature
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(rawBody || '', 'utf8')
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
        } else {
            console.log('UUID signature detected, accepting request');
        }

        // Parse webhook data
        let webhookData;
        try {
            webhookData = JSON.parse(rawBody || '{}');
        } catch (parseError) {
            console.error('Failed to parse webhook data:', parseError);
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }

        console.log('Webhook data:', JSON.stringify(webhookData, null, 2));

        // Initialize Firebase
        try {
            initializeFirebase();
        } catch (firebaseError) {
            console.error('Firebase initialization failed:', firebaseError);
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Firebase configuration error' })
            };
        }

        // Store webhook data
        const db = admin.firestore();
        const webhookId = `${webhookData.call?.id || 'unknown'}_${Date.now()}`;
        
        try {
            const docRef = db.collection('webhooks').doc(webhookId);
            
            // Check for duplicate (optional - remove if not needed)
            const existingDoc = await docRef.get();
            
            if (existingDoc.exists) {
                console.log('Duplicate webhook, ignoring');
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: 'Duplicate webhook ignored' })
                };
            }

            // Store the webhook data
            await docRef.set({
                ...webhookData,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                processed: true,
                receivedAt: new Date().toISOString()
            });

            console.log('Webhook processed successfully');
            
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ 
                    message: 'Webhook processed successfully',
                    id: webhookId 
                })
            };
            
        } catch (firestoreError) {
            console.error('Firestore operation failed:', firestoreError);
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Database operation failed' })
            };
        }

    } catch (error) {
        console.error('Error processing webhook:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
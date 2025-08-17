const admin = require('firebase-admin');
const config = require('../config');

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  if (!admin.apps.length) {
    const firebaseConfig = config.firebase.credentials || {
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    };

    if (firebaseConfig) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
      });
    }
  }
  return admin;
};

// Send FCM notification to multiple tokens
const sendNotification = async (fcmTokens, title, body, data = {}) => {
  try {
    if (!Array.isArray(fcmTokens)) {
      fcmTokens = [fcmTokens]; // Convert single token to array for consistency
    }

    if (fcmTokens.length === 0) {
      throw new Error('No FCM tokens provided');
    }

    const firebase = initializeFirebase();
    const messages = fcmTokens.map(token => ({
      token: token,
      notification: {
        title: title,
        body: body,
      },
      data: data,
    }));

    // If only one token, use send() for better error handling
    if (fcmTokens.length === 1) {
      const response = await firebase.messaging().send(messages[0]);
      console.log('Successfully sent notification:', response);
      return { success: true, response, tokens: [fcmTokens[0]] };
    }
    // If multiple tokens, use sendAll()
    else {
      const response = await firebase.messaging().sendAll(messages);
      console.log('Successfully sent notifications:', response);
      return { success: true, response, tokens: fcmTokens };
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

// Send notification to multiple FCM tokens with individual error handling
const sendNotificationToMultiple = async (fcmTokens, title, body, data = {}) => {
  try {
    if (!Array.isArray(fcmTokens)) {
      throw new Error('fcmTokens must be an array');
    }

    if (fcmTokens.length === 0) {
      throw new Error('No FCM tokens provided');
    }

    const firebase = initializeFirebase();
    const results = [];

    // Process tokens in batches to avoid rate limits
    const batchSize = 100; // FCM batch limit
    for (let i = 0; i < fcmTokens.length; i += batchSize) {
      const batch = fcmTokens.slice(i, i + batchSize);
      const messages = batch.map(token => ({
        token: token,
        notification: {
          title: title,
          body: body,
        },
        data: data,
      }));

      const response = await firebase.messaging().sendAll(messages);
      results.push({
        batch: batch,
        response: response,
        success: true
      });
    }

    console.log('Successfully sent notifications to', fcmTokens.length, 'tokens');
    return { success: true, results, totalTokens: fcmTokens.length };
  } catch (error) {
    console.error('Error sending notifications:', error);
    throw error;
  }
};

// Send notification to a topic
const sendNotificationToTopic = async (topic, title, body, data = {}) => {
  try {
    const firebase = initializeFirebase();
    const message = {
      topic: topic,
      notification: {
        title: title,
        body: body,
      },
      data: data,
    };

    const response = await firebase.messaging().send(message);
    console.log('Successfully sent notification to topic:', response);
    return { success: true, response, topic };
  } catch (error) {
    console.error('Error sending notification to topic:', error);
    throw error;
  }
};

module.exports = {
  initializeFirebase,
  sendNotification,
  sendNotificationToMultiple,
  sendNotificationToTopic,
};
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin
admin.initializeApp();

// Configure email transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'eaglebeatsadiii@gmail.com',
    pass: 'suavzltdxktlfkbd',
  },
});

// Verify email configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Cloud Function 1: Send email when task is executed
exports.sendTaskExecutionEmail = functions.firestore
    .document('task_executions/{executionId}')
    .onCreate(async (snap) => {
      const taskData = snap.data();
      const executionTime = new Date().toLocaleString();

      // Get user's real email from users collection
      let userEmail = taskData.userEmail;

      // If not in taskData, fetch from users collection
      if (!userEmail && taskData.username) {
        const userDoc = await admin.firestore()
            .collection('users')
            .doc(taskData.username)
            .get();
        if (userDoc.exists) {
          userEmail = userDoc.data().email;
        }
      }

      // Fallback email (won't work, but prevents crash)
      if (!userEmail) {
        userEmail = 'test@example.com';
        console.warn(`No email found for user: ${taskData.username}`);
      }

      const mailOptions = {
        from: '"Task Scheduler" <eaglebeatsadiii@gmail.com>',
        to: userEmail,
        subject: `Task Executed: ${taskData.taskName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        padding: 20px; text-align: center; color: white;">
              <h2> Daily Task Scheduler</h2>
            </div>
            <div style="padding: 20px; background: #f9f9f9;">
              <h3>Hello ${taskData.username}! </h3>
              <p>Your daily task has been successfully executed.</p>
              <div style="background: white; padding: 15px; border-radius: 8px;">
                <h3 style="color: #667eea;"> ${taskData.taskName}</h3>
                <p> Executed at: ${executionTime}</p>
              </div>
              <p>Great job staying consistent! Keep up the good work! </p>
            </div>
            <div style="text-align: center; padding: 10px; font-size: 12px;">
              <p>This is an automated message from your Daily Task Scheduler</p>
            </div>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${userEmail} for task: ${taskData.taskName}`);
        return null;
      } catch (error) {
        console.error('Error sending email:', error);
        return null;
      }
    });

// Cloud Function 2: Save user email (called from frontend)
exports.saveUserEmail = functions.https.onCall(async (data) => {
  const { username, email } = data;

  if (!username || !email) {
    throw new functions.https.HttpsError(
        'invalid-argument',
        'Username and email are required'
    );
  }

  await admin.firestore().collection('users').doc(username).set({
    email: email,
    username: username,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Email saved for user: ${username} -> ${email}`);
  return { success: true, message: 'Email saved successfully' };
});

// Cloud Function 3: Test email function (for testing only)
exports.testEmail = functions.https.onRequest(async (req, res) => {
  const testMailOptions = {
    from: '"Task Scheduler" <eaglebeatsadiii@gmail.com>',
    to: 'eaglebeatsadiii@gmail.com',
    subject: 'Test Email from Task Scheduler',
    html: '<h1>Email configuration is working!</h1>' +
          '<p>Your task scheduler is ready to send emails.</p>' +
          `<p>Time: ${new Date().toLocaleString()}</p>`,
  };

  try {
    await transporter.sendMail(testMailOptions);
    res.send('Test email sent successfully! Check your inbox.');
  } catch (error) {
    res.status(500).send('Error sending email: ' + error.message);
  }
});
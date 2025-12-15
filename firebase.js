import admin from "firebase-admin";

const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

if (!credentialsJson) {
  throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS_JSON env variable");
}

// Convert env variable (string) → object
const credentials = JSON.parse(credentialsJson);

admin.initializeApp({
  credential: admin.credential.externalAccount(credentials),
});

export default admin;

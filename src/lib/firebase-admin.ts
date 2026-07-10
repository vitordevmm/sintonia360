import * as admin from "firebase-admin";
import fs from "fs";
import path from "path";

if (!admin.apps.length) {
  try {
    const saPath = path.join(process.cwd(), "service-account.json");
    if (fs.existsSync(saPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      // Inicialização via variáveis de ambiente segura para produção/Vercel
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY
            .replace(/^["']/, "") // Remove aspas no início
            .replace(/["']$/, "") // Remove aspas no fim
            .replace(/\\n/g, "\n"),
        }),
      });
    } else {
      admin.initializeApp();
    }
  } catch (error) {
    console.warn("Could not initialize Firebase Admin, trying default credentials:", error);
    admin.initializeApp();
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

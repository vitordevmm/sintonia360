const admin = require("./node_modules/firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require("./firebase-admin.json")),
  });
}
const db = admin.firestore();

async function run() {
  const snapshot = await db.collection("webhook_logs").orderBy("receivedAt", "desc").limit(5).get();
  if (snapshot.empty) {
    console.log("Nenhum log encontrado.");
    return;
  }
  snapshot.forEach(doc => {
    console.log("LOG ID:", doc.id);
    const data = doc.data();
    data.receivedAt = data.receivedAt.toDate();
    console.log(JSON.stringify(data, null, 2));
  });
}
run().catch(console.error);

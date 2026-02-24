
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Manually load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach(line => {
        const [key, ...valueParts] = line.split("=");
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
        }
    });
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Firebase Admin credentials not found in .env.local");
    process.exit(1);
}

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

async function cleanupTodos() {
    console.log("🚀 Starting cleanup (ADMIN) of Ad Spend entries with country 'Todos'...");

    const historyRef = db.collection("marketing_history");
    const snapshot = await historyRef.where("country", "==", "Todos").get();

    console.log(`Found ${snapshot.size} entries with country 'Todos' to delete.`);

    if (snapshot.empty) {
        console.log("No entries found. Nothing to delete.");
        process.exit(0);
    }

    // Delete in chunks of 500 (Firestore limit)
    const chunks = [];
    for (let i = 0; i < snapshot.docs.length; i += 500) {
        chunks.push(snapshot.docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted chunk of ${chunk.length} entries.`);
    }

    console.log(`✅ Finished! Deleted ${snapshot.size} entries.`);
    process.exit(0);
}

cleanupTodos().catch(err => {
    console.error("❌ Error during cleanup:", err);
    process.exit(1);
});

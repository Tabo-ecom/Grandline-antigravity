
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

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

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupTodos() {
    console.log("🚀 Starting cleanup of Ad Spend entries with country 'Todos'...");

    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.error("❌ Firebase Project ID not found in .env.local");
        process.exit(1);
    }

    const historyRef = collection(db, "marketing_history");
    const q = query(historyRef, where("country", "==", "Todos"));

    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.size} entries with country 'Todos' to delete.`);

    let deleted = 0;
    for (const d of snapshot.docs) {
        await deleteDoc(doc(db, "marketing_history", d.id));
        deleted++;
        if (deleted % 10 === 0) console.log(`Deleted ${deleted}...`);
    }

    console.log(`✅ Finished! Deleted ${deleted} entries.`);
    process.exit(0);
}

cleanupTodos().catch(err => {
    console.error("❌ Error during cleanup:", err);
    process.exit(1);
});

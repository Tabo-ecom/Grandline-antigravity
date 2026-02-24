# Firebase Project Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `grand-line-v8`
4. Disable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In Firebase Console, go to **Build > Authentication**
2. Click "Get started"
3. Enable **Email/Password** provider
4. Enable **Google** provider (optional)
5. Add authorized domain: `localhost` (for development)

## Step 3: Create Firestore Database

1. Go to **Build > Firestore Database**
2. Click "Create database"
3. Select **Start in production mode**
4. Choose location: `us-central1` (or closest to you)
5. Click "Enable"

### Firestore Security Rules

> [!CAUTION]
> **IMPORTANTE:** No copies los símbolos ``` ni la palabra "javascript". 
> Copia **SOLO** el código que empieza con `rules_version = '2';` hasta la última llave `}`.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Core check
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Role check - safe and non-recursive
    function isAdmin() {
      return isSignedIn() && 
             exists(/databases/$(database)/documents/user_profiles/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/user_profiles/$(request.auth.uid)).data.role == 'admin';
    }

    // --- RULES ---

    // User profiles
    match /user_profiles/{userId} {
      allow get: if isSignedIn() && request.auth.uid == userId;
      allow read, write: if isAdmin();
    }
    
    // App data - Global settings
    match /app_data/{document=**} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
    
    // Operational data
    match /order_files/{document=**} { allow read, write: if isSignedIn(); }
    match /import_logs/{document=**} { allow read, write: if isSignedIn(); }
    match /marketing_history/{document=**} { allow read, write: if isSignedIn(); }
    match /sunny_profiles/{document=**} { allow read, write: if isSignedIn(); }
    match /sunny_exclusions/{document=**} { allow read, write: if isSignedIn(); }

    // Sunny Module (Ownership based)
    match /sunny_profiles/{id} {
      allow read: if isSignedIn() && (resource == null || resource.data.userId == request.auth.uid);
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update: if isSignedIn() && resource.data.userId == request.auth.uid && request.resource.data.userId == request.auth.uid;
      allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;
    }
    match /sunny_accounts/{id} {
      allow read: if isSignedIn() && (resource == null || resource.data.userId == request.auth.uid);
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update: if isSignedIn() && resource.data.userId == request.auth.uid && request.resource.data.userId == request.auth.uid;
      allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;
    }
    match /sunny_exclusions/{id} {
      allow read: if isSignedIn() && (resource == null || resource.data.userId == request.auth.uid);
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update: if isSignedIn() && resource.data.userId == request.auth.uid && request.resource.data.userId == request.auth.uid;
      allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;
    }
  }
}
```

## Step 4: Enable Storage

1. Go to **Build > Storage**
2. Click "Get started"
3. Select **Start in production mode**
4. Choose same location as Firestore
5. Click "Done"

### Storage Security Rules

> [!WARNING]
> **IMPORTANTE:** Copia **solo el contenido** de abajo.

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /order_files/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## Step 5: Get Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps"
3. Click **Web** icon (`</>`)
4. Register app name: `GRAND LINE v8.0`
5. Copy the `firebaseConfig` object

## Step 6: Create Service Account (Admin SDK)

1. Go to **Project Settings > Service accounts**
2. Click "Generate new private key"
3. Download the JSON file
4. Extract these values:
   - `project_id`
   - `client_email`
   - `private_key`

## Step 7: Configure Environment Variables

Create `.env.local` in your project root:

```bash
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=grand-line-v8.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=grand-line-v8
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=grand-line-v8.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=grand-line-v8
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@grand-line-v8.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"

# API Keys (add later)
FACEBOOK_ACCESS_TOKEN=
TIKTOK_ACCESS_TOKEN=
GEMINI_API_KEY=
```

## Step 8: Initialize Firestore Collections

Run this script to create initial collections:

```typescript
// scripts/init-firestore.ts
import { adminDb } from '../lib/firebase/admin';

async function initializeFirestore() {
  // Create app_data collection with settings
  await adminDb.collection('app_data').doc('settings').set({
    key: 'settings',
    value: {
      fb_token: '',
      fb_cids: [],
      tt_token: '',
      tt_aids: [],
      gemini_key: '',
    },
    updated_by: 'system',
    updated_at: new Date().toISOString(),
  });

  // Create product_mappings
  await adminDb.collection('app_data').doc('product_mappings').set({
    key: 'product_mappings',
    value: {},
    updated_by: 'system',
    updated_at: new Date().toISOString(),
  });

  // Create campaign_mappings
  await adminDb.collection('app_data').doc('campaign_mappings').set({
    key: 'campaign_mappings',
    value: {},
    updated_by: 'system',Es
    updated_at: new Date().toISOString(),
  });

  console.log('✅ Firestore initialized');
}

initializeFirestore();
```

## Step 9: Create First Admin User

1. Go to **Authentication > Users**
2. Click "Add user"
3. Enter email and password
4. Copy the User UID

5. Go to **Firestore Database**
6. Create document in `user_profiles` collection:
   - Document ID: `<USER_UID>`
   - Fields:
     ```
     user_id: <USER_UID>
     email: your@email.com
     role: admin
     display_name: Your Name
     created_at: <current timestamp>
     ```

## Step 10: Test Connection

Restart your dev server:
```bash
npm run dev
```

Visit `http://localhost:3000` - you should see the GRAND LINE landing page!

---

## Next: Implement Authentication
## Solución de Problemas (Troubleshooting)

### Error: "No se permite crear claves..." o "Permisos insuficientes"
Si al intentar crear la llave JSON te dice que está bloqueado por una política de la organización y no te deja editarla:

1.  **Sube al nivel de Organización**: En el selector de proyectos (arriba), selecciona la pestaña **"ALL"** y elige tu dominio o nombre de organización (ej: `taboecom.com`).
2.  **Asignate el Rol de Administrador**:
    -   Ve a **IAM & Admin** > **IAM**.
    -   Busca tu email y dale a **Editar** (o haz clic en **Otorgar acceso** arriba si no apareces).
    -   Agrega el rol: **Administrador de políticas de la organización** (`Organization Policy Administrator`).
    -   **Guardar**.
3.  **Desactiva la restricción**:
    -   Ahora ve a **Organization Policies**.
    -   Busca `iam.disableServiceAccountKeyCreation`.
    -   Dale a **Manage Policy** -> **Override** -> **Rule: Off**.
    -   **Guardar**.
4.  **Crea la llave**: Vuelve a tu proyecto (`reporte-y-proyeccion`) y crea la llave JSON en **Service Accounts**.

Once Firebase is configured, we'll implement:
1. Login/Register pages
2. Protected routes
3. Role-based access control
4. Session management

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { App, applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const buildCredential = () => {
	if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
		return applicationDefault();
	}

	const localServiceAccountPath = resolve(__dirname, '../../secrets/firebase-adminsdk.json');

	try {
		const serviceAccount = JSON.parse(readFileSync(localServiceAccountPath, 'utf-8'));
		return cert(serviceAccount);
	} catch (error) {
		if (process.env.NODE_ENV !== 'production') {
			// eslint-disable-next-line no-console
			console.warn('Firebase admin credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or add secrets/firebase-adminsdk.json');
		}
		return applicationDefault();
	}
};

const firebaseApp: App = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: buildCredential() });

export const adminAuth = getAuth(firebaseApp);
export { firebaseApp };

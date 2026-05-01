const LOCAL_API_BASE = 'http://localhost:3001';
const PRODUCTION_API_BASE = 'https://api.aquariusapp.eth';

const configuredApiBase = (globalThis as any)?.process?.env?.EXPO_PUBLIC_AQUARIUS_API_BASE_URL;

export const API_BASE = configuredApiBase || (__DEV__ ? LOCAL_API_BASE : PRODUCTION_API_BASE);

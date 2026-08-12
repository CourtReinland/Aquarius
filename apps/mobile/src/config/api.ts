import { getConfiguredApiBaseUrl } from './env';

const LOCAL_API_BASE = 'http://localhost:3001';
const PRODUCTION_API_BASE = 'https://api.aquariusapp.eth';

const configuredApiBase = getConfiguredApiBaseUrl();

export const API_BASE = configuredApiBase || (__DEV__ ? LOCAL_API_BASE : PRODUCTION_API_BASE);

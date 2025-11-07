import Constants from 'expo-constants';

const extra = (Constants.expoConfig ?? Constants.manifest ?? { extra: {} }).extra ?? {};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const API_BASE_URL: string =
  (typeof extra.apiBaseUrl === 'string' && extra.apiBaseUrl.length > 0
    ? extra.apiBaseUrl
    : 'http://localhost:3000');

export const YWS_BASE_URL: string =
  typeof extra.ywsBaseUrl === 'string' && extra.ywsBaseUrl.length > 0
    ? trimTrailingSlash(extra.ywsBaseUrl)
    : `${trimTrailingSlash(API_BASE_URL.replace(/^http/i, 'ws'))}/api/yws`;



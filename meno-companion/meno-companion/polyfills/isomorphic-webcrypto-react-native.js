import 'react-native-get-random-values';

const ensureSecure = () => {
  if (typeof global.crypto === 'undefined' || typeof global.crypto.getRandomValues !== 'function') {
    throw new Error('Secure random number generator not available');
  }
};

ensureSecure();

const getRandomValues = (array) => {
  ensureSecure();
  return global.crypto.getRandomValues(array);
};

const subtle =
  (typeof global.crypto !== 'undefined' && global.crypto.subtle) || {
    async digest() {
      throw new Error('subtle.digest not implemented on this platform');
    },
  };

const cryptoPolyfill = {
  ensureSecure,
  getRandomValues,
  subtle,
};

if (typeof global.crypto === 'undefined') {
  global.crypto = cryptoPolyfill;
}

export { ensureSecure, subtle, getRandomValues };
export default cryptoPolyfill;


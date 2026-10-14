import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

// expo-crypto's native random source → Node's in tests.
jest.mock("expo-crypto", () => ({
  getRandomBytes: (n: number) => new Uint8Array(require("node:crypto").randomBytes(n)),
}));

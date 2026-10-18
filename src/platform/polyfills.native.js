import "react-native-url-polyfill/auto";
import { randomUUID } from "expo-crypto";
if (!globalThis.crypto) globalThis.crypto = {};
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = randomUUID;

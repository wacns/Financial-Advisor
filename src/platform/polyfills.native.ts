import "react-native-url-polyfill/auto";
import { randomUUID } from "expo-crypto";
// React Native may lack these globals even though the DOM types declare them. Reflect.set is the
// same assignment the polyfill always made, without claiming the globals are already present.
if (!Reflect.get(globalThis, "crypto")) Reflect.set(globalThis, "crypto", {});
if (!Reflect.get(globalThis.crypto, "randomUUID"))
  Reflect.set(globalThis.crypto, "randomUUID", randomUUID);

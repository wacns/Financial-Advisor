import type { SafeArea, Satisfies } from "./contracts.ts";
import type * as Self from "./safe-area.native.ts";
export {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
// Compile-time check that this module matches the safe-area contract.
export type SafeAreaCheck = Satisfies<SafeArea, typeof Self>;

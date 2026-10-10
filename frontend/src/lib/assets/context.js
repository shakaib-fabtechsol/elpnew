import { createContext, useContext } from "react";

export const AssetsContext = createContext(null);

export function useAssets() {
  const context = useContext(AssetsContext);
  if (!context) {
    throw new Error("useAssets must be used inside AssetsProvider");
  }
  return context;
}

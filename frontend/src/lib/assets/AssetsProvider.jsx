import { useMemo, useState } from "react";
import { AssetsContext } from "./context";
import { initialAssets, nextAssetNo } from "@/pages/assets/assetData";

/** What an asset holds before its details are completed on its own page. */
const EMPTY_ASSET = {
  branchId: "",
  name: "",
  brandModel: "",
  serialNo: "",
  status: "active",
  depreciationMethod: "Straight-Line",
  rate: "",
  usefulLife: "",
  method: "",
  bankAccountId: "",
  transactionNo: "",
  receiptFile: "",
  documents: [],
  expenses: [],
};

/**
 * The fixed asset register, in one place.
 *
 * The register and each asset's own page read and change the same records, so
 * what is completed on the asset shows in the register the moment you go back.
 */
export default function AssetsProvider({ children }) {
  const [assets, setAssets] = useState(initialAssets);

  // Editing the seed data while the app is open hot-reloads this provider
  // with its old state kept. Start again from the new seed whenever it changes.
  const [seed, setSeed] = useState(initialAssets);
  if (seed !== initialAssets) {
    setSeed(initialAssets);
    setAssets(initialAssets);
  }

  const value = useMemo(
    () => ({
      assets,

      findAsset: (id) => assets.find((asset) => asset.id === Number(id)) || null,

      /** A new asset, at the end of the register with the next number. */
      addAsset: (record) =>
        setAssets((prev) => [
          ...prev,
          {
            ...EMPTY_ASSET,
            ...record,
            id: prev.reduce((max, asset) => Math.max(max, asset.id), 0) + 1,
            assetNo: nextAssetNo(prev),
          },
        ]),

      updateAsset: (id, changes) =>
        setAssets((prev) =>
          prev.map((asset) =>
            asset.id === Number(id) ? { ...asset, ...changes } : asset
          )
        ),

      /**
       * An expense on one asset. Recorded straight away rather than waiting on
       * Save Changes: an invoice is a record of money spent, not an edit.
       */
      addAssetExpense: (id, expense) =>
        setAssets((prev) =>
          prev.map((asset) => {
            if (asset.id !== Number(id)) return asset;
            const expenses = asset.expenses || [];
            return {
              ...asset,
              expenses: [
                ...expenses,
                { ...expense, id: expenses.reduce((max, e) => Math.max(max, e.id), 0) + 1 },
              ],
            };
          })
        ),
    }),
    [assets]
  );

  return (
    <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>
  );
}

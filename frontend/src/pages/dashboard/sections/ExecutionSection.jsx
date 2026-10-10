import { Landmark } from "lucide-react";
import { SectionCard, Tile } from "@/components/shared/panels";
import { executionIndicators, amountsCollected, money } from "../dashboardData";

export function ExecutionFollowUp() {
  return (
    <SectionCard
      title="Execution Follow-up"
      icon={Landmark}
      action={
        <span className="text-xs text-muted-foreground">
          Collected: {money(amountsCollected)}
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {executionIndicators.map((indicator) => (
          <Tile
            key={indicator.label}
            label={indicator.label}
            value={indicator.value}
            tone={indicator.tone}
            to="/litigation?stage=Execution"
          />
        ))}
        <Tile
          label="Amounts Collected"
          value={money(amountsCollected)}
          tone="good"
          to="/finance"
        />
      </div>
    </SectionCard>
  );
}

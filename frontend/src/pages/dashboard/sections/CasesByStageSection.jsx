import { useNavigate } from "react-router-dom";
import { Layers } from "lucide-react";
import { SectionCard } from "@/components/shared/panels";
import CountBars from "@/components/shared/CountBars";
import { casesByStage } from "../dashboardData";

export function CasesByStage() {
  const navigate = useNavigate();
  const total = casesByStage.reduce((sum, s) => sum + s.count, 0);

  return (
    <SectionCard
      title="Cases by Stage"
      icon={Layers}
      action={<span className="text-xs text-muted-foreground">{total} cases</span>}
    >
      <CountBars
        rows={casesByStage.map((stage) => ({
          label: stage.stage,
          count: stage.count,
        }))}
        onSelect={(row) =>
          navigate("/litigation?stage=" + encodeURIComponent(row.label))
        }
      />
    </SectionCard>
  );
}

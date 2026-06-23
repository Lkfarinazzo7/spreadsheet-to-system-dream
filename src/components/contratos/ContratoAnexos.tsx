import { useAuth } from "@/hooks/useAuth";
import { PipelineAnexos } from "@/components/pipeline/PipelineAnexos";

export function ContratoAnexos({ contratoId }: { contratoId: string }) {
  const { user } = useAuth();
  if (!user) return null;
  return <PipelineAnexos key={contratoId} basePrefix={`${user.id}/contratos/${contratoId}`} />;
}
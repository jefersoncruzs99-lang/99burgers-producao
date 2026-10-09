import { ROTULO_STATUS, type StatusTarefa } from "@/lib/tipos";

export function Status({ status, atrasada }: { status: StatusTarefa; atrasada?: boolean }) {
  if (atrasada) return <span className="etiqueta atrasada">Atrasada</span>;
  return <span className={`etiqueta ${status}`}>{ROTULO_STATUS[status] ?? status}</span>;
}

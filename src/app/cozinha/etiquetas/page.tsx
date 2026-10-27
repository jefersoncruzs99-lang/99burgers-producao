import { redirect } from "next/navigation";

/** Endereço antigo: as etiquetas agora ficam em /etiquetas. */
export default function EtiquetasAntigo() {
  redirect("/etiquetas?de=cozinha");
}

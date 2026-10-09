"use client";

import { useState } from "react";
import { criarSupabaseNavegador } from "@/lib/supabase/client";

/** Reduz a foto para no máximo 1600px (JPEG) antes de enviar, para economizar internet e espaço. */
async function comprimir(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao processar a foto"))), "image/jpeg", 0.8),
  );
}

export function EnvioFoto({
  tarefaId,
  obrigatoria,
  aoEnviar,
}: {
  tarefaId: string;
  obrigatoria: boolean;
  aoEnviar: (caminho: string | null) => void;
}) {
  const [previa, setPrevia] = useState<string | null>(null);
  const [estado, setEstado] = useState<"livre" | "enviando" | "ok" | "erro">("livre");

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEstado("enviando");
    aoEnviar(null);
    try {
      const blob = await comprimir(arquivo);
      setPrevia(URL.createObjectURL(blob));
      const caminho = `${tarefaId}/${crypto.randomUUID()}.jpg`;
      const { error } = await criarSupabaseNavegador()
        .storage.from("prod-evidencias")
        .upload(caminho, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      aoEnviar(caminho);
      setEstado("ok");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <div className="pilha">
      <label className="botao grande cheio" style={{ cursor: "pointer" }}>
        📷 {previa ? "Tirar outra foto" : obrigatoria ? "Tirar foto (obrigatória)" : "Tirar foto (opcional)"}
        <input type="file" accept="image/*" capture="environment" onChange={escolher} style={{ display: "none" }} />
      </label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {previa && <img src={previa} alt="Prévia da foto" className="foto-previa" />}
      {estado === "enviando" && <div className="aviso">Enviando foto...</div>}
      {estado === "ok" && <div className="ok">Foto enviada ✓</div>}
      {estado === "erro" && <div className="erro">Não foi possível enviar a foto. Tente de novo.</div>}
    </div>
  );
}

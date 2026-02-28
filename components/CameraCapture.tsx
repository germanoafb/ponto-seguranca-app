"use client";

import { ChangeEvent } from "react";
import NextImage from "next/image";
import { useState } from "react";

type Props = {
  selfieDataUrl: string | null;
  onChange: (value: string | null) => void;
};

const SAFE_TARGET = 160000;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo da selfie."));
    reader.readAsDataURL(file);
  });
}

async function compressDataUrl(rawDataUrl: string): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem da selfie."));
    img.src = rawDataUrl;
  });

  const canvas = document.createElement("canvas");
  const maxWidth = 360;
  const scale = Math.min(1, maxWidth / image.width);
  canvas.width = Math.max(1, Math.floor(image.width * scale));
  canvas.height = Math.max(1, Math.floor(image.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível processar a selfie.");
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const compressed = canvas.toDataURL("image/jpeg", 0.65);
  return compressed;
}

async function compressToSheetsLimit(rawDataUrl: string): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem da selfie."));
    img.src = rawDataUrl;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível processar a selfie.");
  }

  let scale = Math.min(1, 360 / image.width);
  let quality = 0.65;
  let result = rawDataUrl;

  for (let i = 0; i < 12; i += 1) {
    canvas.width = Math.max(1, Math.floor(image.width * scale));
    canvas.height = Math.max(1, Math.floor(image.height * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    result = canvas.toDataURL("image/jpeg", quality);

    if (result.length <= SAFE_TARGET) {
      return result;
    }

    if (quality > 0.35) {
      quality -= 0.08;
    } else {
      scale *= 0.8;
    }
  }

  return result;
}

export default function CameraCapture({ selfieDataUrl, onChange }: Props) {
  const [inputError, setInputError] = useState("");

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setInputError("");
      onChange(null);
      return;
    }

    try {
      const rawDataUrl = await fileToDataUrl(file);
      try {
        const firstCompression = await compressDataUrl(rawDataUrl);
        const fitted = await compressToSheetsLimit(firstCompression);
        setInputError("");
        onChange(fitted);
      } catch {
        // Fallback: usa o arquivo original em base64 quando a compressão falhar.
        const fitted = await compressToSheetsLimit(rawDataUrl);
        setInputError("");
        onChange(fitted);
      }
    } catch {
      setInputError("Não foi possível processar a selfie.");
      onChange(null);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        Selfie (obrigatória)
      </label>
      <input
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileChange}
        className="block w-full text-sm text-slate-700 dark:text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white hover:file:bg-blue-700"
      />

      {selfieDataUrl ? (
        <NextImage
          src={selfieDataUrl}
          alt="Pré-visualização da selfie"
          width={128}
          height={128}
          className="w-32 h-32 object-cover rounded-lg border border-slate-300 dark:border-slate-700"
        />
      ) : (
        <p className="text-xs text-slate-500">Nenhuma selfie selecionada.</p>
      )}
      {inputError && <p className="text-xs text-red-600">{inputError}</p>}
    </div>
  );
}

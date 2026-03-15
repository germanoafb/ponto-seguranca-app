"use client";

import { ChangeEvent } from "react";
import NextImage from "next/image";
import { useState } from "react";

type Props = {
  selfieDataUrl: string | null;
  onChange: (value: string | null) => void;
  onMetadataChange?: (value: CaptureMetadata | null) => void;
};

export type CaptureMetadata = {
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  capturedAtIso: string;
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

function toCardinalDirection(heading: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const index = Math.round(heading / 45) % 8;
  return directions[index];
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (latitude === null || longitude === null) {
    return "Local: indisponível";
  }

  return `Local: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

async function getCurrentLocationMeta(): Promise<{ latitude: number | null; longitude: number | null }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve({ latitude: null, longitude: null }),
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 0,
      }
    );
  });
}

async function getCompassHeadingMeta(): Promise<number | null> {
  return new Promise(async (resolve) => {
    const orientationApi = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<string>;
    };

    if (!orientationApi) {
      resolve(null);
      return;
    }

    try {
      if (typeof orientationApi.requestPermission === "function") {
        const permission = await orientationApi.requestPermission();
        if (permission !== "granted") {
          resolve(null);
          return;
        }
      }
    } catch {
      resolve(null);
      return;
    }

    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        window.removeEventListener("deviceorientation", onOrientation);
        resolve(null);
      }
    }, 2200);

    function onOrientation(event: DeviceOrientationEvent) {
      const alphaHeading = typeof event.alpha === "number" ? event.alpha : null;
      const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;

      const heading =
        typeof webkitHeading === "number"
          ? webkitHeading
          : alphaHeading !== null
            ? (360 - alphaHeading + 360) % 360
            : null;

      if (heading === null || settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      window.removeEventListener("deviceorientation", onOrientation);
      resolve(heading);
    }

    window.addEventListener("deviceorientation", onOrientation, { once: false });
  });
}

async function addTimestampOverlay(rawDataUrl: string, metadata: CaptureMetadata): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem da selfie."));
    img.src = rawDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível processar a selfie.");
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const now = new Date(metadata.capturedAtIso);
  const timeText = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  const weekdayText = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
  }).format(now);

  const dateText = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);

  const locationText = formatCoordinates(metadata.latitude, metadata.longitude);
  const headingText =
    metadata.heading === null
      ? "Bússola: indisponível"
      : `Bússola: ${Math.round(metadata.heading)}° ${toCardinalDirection(metadata.heading)}`;

  const timeFontSize = Math.max(22, Math.floor(canvas.width * 0.08));
  const metaFontSize = Math.max(13, Math.floor(canvas.width * 0.04));
  const smallFontSize = Math.max(12, Math.floor(canvas.width * 0.032));
  const padding = Math.max(10, Math.floor(canvas.width * 0.026));
  const panelWidth = Math.floor(canvas.width * 0.92);
  const panelHeight = Math.floor(timeFontSize + metaFontSize + smallFontSize * 3 + padding * 3.2);
  const panelX = padding;
  const panelY = canvas.height - panelHeight - padding;

  ctx.fillStyle = "rgba(14, 37, 108, 0.62)";
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";

  ctx.font = `700 ${timeFontSize}px Arial, sans-serif`;
  ctx.fillText(timeText, panelX + padding, panelY + padding);

  ctx.font = `600 ${metaFontSize}px Arial, sans-serif`;
  const weekdayCapitalized = weekdayText.charAt(0).toUpperCase() + weekdayText.slice(1);
  const timeWidth = ctx.measureText(timeText).width;
  ctx.fillText(weekdayCapitalized, panelX + padding + timeWidth + 10, panelY + padding + 4);

  ctx.font = `600 ${smallFontSize}px Arial, sans-serif`;
  ctx.fillText(dateText, panelX + padding + timeWidth + 10, panelY + padding + metaFontSize + 8);

  const extraBaseY = panelY + padding + timeFontSize + Math.floor(smallFontSize * 0.9);
  ctx.font = `600 ${smallFontSize}px Arial, sans-serif`;
  ctx.fillText(locationText, panelX + padding, extraBaseY);
  ctx.fillText(headingText, panelX + padding, extraBaseY + smallFontSize + 6);

  return canvas.toDataURL("image/jpeg", 0.9);
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

export default function CameraCapture({ selfieDataUrl, onChange, onMetadataChange }: Props) {
  const [inputError, setInputError] = useState("");

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setInputError("");
      onChange(null);
      onMetadataChange?.(null);
      return;
    }

    try {
      const [locationMeta, headingMeta] = await Promise.all([
        getCurrentLocationMeta(),
        getCompassHeadingMeta(),
      ]);

      const captureMeta: CaptureMetadata = {
        latitude: locationMeta.latitude,
        longitude: locationMeta.longitude,
        heading: headingMeta,
        capturedAtIso: new Date().toISOString(),
      };

      const rawDataUrl = await fileToDataUrl(file);
      const stampedDataUrl = await addTimestampOverlay(rawDataUrl, captureMeta);
      try {
        const firstCompression = await compressDataUrl(stampedDataUrl);
        const fitted = await compressToSheetsLimit(firstCompression);
        setInputError("");
        onChange(fitted);
        onMetadataChange?.(captureMeta);
      } catch {
        // Fallback: usa o arquivo original em base64 quando a compressão falhar.
        const fitted = await compressToSheetsLimit(stampedDataUrl);
        setInputError("");
        onChange(fitted);
        onMetadataChange?.(captureMeta);
      }
    } catch {
      setInputError("Não foi possível processar a selfie.");
      onChange(null);
      onMetadataChange?.(null);
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

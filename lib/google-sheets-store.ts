import type { State } from "./engine";

export type SheetsSnapshot = {
  state: State | null;
  revision: number;
  updatedAt?: string;
  lastWriteId?: string;
};

type JsonpPayload = SheetsSnapshot & {
  ok?: boolean;
  pending?: boolean;
  error?: string;
  writeId?: string;
};

const ENDPOINT_KEY = "eibar-google-sheets-endpoint-v1";
const PIN_KEY = "eibar-google-sheets-pin-v1";
const APPS_SCRIPT_URL = /^https:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]+)\/exec$/;
const DEPLOYMENT_ID = /^[A-Za-z0-9_-]{20,}$/;

declare global {
  interface Window {
    EIBAR_SHEETS_ENDPOINT?: string;
    [key: `__eibarJsonp_${string}`]: ((payload: JsonpPayload) => void) | undefined;
  }
}

export function normalizeSheetsEndpoint(value: string) {
  const trimmed = value.trim();
  if (DEPLOYMENT_ID.test(trimmed)) {
    return `https://script.google.com/macros/s/${trimmed}/exec`;
  }
  const match = trimmed.match(APPS_SCRIPT_URL);
  if (!match) {
    throw new Error("Pega la URL de Apps Script que termina en /exec.");
  }
  return `https://script.google.com/macros/s/${match[1]}/exec`;
}

export function deploymentIdFromEndpoint(endpoint: string) {
  return normalizeSheetsEndpoint(endpoint).match(APPS_SCRIPT_URL)![1];
}

export function readSheetsEndpoint() {
  const fromQuery = new URLSearchParams(window.location.search).get("sheets");
  const candidate = fromQuery || window.EIBAR_SHEETS_ENDPOINT || localStorage.getItem(ENDPOINT_KEY) || "";
  if (!candidate) return "";
  try {
    const endpoint = normalizeSheetsEndpoint(candidate);
    localStorage.setItem(ENDPOINT_KEY, endpoint);
    return endpoint;
  } catch {
    return "";
  }
}

export function rememberSheetsEndpoint(value: string) {
  const endpoint = normalizeSheetsEndpoint(value);
  localStorage.setItem(ENDPOINT_KEY, endpoint);
  return endpoint;
}

export function forgetSheetsEndpoint() {
  localStorage.removeItem(ENDPOINT_KEY);
  sessionStorage.removeItem(PIN_KEY);
}

export function readEditorPin() {
  return sessionStorage.getItem(PIN_KEY) || "";
}

export function rememberEditorPin(pin: string) {
  const clean = pin.trim();
  if (clean.length < 4) throw new Error("El PIN debe tener al menos 4 caracteres.");
  sessionStorage.setItem(PIN_KEY, clean);
  return clean;
}

export function staffShareUrl(endpoint: string, pageUrl = window.location.href) {
  const url = new URL(pageUrl);
  url.searchParams.set("sheets", deploymentIdFromEndpoint(endpoint));
  url.hash = "";
  return url.toString();
}

function jsonp(endpoint: string, params: Record<string, string>, timeoutMs = 15000) {
  return new Promise<JsonpPayload>((resolve, reject) => {
    const key = Math.random().toString(36).slice(2);
    const callback = `__eibarJsonp_${key}` as const;
    const script = document.createElement("script");
    const url = new URL(normalizeSheetsEndpoint(endpoint));
    Object.entries({ ...params, callback, t: String(Date.now()) }).forEach(([name, value]) =>
      url.searchParams.set(name, value),
    );
    let timer = 0;
    const cleanup = () => {
      window.clearTimeout(timer);
      delete window[callback];
      script.remove();
    };
    window[callback] = (payload) => {
      cleanup();
      if (payload?.error && !payload.pending) reject(new Error(payload.error));
      else resolve(payload);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo conectar con Google Sheets."));
    };
    timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Google Sheets tardó demasiado en responder."));
    }, timeoutMs);
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

export async function loadSheetsState(endpoint: string): Promise<SheetsSnapshot> {
  const payload = await jsonp(endpoint, { action: "load" });
  if (!Number.isInteger(payload.revision) || payload.revision < 0) {
    throw new Error("La respuesta de Google Sheets no es válida.");
  }
  return payload;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function saveSheetsState(endpoint: string, pin: string, state: State, revision: number) {
  const writeId = crypto.randomUUID();
  const body = JSON.stringify({ action: "save", pin, state, revision, writeId });
  try {
    await fetch(normalizeSheetsEndpoint(endpoint), {
      method: "POST",
      mode: "no-cors",
      redirect: "follow",
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
  } catch {
    throw new Error("No se pudo enviar el guardado a Google Sheets.");
  }

  let status: JsonpPayload | null = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await wait(350 + attempt * 250);
    status = await jsonp(endpoint, { action: "status", writeId });
    if (!status.pending) break;
  }
  if (!status || status.pending) {
    throw new Error("No se pudo confirmar el guardado. Recarga antes de volver a intentarlo.");
  }
  if (!status.ok) throw new Error(status.error || "Google Sheets rechazó el guardado.");

  const snapshot = await loadSheetsState(endpoint);
  if (snapshot.revision !== revision + 1 || snapshot.lastWriteId !== writeId || !snapshot.state) {
    throw new Error("El guardado no pudo verificarse. Recarga los datos antes de editar.");
  }
  return snapshot;
}

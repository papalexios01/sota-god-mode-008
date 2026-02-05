import { adaptJinaMarkdownToSitemapXml } from "./jinaSitemapAdapter";

export type FetchSitemapTextConfig = {
  perStrategyTimeoutMs?: number;
  overallTimeoutMs?: number;
  signal?: AbortSignal;
};

type StrategyResult = { name: string; text: string };

function isLikelySitemapXml(text: string): boolean {
  return /<\s*(?:[A-Za-z_][\w.-]*:)?(urlset|sitemapindex)\b/i.test(text);
}

function linkAbortSignals(from: AbortSignal | undefined, to: AbortController): () => void {
  if (!from) return () => undefined;
  const handler = () => to.abort();
  if (from.aborted) {
    to.abort();
    return () => undefined;
  }
  from.addEventListener("abort", handler, { once: true });
  return () => from.removeEventListener("abort", handler);
}

async function fetchTextWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<string> {
  const controller = new AbortController();
  const unlink = linkAbortSignals(externalSignal, controller);
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/aborted|abort/i.test(msg)) {
      throw new Error(`timeout after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw e;
  } finally {
    window.clearTimeout(timeoutId);
    unlink();
  }
}

export async function fetchSitemapTextRaced(
  targetUrl: string,
  config: FetchSitemapTextConfig
): Promise<string> {
  const trimmed = targetUrl.trim();
  if (!trimmed) throw new Error("URL is required");

  const perStrategyTimeoutMs = Math.max(4000, config.perStrategyTimeoutMs ?? 12000);
  const overallTimeoutMs = Math.max(perStrategyTimeoutMs, config.overallTimeoutMs ?? 15000);

  const raceAbort = new AbortController();
  const unlinkExternal = linkAbortSignals(config.signal, raceAbort);

  const strategies: Array<{ name: string; run: (signal: AbortSignal) => Promise<string> }> = [];

  strategies.push({
    name: "API",
    run: (signal) =>
      fetchTextWithTimeout(
        `/api/fetch-sitemap?url=${encodeURIComponent(trimmed)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/xml, text/xml, */*",
          },
        },
        Math.min(25000, Math.max(perStrategyTimeoutMs, 12000)),
        signal
      ),
  });

  strategies.push({
    name: "Direct",
    run: (signal) =>
      fetchTextWithTimeout(
        trimmed,
        {
          method: "GET",
          headers: { Accept: "application/xml, text/xml, */*" },
          mode: "cors",
        },
        8000,
        signal
      ),
  });

  strategies.push({
    name: "AllOrigins",
    run: (signal) =>
      fetchTextWithTimeout(
        `https://api.allorigins.win/raw?url=${encodeURIComponent(trimmed)}`,
        { method: "GET", headers: { Accept: "application/xml, text/xml, */*" } },
        perStrategyTimeoutMs,
        signal
      ),
  });

  strategies.push({
    name: "Jina",
    run: async (signal) => {
      const text = await fetchTextWithTimeout(
        `https://r.jina.ai/${trimmed.startsWith("http") ? trimmed : `https://${trimmed}`}`,
        { method: "GET", headers: { Accept: "application/xml, text/xml, */*" } },
        perStrategyTimeoutMs,
        signal
      );
      return adaptJinaMarkdownToSitemapXml(text, trimmed) ?? text;
    },
  });

  if (strategies.length === 0) throw new Error("No fetch strategies available");

  const errors: string[] = [];

  const overallTimeout = new Promise<never>((_, reject) => {
    const id = window.setTimeout(() => {
      try {
        raceAbort.abort();
      } catch {
      }
      reject(new Error(`All strategies timed out after ${Math.round(overallTimeoutMs / 1000)}s`));
    }, overallTimeoutMs);
    if (config.signal) {
      config.signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(id);
          reject(new Error("Cancelled"));
        },
        { once: true }
      );
    }
  });

  const runner = async (): Promise<StrategyResult> => {
    return new Promise((resolve, reject) => {
      let done = false;
      let completed = 0;

      const finishRejectIfAllFailed = () => {
        if (!done && completed >= strategies.length) {
          reject(new Error(`All strategies failed: ${errors.join(" | ")}`));
        }
      };

      for (const s of strategies) {
        Promise.resolve()
          .then(() => s.run(raceAbort.signal))
          .then((text) => {
            if (done) return;
            if (!isLikelySitemapXml(text)) {
              throw new Error("not sitemap XML");
            }
            done = true;
            try {
              raceAbort.abort();
            } catch {
            }
            resolve({ name: s.name, text });
          })
          .catch((e) => {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`${s.name}: ${msg}`);
            completed += 1;
            finishRejectIfAllFailed();
          });
      }
    });
  };

  try {
    const result = await Promise.race([runner(), overallTimeout]);
    console.log(`[Sitemap] ${result.name} succeeded first`);
    return result.text;
  } finally {
    unlinkExternal();
  }
}

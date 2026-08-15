// Compatibility entry point.
//
// server-v2.ts contains the PDF/OCR analysis and API routes. Gemini 3.6 Flash
// no longer accepts legacy sampling parameters such as `temperature`, `top_p`
// and `top_k`. The existing analyzer still sends `temperature: 0` in its
// structured extraction/verification requests. Keep the analyzer logic and
// prompts unchanged, but strip only those deprecated fields at the HTTP
// boundary so the existing AI pipeline continues to work with Gemini 3.6.

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  if (url.includes("generativelanguage.googleapis.com") && init?.body && typeof init.body === "string") {
    try {
      const body = JSON.parse(init.body);
      const stripLegacySampling = (value: any) => {
        if (!value || typeof value !== "object") return value;
        if (value.generationConfig && typeof value.generationConfig === "object") {
          delete value.generationConfig.temperature;
          delete value.generationConfig.topP;
          delete value.generationConfig.topK;
        }
        return value;
      };

      const cleaned = stripLegacySampling(body);
      init = { ...init, body: JSON.stringify(cleaned) };
    } catch {
      // Leave non-JSON Gemini requests untouched.
    }
  }

  return originalFetch(input, init);
};

// Load the actual application only after the compatibility layer is installed.
await import("./server-v2");

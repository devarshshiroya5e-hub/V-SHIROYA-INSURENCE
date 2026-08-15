// Production/local compatibility entry point for the fixed AI backend.
// The PDF extraction prompts and evidence-first analysis are kept in server-fixed.ts.
(async () => {
  await import("./server-fixed");
})();

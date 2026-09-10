import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
// Only reviewed repository files are executable. Never resolve a request path on disk.
type HtmlPageSpec = { load: () => Promise<string>; adapter: "cash" | "none" };
const pages: Record<string, HtmlPageSpec> = {
  "cash-old": {
    load: () =>
      readFile(
        path.join(process.cwd(), "docs/cash-money/cash-money.html"),
        "utf8",
      ),
    adapter: "cash",
  },
  "etf-us-yield": {
    load: () =>
      readFile(
        path.join(process.cwd(), "src/html/us_yield_calculator.html"),
        "utf8",
      ),
    adapter: "none",
  },
};
const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'">`;
function isolate(html: string) {
  if (!/<head[\s>]/i.test(html)) throw Error("HTML head is required");
  return html.replace(/<head[^>]*>/i, (head) => head + policy);
}
export async function htmlPage(name: string) {
  if (!Object.hasOwn(pages, name)) return null;
  const spec = pages[name];
  const source = await spec.load();
  if (spec.adapter === "none") return isolate(source);
  const [xlsx, chart] = await Promise.all([
    readFile(
      path.join(process.cwd(), "node_modules/xlsx/dist/xlsx.full.min.js"),
      "utf8",
    ),
    readFile(
      path.join(process.cwd(), "node_modules/chart.js/dist/chart.umd.js"),
      "utf8",
    ),
  ]);
  const start = source.indexOf("// ===== Init =====");
  if (start < 0) throw Error("HTML init marker is missing");
  // The original analysis functions and styles stay untouched; only the source adapter changes.
  return (
    isolate(source.slice(0, start))
      .replace(
        /<script src="https:\/\/cdn.sheetjs.com[^\"]+"><\/script>/,
        () => `<script>${xlsx.replace(/<\/script/gi, "<\\/script")}</script>`,
      )
      .replace(
        /<script src="https:\/\/cdn.jsdelivr.net[^\"]+"><\/script>/,
        () => `<script>${chart.replace(/<\/script/gi, "<\\/script")}</script>`,
      ) +
    `
// MONO adapter: in-memory directory backed by one authenticated file load.
let monoLoaded = false;
document.getElementById('app').textContent = '저장된 엑셀을 불러오는 중…';
window.addEventListener('message', async (event) => {
  if (event.source !== window.parent || event.data?.type !== 'mono:cash-files' || monoLoaded) return;
  monoLoaded = true;
  try {
    const files = event.data.files;
    const handle = {
      queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      async *values() { for (const f of files) yield { kind: 'file', name: f.name, getFile: async () => ({ arrayBuffer: async () => f.bytes }) }; }
    };
    state.dirHandle = handle;
    await loadFromHandle(handle);
    window.parent.postMessage({ type: 'mono:cash-loaded' }, '*');
  } catch (error) {
    document.getElementById('app').textContent = '엑셀을 읽지 못했습니다: ' + error.message;
    window.parent.postMessage({ type: 'mono:cash-error' }, '*');
  }
});
window.parent.postMessage({ type: 'mono:cash-ready' }, '*');
</script>
<style>
#btn-folder { display: none !important; }
html, body { overscroll-behavior: contain; }
@media (max-width: 800px) {
  .app { padding: 12px; }
  header.app-header, .modal-header { flex-wrap: wrap; gap: 10px; }
  .section { padding: 14px 10px; }
  .controls { padding: 8px; }
  .control-row { gap: 8px; }
  .table-wrap { max-width: 100%; }
  .table-wrap th:first-child, .table-wrap td:first-child { position: sticky; left: 0; background: #f8fafc; z-index: 1; }
  .detail-panel { width: 100%; }
  .detail-header, .detail-body { padding: 12px; }
  .detail-body { overflow-x: auto; }
  .modal-card { width: 100%; max-height: 94dvh; }
  .modal-body { padding: 12px; }
  .modal-chart-wrap { height: 300px; }
  button, select, .pill { min-height: 40px; }
}
</style>
</body></html>`
  );
}

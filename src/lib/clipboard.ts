// 클립보드 API가 막힌 환경(비보안 연결 등)에서는 선택 복사로 대신한다.
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) throw Error("복사하지 못했습니다.");
  }
}
// 글을 만들려면 서버를 한 번 더 거쳐야 할 때 쓴다. Safari는 클릭 뒤 await가 끼면 클립보드 쓰기를 막으므로
// 클릭한 그 순간에 ClipboardItem에 내용의 Promise를 넘긴다. 지원하지 않는 브라우저는 기다렸다 복사한다.
export async function copyTextLater(text: Promise<string>) {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })),
        }),
      ]);
      return;
    } catch {
      // 글을 만들다 실패했으면 그 오류를 그대로 알린다(await가 다시 던진다).
      // 클립보드 쓰기만 막힌 것이면 아래의 일반 복사로 다시 시도한다.
      await text;
    }
  }
  await copyText(await text);
}

// Không phải Windows (điện thoại, Mac): nói rõ bản cài chạy trên máy tính Windows, cho sao chép link gửi sang máy tính
(() => {
  const ua = navigator.userAgent;
  if (/Windows NT/i.test(ua) && !/Windows Phone/i.test(ua)) return;
  document.getElementById("notWindows").hidden = false;
  const btn = document.getElementById("copyLink");
  btn.addEventListener("click", () => {
    const url = "https://duckmess.thienphuc.tech/";
    const ask = () => prompt("Sao chép link này:", url);
    if (!navigator.clipboard) return ask();
    navigator.clipboard
      .writeText(url)
      .then(() => (btn.textContent = "đã sao chép link"), ask);
  });
})();

// Trang chủ DuckMess: video nền, hiện dần khi cuộn, thanh trên đổi nền, nhắc khi không phải máy Windows
(() => {
  document.documentElement.classList.add("js");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Video nền chỉ tải trên màn hình rộng, không bật tiết kiệm dữ liệu / giảm chuyển động; điện thoại dùng ảnh dọc
  const video = document.querySelector(".hero-video");
  const saveData = navigator.connection && navigator.connection.saveData;
  if (
    video &&
    !reduced &&
    !saveData &&
    matchMedia("(min-width: 768px)").matches
  ) {
    video.src = video.dataset.src;
    video.addEventListener("playing", () => video.classList.add("on"), {
      once: true,
    });
    video.play().catch(() => {});
  }

  // Hiện dần từng khối khi cuộn tới
  const items = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          // các khối cùng hàng hiện lệch nhau một chút
          const siblings = [...e.target.parentElement.children].filter((c) =>
            c.classList.contains("reveal"),
          );
          e.target.style.transitionDelay =
            Math.min(siblings.indexOf(e.target), 5) * 70 + "ms";
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    items.forEach((el) => io.observe(el));
  }

  // Thanh trên có nền mờ khi đã cuộn khỏi đầu trang
  const top = document.querySelector(".top");
  const onScroll = () => top.classList.toggle("scrolled", scrollY > 24);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Không phải Windows (điện thoại, Mac): nói rõ bản cài dành cho máy tính Windows, cho sao chép link gửi sang máy tính
  const ua = navigator.userAgent;
  const isWindows = /Windows NT/i.test(ua) && !/Windows Phone/i.test(ua);
  if (!isWindows) {
    const note = document.getElementById("notWindows");
    note.hidden = false;
    const btn = document.getElementById("copyLink");
    btn.addEventListener("click", () => {
      const url = "https://duckmess.thienphuc.tech/";
      const done = () => (btn.textContent = "đã sao chép ✓");
      if (navigator.clipboard)
        navigator.clipboard
          .writeText(url)
          .then(done, () => prompt("Sao chép link này:", url));
      else prompt("Sao chép link này:", url);
    });
  }
})();

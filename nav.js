(function () {
  document.querySelectorAll(".nav-menu").forEach(function (wrap) {
    var btn = wrap.querySelector(".menu-toggle");
    if (!btn) return;

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = wrap.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  document.addEventListener("click", function () {
    document.querySelectorAll(".nav-menu.is-open").forEach(function (wrap) {
      wrap.classList.remove("is-open");
      var b = wrap.querySelector(".menu-toggle");
      if (b) b.setAttribute("aria-expanded", "false");
    });
  });

  document.querySelectorAll(".dropdown").forEach(function (dd) {
    dd.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  });
})();

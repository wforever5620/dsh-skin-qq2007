window.__ModuleLoader__.load({
  id: "dsh-skin-qq2007",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    /** Package id, also the owner key the module system removes styles by. */
    const PLUGIN_ID = "dsh-skin-qq2007";
    /** Storage key holding the last selected mode. */
    const STORAGE_KEY = "dsh-skin-qq2007.mode";
    /** Authoring stylesheet with the avatar data URI and palette. */
    const STYLE_TEXT = __QQ_CSS__;
    /** Penguin data URI reused by the switch button. */
    const AVATAR = __QQ_AVATAR__;

    /**
     * Read the persisted mode, defaulting to the skin.
     * @returns `"qq"` or `"native"`.
     */
    function readMode() {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === "native" ? "native" : "qq";
      } catch {
        return "qq";
      }
    }

    /**
     * Persist the selected mode, ignoring storage failures.
     * @param mode - `"qq"` or `"native"`.
     */
    function writeMode(mode) {
      try {
        window.localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        /* private mode or storage disabled: the session keeps the in-memory mode */
      }
    }

    /**
     * Own the stylesheet, the switch button, and the body attribute.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      if (typeof document === "undefined") return;
      let mode = readMode();

      const style = document.createElement("style");
      style.dataset.plugin = PLUGIN_ID;
      style.textContent = STYLE_TEXT;
      document.head.appendChild(style);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "qq2007-toggle";
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-label", "QQ 2007 皮肤");
      toggle.innerHTML =
        '<span class="qq2007-toggle-avatar"></span><span class="qq2007-toggle-label"></span>';
      toggle.firstChild.style.backgroundImage = "url(" + AVATAR + ")";
      document.body.appendChild(toggle);

      /**
       * Project the in-memory mode onto the document and the switch.
       */
      const sync = () => {
        const on = mode === "qq";
        document.body.toggleAttribute("data-dsh-qq-skin", on);
        toggle.dataset.mode = mode;
        toggle.setAttribute("aria-checked", on ? "true" : "false");
        toggle.title = on ? "QQ 2007 皮肤已开启，点击切换回原生外观" : "当前为原生外观，点击应用 QQ 2007 皮肤";
        toggle.querySelector(".qq2007-toggle-label").textContent = on ? "QQ" : "原生";
      };

      const onClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        mode = mode === "qq" ? "native" : "qq";
        writeMode(mode);
        sync();
      };

      toggle.addEventListener("click", onClick);
      sync();

      const dispose = () => {
        toggle.removeEventListener("click", onClick);
        toggle.remove();
        style.remove();
        document.body.removeAttribute("data-dsh-qq-skin");
      };

      if (typeof ctx?.effect === "function") ctx.effect(() => dispose);
      else if (typeof ctx?.on === "function") ctx.on("dispose", dispose);
      else window.addEventListener("pagehide", dispose, { once: true });
    }

    exports.PLUGIN_ID = PLUGIN_ID;
    exports.STORAGE_KEY = STORAGE_KEY;
    exports.apply = apply;
    return module.exports;
  },
});

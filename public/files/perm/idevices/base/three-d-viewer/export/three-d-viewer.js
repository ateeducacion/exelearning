(() => {
  // public/files/perm/idevices/base/three-d-viewer/src/interactions/marker-renderer.ts
  function createMarkerButton(marker, options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tdv-marker ${options.variantClass}`;
    button.dataset.markerId = marker.id;
    button.dataset.markerOrder = String(options.index);
    button.setAttribute("aria-label", options.label);
    const icon = document.createElement("span");
    icon.className = `tdv-marker-icon tdv-icon-${marker.icon}`;
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);
    if (options.showLabels && marker.label) {
      const label = document.createElement("span");
      label.className = "tdv-marker-label";
      label.textContent = marker.label;
      button.appendChild(label);
    }
    if (options.activeId === marker.id) {
      button.classList.add("tdv-marker--active");
      button.setAttribute("aria-current", "true");
    }
    button.addEventListener("click", () => options.onActivate(marker.id));
    return button;
  }
  function applyActiveMarker(buttons, activeId) {
    for (const button of buttons) {
      const isActive = button.dataset.markerId === activeId;
      button.classList.toggle("tdv-marker--active", isActive);
      if (isActive) {
        button.setAttribute("aria-current", "true");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  }

  // public/files/perm/idevices/base/three-d-viewer/src/adapters/geometry.ts
  var FACING_THRESHOLD = -0.15;
  function ndcToScreen(ndc, width, height) {
    return {
      x: (ndc.x * 0.5 + 0.5) * width,
      y: (-ndc.y * 0.5 + 0.5) * height
    };
  }
  function isOnScreen(ndc) {
    const inFrustum = ndc.z < 1 && ndc.z > -1;
    return inFrustum && ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1;
  }
  function isFacingCamera(normal, toCamera) {
    return normal.x * toCamera.x + normal.y * toCamera.y + normal.z * toCamera.z > FACING_THRESHOLD;
  }
  function isMarkerVisible(ndc, normal, toCamera) {
    return isFacingCamera(normal, toCamera) && isOnScreen(ndc);
  }
  function parseTriple(value) {
    const parts = String(value ?? "").trim().split(/\s+/).map(Number.parseFloat);
    return {
      x: Number.isFinite(parts[0]) ? parts[0] : 0,
      y: Number.isFinite(parts[1]) ? parts[1] : 0,
      z: Number.isFinite(parts[2]) ? parts[2] : 0
    };
  }
  function formatTriple(vector) {
    return `${vector.x} ${vector.y} ${vector.z}`;
  }
  function pointerToNdc(rect, clientX, clientY) {
    if (!rect.width || !rect.height) {
      return null;
    }
    return {
      x: (clientX - rect.left) / rect.width * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1
    };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/adapters/model-viewer-adapter.ts
  var EMPTY_CAMERA = { orbit: "", target: "", fieldOfView: "" };
  function createModelViewerAdapter(modelViewer, deps) {
    let placeHandler = null;
    const clearMarkers = () => {
      for (const element of Array.from(modelViewer.querySelectorAll('.tdv-marker[slot^="hotspot-"]'))) {
        element.remove();
      }
    };
    const captureCamera = () => {
      try {
        return {
          orbit: modelViewer.getCameraOrbit?.().toString() ?? "",
          target: modelViewer.getCameraTarget?.().toString() ?? "",
          fieldOfView: modelViewer.getFieldOfView ? `${modelViewer.getFieldOfView()}deg` : ""
        };
      } catch {
        return { ...EMPTY_CAMERA };
      }
    };
    return {
      renderMarkers(markers, options) {
        clearMarkers();
        markers.forEach((marker, index) => {
          const button = createMarkerButton(marker, {
            ...options,
            index,
            label: deps.markerLabel(marker, index),
            variantClass: "tdv-marker--mv",
            onActivate: deps.onActivate
          });
          button.setAttribute("slot", `hotspot-${marker.id}`);
          button.dataset.position = formatTriple(marker.anchor.position);
          button.dataset.normal = formatTriple(marker.anchor.normal);
          if (marker.anchor.surface) {
            button.dataset.surface = marker.anchor.surface;
          }
          modelViewer.appendChild(button);
        });
      },
      setActive(activeId) {
        applyActiveMarker(modelViewer.querySelectorAll(".tdv-marker"), activeId);
      },
      focusMarker(marker) {
        const camera = marker.camera;
        if (camera.orbit) {
          modelViewer.cameraOrbit = camera.orbit;
        }
        if (camera.target) {
          modelViewer.cameraTarget = camera.target;
        }
        if (camera.fieldOfView) {
          modelViewer.fieldOfView = camera.fieldOfView;
        }
      },
      captureCamera,
      updateOverlay() {},
      enterPlacementMode(onPlaced) {
        placeHandler = (event) => {
          const hit = modelViewer.positionAndNormalFromPoint?.(event.clientX, event.clientY);
          if (!hit) {
            return;
          }
          onPlaced({
            position: parseTriple(hit.position?.toString()),
            normal: parseTriple(hit.normal?.toString()),
            surface: "",
            camera: captureCamera()
          });
        };
        modelViewer.addEventListener("click", placeHandler);
      },
      exitPlacementMode() {
        if (placeHandler) {
          modelViewer.removeEventListener("click", placeHandler);
          placeHandler = null;
        }
      },
      destroy() {
        this.exitPlacementMode();
        clearMarkers();
      }
    };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/shared/urls.ts
  var EXECUTABLE_SCHEME = /^\s*(javascript|vbscript):/i;
  var EPHEMERAL_OR_EXECUTABLE_SCHEME = /^\s*(blob:|data:|javascript:|vbscript:)/i;
  var ALLOWED_RENDER_SCHEME = /^(https?:|mailto:|tel:|asset:|blob:)/i;
  var HAS_EXPLICIT_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
  var ABSOLUTE_URL = /^(https?:)?\/\//i;
  function stripUnsafeUrl(value) {
    const raw = typeof value === "string" ? value : "";
    return EPHEMERAL_OR_EXECUTABLE_SCHEME.test(raw) ? "" : raw.trim();
  }
  function safeUrl(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) {
      return "";
    }
    if (EXECUTABLE_SCHEME.test(raw)) {
      return "";
    }
    if (ALLOWED_RENDER_SCHEME.test(raw)) {
      return raw;
    }
    return HAS_EXPLICIT_SCHEME.test(raw) ? "" : raw;
  }
  function isAbsoluteUrl(value) {
    return ABSOLUTE_URL.test(value);
  }
  function normalizePath(value) {
    const clean = String(value ?? "").trim().replace(/\\+/g, "/");
    if (!clean) {
      return "";
    }
    return isAbsoluteUrl(clean) ? clean : clean.replace(/^\/+/, "");
  }
  function stripQueryAndHash(value) {
    let out = value;
    const query = out.indexOf("?");
    if (query !== -1) {
      out = out.substring(0, query);
    }
    const hash = out.indexOf("#");
    if (hash !== -1) {
      out = out.substring(0, hash);
    }
    return out;
  }
  function joinAppUrl(baseURL, basePath, path) {
    const base = String(baseURL ?? "").replace(/\/+$/g, "");
    const prefixPath = basePath ? `/${String(basePath).replace(/^\/+|\/+$/g, "")}` : "";
    const prefix = `${base}${prefixPath}`.replace(/\/+$/g, "");
    const normalized = String(path ?? "").replace(/^\/+/, "");
    return prefix ? `${prefix}/${normalized}` : `/${normalized}`;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/shared/model-source.ts
  var KNOWN_EXTENSIONS = ["stl", "glb", "gltf", "obj", "fbx"];
  function detectModelType(src) {
    if (typeof src !== "string") {
      return "unknown";
    }
    const clean = stripQueryAndHash(src.trim());
    const dot = clean.lastIndexOf(".");
    if (dot === -1) {
      return "unknown";
    }
    const ext = clean.substring(dot + 1).toLowerCase();
    return KNOWN_EXTENSIONS.includes(ext) ? ext : "unknown";
  }
  function isStlSource(src) {
    return detectModelType(src) === "stl";
  }
  function normalizeModelSource(src) {
    if (typeof src !== "string") {
      return "";
    }
    const clean = src.trim();
    if (!clean || clean.startsWith("blob:") || clean.startsWith("data:")) {
      return "";
    }
    return clean;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/runtime/lifecycle.ts
  function createInstance(wrapper, options) {
    return {
      wrapper,
      options,
      type: options.type || detectModelType(options.src),
      modelViewer: null,
      canvas: null,
      scene: null,
      camera: null,
      renderer: null,
      controls: null,
      mesh: null,
      geometry: null,
      material: null,
      rafId: null,
      stopped: false,
      listeners: [],
      objectURLs: [],
      onFrame: [],
      interaction: null
    };
  }
  function addFrameCallback(instance, callback) {
    if (!instance.onFrame.includes(callback)) {
      instance.onFrame.push(callback);
    }
  }
  function removeFrameCallback(instance, callback) {
    const index = instance.onFrame.indexOf(callback);
    if (index !== -1) {
      instance.onFrame.splice(index, 1);
    }
  }
  function isTexture(value) {
    return Boolean(value && typeof value === "object" && value.isTexture && typeof value.dispose === "function");
  }
  function disposeMaterial(material) {
    if (!material) {
      return;
    }
    const list = Array.isArray(material) ? material : [material];
    for (const entry of list) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const record = entry;
      for (const key of Object.keys(record)) {
        const value = record[key];
        if (isTexture(value)) {
          value.dispose();
        }
      }
      const dispose = entry.dispose;
      if (typeof dispose === "function") {
        dispose.call(entry);
      }
    }
  }
  function disposeObject3D(object) {
    const traverse = object?.traverse;
    if (typeof traverse !== "function") {
      return;
    }
    object.traverse((node) => {
      if (node?.geometry && typeof node.geometry.dispose === "function") {
        node.geometry.dispose();
      }
      if (node?.material) {
        disposeMaterial(node.material);
      }
    });
  }
  function cancelFrame(rafId) {
    if (typeof globalThis.cancelAnimationFrame === "function") {
      globalThis.cancelAnimationFrame(rafId);
    } else {
      clearTimeout(rafId);
    }
  }
  function disposeInstance(instance) {
    instance.stopped = true;
    if (instance.interaction) {
      try {
        instance.interaction.destroy();
      } catch {}
      instance.interaction = null;
    }
    instance.onFrame.length = 0;
    if (instance.rafId !== null) {
      cancelFrame(instance.rafId);
      instance.rafId = null;
    }
    for (const { target, type, handler, options } of instance.listeners) {
      try {
        target.removeEventListener(type, handler, options);
      } catch {}
    }
    instance.listeners.length = 0;
    try {
      disposeObject3D(instance.scene);
    } catch {}
    try {
      disposeMaterial(instance.material);
    } catch {}
    try {
      instance.geometry?.dispose?.();
    } catch {}
    try {
      instance.controls?.dispose?.();
    } catch {}
    try {
      instance.renderer?.dispose?.();
    } catch {}
    for (const url of instance.objectURLs) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    instance.objectURLs.length = 0;
    instance.scene = null;
    instance.camera = null;
    instance.renderer = null;
    instance.controls = null;
    instance.mesh = null;
    instance.geometry = null;
    instance.material = null;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/adapters/raycast.ts
  function raycastFromPointer(target, clientX, clientY) {
    const three = globalThis.THREE;
    if (!three || !target.mesh || !target.camera || !target.canvas) {
      return null;
    }
    const ndc = pointerToNdc(target.canvas.getBoundingClientRect(), clientX, clientY);
    if (!ndc) {
      return null;
    }
    const raycaster = new three.Raycaster;
    raycaster.setFromCamera(new three.Vector2(ndc.x, ndc.y), target.camera);
    const hit = raycaster.intersectObject(target.mesh, true)[0];
    if (!hit) {
      return null;
    }
    const local = target.mesh.worldToLocal(hit.point.clone());
    const faceNormal = hit.face?.normal;
    return {
      position: { x: local.x, y: local.y, z: local.z },
      normal: faceNormal ? { x: faceNormal.x, y: faceNormal.y, z: faceNormal.z } : { x: 0, y: 1, z: 0 }
    };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/adapters/stl-adapter.ts
  var EMPTY_CAMERA2 = { orbit: "", target: "", fieldOfView: "" };
  function ensureLayer(wrapper) {
    const existing = wrapper.querySelector(".tdv-marker-layer");
    if (existing) {
      return existing;
    }
    const layer = document.createElement("div");
    layer.className = "tdv-marker-layer";
    wrapper.appendChild(layer);
    return layer;
  }
  function createStlAdapter(instance, wrapper, deps) {
    const layer = ensureLayer(wrapper);
    let entries = [];
    let placeHandler = null;
    const updateOverlay = () => {
      const three = globalThis.THREE;
      const { mesh, camera, canvas } = instance;
      if (!three || !mesh || !camera || !canvas || entries.length === 0) {
        return;
      }
      mesh.updateMatrixWorld();
      camera.updateMatrixWorld();
      const width = canvas.clientWidth || canvas.width || 1;
      const height = canvas.clientHeight || canvas.height || 1;
      for (const entry of entries) {
        const world = mesh.localToWorld(entry.local.clone());
        const ndc = world.clone().project(camera);
        const worldNormal = entry.normal.clone().transformDirection(mesh.matrixWorld);
        const toCamera = new three.Vector3().subVectors(camera.position, world).normalize();
        const visible = isMarkerVisible(ndc, worldNormal, toCamera);
        const screen = ndcToScreen(ndc, width, height);
        entry.element.style.left = `${screen.x}px`;
        entry.element.style.top = `${screen.y}px`;
        entry.element.classList.toggle("tdv-marker--hidden", !visible);
        if (visible) {
          entry.element.removeAttribute("tabindex");
          entry.element.removeAttribute("aria-hidden");
        } else {
          entry.element.setAttribute("tabindex", "-1");
          entry.element.setAttribute("aria-hidden", "true");
        }
      }
    };
    addFrameCallback(instance, updateOverlay);
    const captureCamera = () => {
      const camera = instance.camera;
      if (!camera) {
        return { ...EMPTY_CAMERA2 };
      }
      const position = camera.position;
      const target = instance.controls?.target ?? { x: 0, y: 0, z: 0 };
      return {
        orbit: `${position.x} ${position.y} ${position.z}`,
        target: `${target.x} ${target.y} ${target.z}`,
        fieldOfView: `${camera.fov ?? 45}deg`
      };
    };
    return {
      renderMarkers(markers, options) {
        const three = globalThis.THREE;
        layer.innerHTML = "";
        entries = markers.map((marker, index) => {
          const element = createMarkerButton(marker, {
            ...options,
            index,
            label: deps.markerLabel(marker, index),
            variantClass: "tdv-marker--stl",
            onActivate: deps.onActivate
          });
          layer.appendChild(element);
          const { position, normal } = marker.anchor;
          return {
            element,
            local: new three.Vector3(position.x, position.y, position.z),
            normal: new three.Vector3(normal.x, normal.y, normal.z)
          };
        });
        updateOverlay();
      },
      setActive(activeId) {
        applyActiveMarker(entries.map((entry) => entry.element), activeId);
      },
      focusMarker(marker) {
        const camera = instance.camera;
        if (!globalThis.THREE || !camera) {
          return;
        }
        const position = parseTriple(marker.camera.orbit);
        const target = parseTriple(marker.camera.target);
        if (marker.camera.orbit) {
          camera.position.set(position.x, position.y, position.z);
        }
        if (!marker.camera.target) {
          return;
        }
        if (instance.controls) {
          instance.controls.target.set(target.x, target.y, target.z);
          instance.controls.update?.();
        } else {
          camera.lookAt(target.x, target.y, target.z);
        }
      },
      captureCamera,
      updateOverlay,
      enterPlacementMode(onPlaced) {
        const canvas = instance.canvas;
        if (!canvas) {
          return;
        }
        placeHandler = (event) => {
          const hit = raycastFromPointer(instance, event.clientX, event.clientY);
          if (!hit) {
            return;
          }
          onPlaced({ position: hit.position, normal: hit.normal, surface: "", camera: captureCamera() });
        };
        canvas.addEventListener("click", placeHandler);
      },
      exitPlacementMode() {
        if (placeHandler && instance.canvas) {
          instance.canvas.removeEventListener("click", placeHandler);
        }
        placeHandler = null;
      },
      destroy() {
        this.exitPlacementMode();
        removeFrameCallback(instance, updateOverlay);
        try {
          layer.remove();
        } catch {}
        entries = [];
      }
    };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/runtime/asset-resolver.ts
  function getAssetManager() {
    const project = globalThis.eXeLearning?.app?.project;
    const local = project?.assetManager ?? project?._yjsBridge?.assetManager;
    if (local) {
      return local;
    }
    try {
      const parentWindow = globalThis.parent;
      const parentProject = parentWindow?.eXeLearning?.app?.project;
      return parentProject?.assetManager ?? parentProject?._yjsBridge?.assetManager ?? null;
    } catch {
      return null;
    }
  }
  async function resolveModelSource(src, assetManager) {
    if (typeof src !== "string") {
      return "";
    }
    const trimmed = src.trim();
    if (!trimmed) {
      return "";
    }
    if (!trimmed.startsWith("asset://")) {
      return trimmed;
    }
    const manager = assetManager ?? getAssetManager();
    if (!manager) {
      return "";
    }
    try {
      const sync = manager.resolveAssetURLSync?.(trimmed);
      if (sync) {
        return sync;
      }
      const resolved = await manager.resolveAssetURL?.(trimmed);
      return resolved ?? "";
    } catch {
      return "";
    }
  }
  function resolveMediaUrlSync(url, assetManager) {
    const raw = typeof url === "string" ? url.trim() : "";
    if (!raw || !raw.startsWith("asset://")) {
      return raw;
    }
    const manager = assetManager ?? getAssetManager();
    if (!manager?.resolveAssetURLSync) {
      return raw;
    }
    try {
      return manager.resolveAssetURLSync(raw) || raw;
    } catch {
      return raw;
    }
  }
  async function resolveAssetUrlAsync(assetUrl, timeoutMs = 1e4, pollIntervalMs = 100) {
    if (!assetUrl.startsWith("asset://")) {
      return null;
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const resolved = await resolveModelSource(assetUrl);
      if (resolved) {
        return resolved;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    return null;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/shared/html.ts
  var ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
  }
  function stripHtmlToText(html) {
    return String(html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  function escapeJsonForScript(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
  }
  var BANNED_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "LINK",
    "META",
    "BASE",
    "FORM",
    "FRAME",
    "FRAMESET",
    "FOREIGNOBJECT",
    "ANNOTATION-XML"
  ]);
  var URL_ATTRIBUTES = new Set([
    "href",
    "src",
    "srcset",
    "srcdoc",
    "xlink:href",
    "action",
    "formaction",
    "poster",
    "ping",
    "data",
    "background"
  ]);
  function sanitizeElement(element) {
    if (BANNED_TAGS.has(element.tagName.toUpperCase())) {
      element.remove();
      return false;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (URL_ATTRIBUTES.has(name) && !safeUrl(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
    return true;
  }
  function sanitizeChildren(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== 1) {
        continue;
      }
      if (sanitizeElement(child)) {
        sanitizeChildren(child);
      }
    }
  }
  function sanitizeHtml(html) {
    const source = typeof html === "string" ? html : "";
    if (!source) {
      return "";
    }
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      return escapeHtml(source);
    }
    const template = document.createElement("template");
    template.innerHTML = source;
    sanitizeChildren(template.content);
    return template.innerHTML;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/interactions/dialog.ts
  var FOCUSABLE_SELECTOR = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function getFocusable(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => element.offsetParent !== null || element === document.activeElement);
  }
  function openDialog(options, buildBody) {
    const previouslyFocused = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "tdv-dialog-overlay";
    const dialog = document.createElement("div");
    dialog.className = "tdv-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", options.title);
    const header = document.createElement("div");
    header.className = "tdv-dialog-header";
    const heading = document.createElement("h2");
    heading.className = "tdv-dialog-title";
    heading.textContent = options.title;
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "tdv-dialog-close";
    closeButton.setAttribute("aria-label", options.closeLabel);
    closeButton.textContent = "✕";
    header.append(heading, closeButton);
    const body = document.createElement("div");
    body.className = "tdv-dialog-body";
    dialog.append(header, body);
    overlay.appendChild(dialog);
    (options.host ?? document.body).appendChild(overlay);
    buildBody(body);
    let closed = false;
    const close = () => {
      if (closed) {
        return;
      }
      closed = true;
      try {
        overlay.remove();
      } catch {}
      if (previouslyFocused instanceof HTMLElement) {
        try {
          previouslyFocused.focus();
        } catch {}
      }
      options.onClose?.();
    };
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close();
      }
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = getFocusable(dialog);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    try {
      closeButton.focus();
    } catch {}
    return { overlay, dialog, body, close };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/interactions/fallback.ts
  var webglAvailable = null;
  function hasWebGL() {
    if (typeof globalThis.__tdvForceWebGL === "boolean") {
      return globalThis.__tdvForceWebGL;
    }
    if (webglAvailable !== null) {
      return webglAvailable;
    }
    try {
      if (typeof document === "undefined" || typeof document.createElement !== "function") {
        webglAvailable = true;
        return webglAvailable;
      }
      const canvas = document.createElement("canvas");
      webglAvailable = Boolean(canvas.getContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
    } catch {
      webglAvailable = false;
    }
    return webglAvailable;
  }
  function revealFallback(wrapper, show) {
    const list = wrapper?.querySelector(".tdv-fallback");
    if (list) {
      list.hidden = !show;
    }
  }

  // public/files/perm/idevices/base/three-d-viewer/src/interactions/guided-navigation.ts
  function resolveStepIndex(current, delta, total, wrap) {
    if (total <= 0) {
      return null;
    }
    const start = current < 0 ? delta > 0 ? -1 : total : current;
    const next = start + delta;
    if (wrap) {
      return (next % total + total) % total;
    }
    return next < 0 || next >= total ? null : next;
  }
  function buildControls(t) {
    const nav = document.createElement("div");
    nav.className = "tdv-guided-nav";
    nav.setAttribute("data-guided", "");
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "tdv-nav-prev";
    previous.textContent = t("Previous");
    const status = document.createElement("span");
    status.className = "tdv-guided-status";
    status.setAttribute("aria-live", "polite");
    const next = document.createElement("button");
    next.type = "button";
    next.className = "tdv-nav-next";
    next.textContent = t("Next");
    nav.append(previous, status, next);
    return nav;
  }
  function createGuidedNavigation(wrapper, deps) {
    let nav = wrapper?.querySelector(".tdv-guided-nav") ?? null;
    let created = false;
    const listeners = [];
    const ensureNav = () => {
      if (nav || !wrapper) {
        return nav;
      }
      nav = buildControls(deps.t);
      created = true;
      wrapper.appendChild(nav);
      return nav;
    };
    const bindOnce = (element) => {
      if (element.dataset.tdvBound === "1") {
        return;
      }
      element.dataset.tdvBound = "1";
      const previousButton = element.querySelector(".tdv-nav-prev");
      const nextButton = element.querySelector(".tdv-nav-next");
      if (previousButton) {
        const handler = () => deps.onGo(-1);
        previousButton.addEventListener("click", handler);
        listeners.push(() => previousButton.removeEventListener("click", handler));
      }
      if (nextButton) {
        const handler = () => deps.onGo(1);
        nextButton.addEventListener("click", handler);
        listeners.push(() => nextButton.removeEventListener("click", handler));
      }
    };
    return {
      update({ enabled, index, total, wrap }) {
        if (!enabled) {
          if (nav) {
            nav.hidden = true;
          }
          return;
        }
        const element = ensureNav();
        if (!element) {
          return;
        }
        element.hidden = false;
        const previousButton = element.querySelector(".tdv-nav-prev");
        const nextButton = element.querySelector(".tdv-nav-next");
        if (previousButton && !previousButton.textContent) {
          previousButton.textContent = deps.t("Previous");
        }
        if (nextButton && !nextButton.textContent) {
          nextButton.textContent = deps.t("Next");
        }
        bindOnce(element);
        const empty = total === 0;
        if (previousButton) {
          previousButton.disabled = empty || !wrap && index <= 0;
        }
        if (nextButton) {
          nextButton.disabled = empty || !wrap && index >= total - 1;
        }
        const status = element.querySelector(".tdv-guided-status");
        if (status) {
          status.textContent = `${deps.t("Marker")} ${index < 0 ? 0 : index + 1} / ${total}`;
        }
      },
      destroy() {
        for (const off of listeners) {
          off();
        }
        listeners.length = 0;
        if (created && nav) {
          try {
            nav.remove();
          } catch {}
        }
        nav = null;
      }
    };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/shared/scoring.ts
  var SCORE_SCALE = 10;
  function gradeSingleChoice(question, selectedOptionId) {
    const chosen = question.options.find((option) => option.id === selectedOptionId);
    return Boolean(chosen?.correct);
  }
  function questionMarkers(markers) {
    return markers.filter((marker) => marker.action.type === "question");
  }
  function computeScore(markers, correctMarkerIds) {
    const questions = questionMarkers(markers);
    if (questions.length === 0) {
      return 0;
    }
    const correct = questions.filter((marker) => correctMarkerIds.has(marker.id)).length;
    return correct * SCORE_SCALE / questions.length;
  }
  function isActivityComplete(markers, correctMarkerIds) {
    const questions = questionMarkers(markers);
    return questions.length > 0 && questions.every((marker) => correctMarkerIds.has(marker.id));
  }

  // public/files/perm/idevices/base/three-d-viewer/src/interactions/question.ts
  function lockQuestion(inputs, checkButton) {
    checkButton.disabled = true;
    for (const input of inputs) {
      input.disabled = true;
    }
  }
  function renderQuestion(body, marker, deps) {
    if (marker.action.type !== "question") {
      return;
    }
    const question = marker.action.payload;
    const { answers, t } = deps;
    const state = answers.get(marker.id);
    const fieldset = document.createElement("fieldset");
    fieldset.className = "tdv-question";
    const legend = document.createElement("legend");
    legend.className = "tdv-question-prompt";
    legend.textContent = question.prompt;
    fieldset.appendChild(legend);
    const groupName = `tdv-q-${marker.id}`;
    const inputs = [];
    for (const option of question.options) {
      const label = document.createElement("label");
      label.className = "tdv-question-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = groupName;
      input.value = option.id;
      if (option.id === state.selectedOptionId) {
        input.checked = true;
      }
      const text = document.createElement("span");
      text.textContent = option.text;
      label.append(input, text);
      fieldset.appendChild(label);
      inputs.push(input);
    }
    const checkButton = document.createElement("button");
    checkButton.type = "button";
    checkButton.className = "tdv-q-check";
    checkButton.textContent = t("Check");
    const feedback = document.createElement("div");
    feedback.className = "tdv-q-feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    body.append(fieldset, checkButton, feedback);
    if (state.resolved) {
      feedback.className = "tdv-q-feedback tdv-q-feedback--correct";
      feedback.textContent = question.feedbackCorrect || t("Correct");
      lockQuestion(inputs, checkButton);
    } else if (answers.isExhausted(marker.id, question.attemptsAllowed)) {
      feedback.className = "tdv-q-feedback tdv-q-feedback--incorrect";
      feedback.textContent = `${question.feedbackIncorrect || t("Incorrect")} ${t("No attempts left")}`;
      lockQuestion(inputs, checkButton);
    }
    checkButton.addEventListener("click", () => {
      const chosen = inputs.find((input) => input.checked);
      if (!chosen) {
        feedback.className = "tdv-q-feedback";
        feedback.textContent = t("Please select an answer");
        return;
      }
      const correct = gradeSingleChoice(question, chosen.value);
      const next = answers.recordAttempt(marker.id, chosen.value, correct);
      try {
        deps.onAnswered?.(marker.id, correct);
      } catch {}
      if (correct) {
        feedback.className = "tdv-q-feedback tdv-q-feedback--correct";
        feedback.textContent = question.feedbackCorrect || t("Correct");
        lockQuestion(inputs, checkButton);
        return;
      }
      feedback.className = "tdv-q-feedback tdv-q-feedback--incorrect";
      let message = question.feedbackIncorrect || t("Incorrect");
      if (question.attemptsAllowed > 0 && next.attempts >= question.attemptsAllowed) {
        lockQuestion(inputs, checkButton);
        message += ` ${t("No attempts left")}`;
      }
      feedback.textContent = message;
    });
  }

  // public/files/perm/idevices/base/three-d-viewer/src/interactions/state.ts
  function emptyState() {
    return { attempts: 0, resolved: false, selectedOptionId: "" };
  }
  function createAnswerStore() {
    const states = new Map;
    const get = (markerId) => states.get(markerId) ?? emptyState();
    return {
      get,
      recordAttempt(markerId, selectedOptionId, correct) {
        const previous = get(markerId);
        const next = {
          attempts: previous.attempts + 1,
          resolved: previous.resolved || correct,
          selectedOptionId
        };
        states.set(markerId, next);
        return next;
      },
      isExhausted(markerId, attemptsAllowed) {
        if (attemptsAllowed <= 0) {
          return false;
        }
        return get(markerId).attempts >= attemptsAllowed;
      },
      correctMarkerIds() {
        const ids = new Set;
        for (const [markerId, state] of states) {
          if (state.resolved) {
            ids.add(markerId);
          }
        }
        return ids;
      },
      retain(markerIds) {
        const keep = new Set(markerIds);
        for (const markerId of [...states.keys()]) {
          if (!keep.has(markerId)) {
            states.delete(markerId);
          }
        }
      },
      clear() {
        states.clear();
      }
    };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/interactions/controller.ts
  var EMPTY_CAMERA3 = { orbit: "", target: "", fieldOfView: "" };
  function emptyState2() {
    return {
      enabled: false,
      guidedMode: false,
      wrapNavigation: false,
      showMarkerLabels: true,
      activeMarkerId: "",
      markers: []
    };
  }
  function buildActionBody(body, marker, deps) {
    if (marker.description) {
      const description = document.createElement("p");
      description.className = "tdv-dialog-description";
      description.textContent = marker.description;
      body.appendChild(description);
    }
    const action = marker.action;
    switch (action.type) {
      case "information": {
        const container = document.createElement("div");
        container.className = "tdv-dialog-html";
        container.innerHTML = deps.sanitize(action.payload.html);
        body.appendChild(container);
        return;
      }
      case "image": {
        const figure = document.createElement("figure");
        figure.className = "tdv-dialog-figure";
        const image = document.createElement("img");
        image.src = deps.resolveMedia(action.payload.src);
        image.alt = action.payload.alt;
        figure.appendChild(image);
        if (action.payload.caption) {
          const caption = document.createElement("figcaption");
          caption.textContent = action.payload.caption;
          figure.appendChild(caption);
        }
        body.appendChild(figure);
        return;
      }
      case "video": {
        const video = document.createElement("video");
        video.className = "tdv-dialog-video";
        video.controls = true;
        video.src = deps.resolveMedia(action.payload.src);
        if (action.payload.poster) {
          video.poster = deps.resolveMedia(action.payload.poster);
        }
        body.appendChild(video);
        return;
      }
      case "link":
      case "question":
        return;
    }
  }
  function createInteractionController(handle, interaction, mode, hooks = {}) {
    const wrapper = handle.wrapper;
    const translate = hooks.t ?? ((key) => key);
    const resolveMedia = hooks.resolveMediaUrl ?? ((url) => resolveMediaUrlSync(url));
    const sanitize = hooks.sanitizeHtml ?? sanitizeHtml;
    const answers = createAnswerStore();
    let state = interaction ?? emptyState2();
    let markers = state.markers;
    let activeId = "";
    let destroyed = false;
    let dialog = null;
    let adapter = null;
    let guided = null;
    const markerLabel = (marker, index) => marker.label || `${translate("Marker")} ${index + 1}`;
    const closeDialog = () => {
      dialog?.close();
      dialog = null;
    };
    const currentIndex = () => markers.findIndex((marker) => marker.id === activeId);
    const updateGuided = () => {
      guided?.update({
        enabled: Boolean(state.guidedMode),
        index: currentIndex(),
        total: markers.length,
        wrap: Boolean(state.wrapNavigation)
      });
    };
    const setActive = (markerId) => {
      activeId = markerId;
      adapter?.setActive(activeId);
      updateGuided();
    };
    const activateMarker = (marker, index) => {
      if (marker.action.type === "link") {
        const url = safeUrl(marker.action.payload.url);
        if (!url) {
          return;
        }
        if (marker.action.payload.newTab) {
          globalThis.open(url, "_blank", "noopener,noreferrer");
        } else if (globalThis.location) {
          globalThis.location.href = url;
        }
        return;
      }
      closeDialog();
      dialog = openDialog({
        title: markerLabel(marker, index),
        closeLabel: translate("Close"),
        host: wrapper ?? null,
        onClose: () => {
          dialog = null;
        }
      }, (body) => {
        buildActionBody(body, marker, { sanitize, resolveMedia });
        if (marker.action.type === "question") {
          renderQuestion(body, marker, {
            answers,
            t: translate,
            onAnswered: hooks.onQuestionAnswered
          });
        }
      });
      hooks.onActivate?.(marker.id);
    };
    const focusMarker = (markerId) => {
      const index = markers.findIndex((marker2) => marker2.id === markerId);
      const marker = markers[index];
      if (!marker) {
        return;
      }
      setActive(markerId);
      adapter?.focusMarker(marker);
      activateMarker(marker, index);
    };
    const go = (delta) => {
      const next = resolveStepIndex(currentIndex(), delta, markers.length, Boolean(state.wrapNavigation));
      const marker = next === null ? undefined : markers[next];
      if (marker) {
        focusMarker(marker.id);
      }
    };
    const render = () => {
      if (destroyed) {
        return;
      }
      markers = state.markers;
      if (adapter) {
        adapter.renderMarkers(markers, {
          showLabels: state.showMarkerLabels !== false,
          activeId
        });
        revealFallback(wrapper, !hasWebGL());
      } else {
        revealFallback(wrapper, true);
      }
      updateGuided();
    };
    const controller = {
      setState(next) {
        state = next ?? emptyState2();
        const ids = state.markers.map((marker) => marker.id);
        if (activeId && !ids.includes(activeId)) {
          activeId = "";
        }
        answers.retain(ids);
        render();
      },
      render,
      enterPlacementMode() {
        if (!adapter || mode !== "edit") {
          return;
        }
        wrapper?.classList.add("tdv-placing");
        adapter.enterPlacementMode((placement) => {
          controller.exitPlacementMode();
          hooks.onPlaced?.(placement);
        });
      },
      exitPlacementMode() {
        wrapper?.classList.remove("tdv-placing");
        adapter?.exitPlacementMode();
      },
      focusMarker,
      captureCamera: () => adapter?.captureCamera() ?? { ...EMPTY_CAMERA3 },
      next: () => go(1),
      previous: () => go(-1),
      getActiveId: () => activeId,
      markerLabel,
      destroy() {
        if (destroyed) {
          return;
        }
        destroyed = true;
        controller.exitPlacementMode();
        closeDialog();
        guided?.destroy();
        guided = null;
        adapter?.destroy();
        adapter = null;
        answers.clear();
      }
    };
    const adapterDeps = { markerLabel, onActivate: focusMarker };
    if ((handle.type === "glb" || handle.type === "gltf") && handle.modelViewer) {
      adapter = createModelViewerAdapter(handle.modelViewer, adapterDeps);
    } else if (handle.type === "stl" && handle.instance) {
      adapter = createStlAdapter(handle.instance, wrapper, adapterDeps);
    }
    guided = createGuidedNavigation(wrapper ?? null, { t: translate, onGo: go });
    render();
    return controller;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/shared/colors.ts
  var DEFAULT_MODEL_COLOR = "#888888";
  var DEFAULT_BACKGROUND_COLOR = "#f5f5f5";
  var HEX6 = /^#[0-9a-f]{6}$/;
  var HEX3 = /^#[0-9a-f]{3}$/;
  function normalizeColor(value, fallback = DEFAULT_MODEL_COLOR) {
    if (typeof value !== "string") {
      return fallback;
    }
    const trimmed = value.trim().toLowerCase();
    if (HEX6.test(trimmed)) {
      return trimmed;
    }
    if (HEX3.test(trimmed)) {
      const r = trimmed[1] ?? "0";
      const g = trimmed[2] ?? "0";
      const b = trimmed[3] ?? "0";
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return fallback;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/runtime/instance-registry.ts
  function createRegistry() {
    const instances = new Map;
    const destroy = (wrapper) => {
      const instance = instances.get(wrapper);
      if (!instance) {
        return;
      }
      instances.delete(wrapper);
      disposeInstance(instance);
    };
    return {
      get: (wrapper) => instances.get(wrapper),
      set: (wrapper, instance) => {
        instances.set(wrapper, instance);
      },
      has: (wrapper) => instances.has(wrapper),
      destroy,
      destroyAll: () => {
        for (const wrapper of [...instances.keys()].reverse()) {
          destroy(wrapper);
        }
      },
      wrappers: () => [...instances.keys()]
    };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/runtime/stl-renderer.ts
  var NORMALIZED_SIZE = 2;
  function configureRendererColorManagement(renderer) {
    const three = globalThis.THREE;
    if (!three || !renderer) {
      return;
    }
    if (three.ColorManagement && "enabled" in three.ColorManagement) {
      three.ColorManagement.enabled = true;
    }
    if ("outputColorSpace" in renderer && three.SRGBColorSpace !== undefined) {
      renderer.outputColorSpace = three.SRGBColorSpace;
    } else if ("outputEncoding" in renderer && three.sRGBEncoding !== undefined) {
      renderer.outputEncoding = three.sRGBEncoding;
    }
    if ("toneMapping" in renderer && three.NoToneMapping !== undefined) {
      renderer.toneMapping = three.NoToneMapping;
    }
  }
  function ensureCanvas(wrapper) {
    const existing = wrapper.querySelector("canvas.three-js-canvas");
    if (existing) {
      return existing;
    }
    const canvas = document.createElement("canvas");
    canvas.className = "three-js-canvas";
    canvas.style.cssText = "width: 100%; height: 100%; display: block;";
    wrapper.appendChild(canvas);
    return canvas;
  }
  function requestFrame(callback) {
    const raf = globalThis.requestAnimationFrame;
    return typeof raf === "function" ? raf(callback) : setTimeout(callback, 16);
  }
  async function bootStl(instance) {
    const three = globalThis.THREE;
    if (!three?.STLLoader || instance.stopped) {
      return;
    }
    const { options, wrapper } = instance;
    const url = await resolveModelSource(options.src);
    if (instance.stopped || !url) {
      return;
    }
    const canvas = ensureCanvas(wrapper);
    instance.canvas = canvas;
    const modelViewer = wrapper.querySelector("model-viewer");
    if (modelViewer) {
      modelViewer.style.display = "none";
      instance.modelViewer = modelViewer;
    }
    const width = wrapper.clientWidth || 400;
    const height = wrapper.clientHeight || 300;
    const scene = new three.Scene;
    scene.background = new three.Color(normalizeColor(options.backgroundColor, DEFAULT_BACKGROUND_COLOR));
    const camera = new three.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderer = new three.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio?.(Math.min(globalThis.devicePixelRatio || 1, 2));
    configureRendererColorManagement(renderer);
    instance.scene = scene;
    instance.camera = camera;
    instance.renderer = renderer;
    scene.add(new three.AmbientLight(16777215, 0.6));
    const keyLight = new three.DirectionalLight(16777215, 0.8);
    keyLight.position.set(1, 1, 1);
    scene.add(keyLight);
    const fillLight = new three.DirectionalLight(16777215, 0.4);
    fillLight.position.set(-1, -1, -1);
    scene.add(fillLight);
    try {
      const response = await fetch(url);
      if (instance.stopped) {
        return;
      }
      const buffer = await response.arrayBuffer();
      if (instance.stopped) {
        return;
      }
      const geometry = new three.STLLoader().parse(buffer);
      geometry.computeBoundingBox();
      geometry.center();
      const size = geometry.boundingBox?.getSize(new three.Vector3);
      const maxDimension = size ? Math.max(size.x, size.y, size.z) || 1 : 1;
      const scale = NORMALIZED_SIZE / maxDimension;
      geometry.scale(scale, scale, scale);
      if (!geometry.hasAttribute("normal")) {
        geometry.computeVertexNormals();
      }
      const material = new three.MeshStandardMaterial({
        color: new three.Color(normalizeColor(options.modelColor, DEFAULT_MODEL_COLOR)),
        metalness: 0,
        roughness: 0.55
      });
      const mesh = new three.Mesh(geometry, material);
      scene.add(mesh);
      camera.position.set(3, 3, 3);
      camera.lookAt(0, 0, 0);
      let controls = null;
      if (options.cameraControls && three.OrbitControls) {
        const orbitControls = new three.OrbitControls(camera, canvas);
        orbitControls.enableDamping = true;
        orbitControls.dampingFactor = 0.05;
        controls = orbitControls;
      }
      instance.mesh = mesh;
      instance.geometry = geometry;
      instance.material = material;
      instance.controls = controls;
      const autoRotate = options.autoRotate;
      const radiansPerSecond = (options.autoRotateSpeed || 30) * Math.PI / 180;
      const animate = () => {
        if (instance.stopped || !instance.renderer || !instance.scene || !instance.camera) {
          return;
        }
        if (autoRotate && instance.mesh) {
          instance.mesh.rotation.y += radiansPerSecond / 60;
        }
        instance.controls?.update?.();
        for (const callback of instance.onFrame) {
          try {
            callback();
          } catch {}
        }
        instance.renderer.render(instance.scene, instance.camera);
        instance.rafId = requestFrame(animate);
      };
      animate();
      const empty = wrapper.querySelector("[data-empty], [data-empty-state]");
      if (empty) {
        empty.style.display = "none";
      }
    } catch (error) {
      console.error("[3D Viewer] Failed to render STL:", error);
    }
  }

  // public/files/perm/idevices/base/three-d-viewer/src/runtime/viewer-runtime.ts
  function readWrapperOptions(wrapper) {
    const data = wrapper.dataset;
    const showNavControls = data.showNavControls === "true";
    const src = normalizeModelSource(data.modelSrc ?? "");
    return {
      src,
      type: data.modelType || detectModelType(src),
      modelColor: normalizeColor(data.modelColor, DEFAULT_MODEL_COLOR),
      backgroundColor: normalizeColor(data.backgroundColor, DEFAULT_BACKGROUND_COLOR),
      cameraControls: data.cameraControls !== "false",
      autoRotate: !showNavControls && data.autoRotate !== "false",
      autoRotateSpeed: Number.parseFloat(data.autoRotateSpeed ?? "") || 30
    };
  }
  function createViewerRuntime() {
    const registry = createRegistry();
    let unloadBound = false;
    const bindUnloadOnce = () => {
      if (unloadBound || typeof globalThis.addEventListener !== "function") {
        return;
      }
      unloadBound = true;
      globalThis.addEventListener("beforeunload", () => registry.destroyAll());
    };
    return {
      init(wrapper, options) {
        if (!wrapper) {
          return null;
        }
        const existing = registry.get(wrapper);
        if (existing) {
          return existing;
        }
        const instance = createInstance(wrapper, options ?? readWrapperOptions(wrapper));
        registry.set(wrapper, instance);
        bindUnloadOnce();
        if (instance.type === "stl" && instance.options.src) {
          bootStl(instance).catch((error) => {
            console.error("[3D Viewer] STL boot failed:", error);
          });
        }
        return instance;
      },
      destroy: (wrapper) => registry.destroy(wrapper),
      destroyAll: () => registry.destroyAll(),
      getInstance: (wrapper) => registry.get(wrapper) ?? null,
      createInteractionLayer: (handle, interaction, mode, hooks) => createInteractionController(handle, interaction, mode, hooks),
      detectModelType,
      normalizeColor,
      normalizeModelSource,
      resolveModelSource,
      configureRendererColorManagement,
      disposeObject3D,
      disposeMaterial,
      readWrapperOptions,
      registry
    };
  }
  function publishViewerRuntime() {
    const existing = globalThis.eXe3DViewer;
    if (existing) {
      return existing;
    }
    const runtime = createViewerRuntime();
    globalThis.eXe3DViewer = runtime;
    return runtime;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/runtime/paths.ts
  var LIB_RELATIVE_PATH = "files/perm/idevices/base/three-d-viewer/export/";
  var EXPORT_LIB_PATH = "idevices/three-d-viewer/";
  function parseRuntimeConfig() {
    const config = globalThis.eXeLearning?.config;
    if (typeof config !== "string") {
      return config ?? null;
    }
    try {
      return JSON.parse(config);
    } catch {
      return null;
    }
  }
  function detectMode() {
    const config = parseRuntimeConfig();
    const documentId = typeof document !== "undefined" ? document.documentElement.id : "";
    const isOnIndexPage = documentId === "exe-index";
    return {
      isStaticMode: Boolean(config?.isStaticMode || config?.isOfflineInstallation),
      isServerMode: config?.baseURL !== undefined,
      isExportMode: isOnIndexPage || typeof document !== "undefined" && document.querySelector('html[id^="exe-"]') !== null,
      isOnIndexPage
    };
  }
  function resolveAppUrl(path) {
    const symfony = globalThis.eXeLearning?.symfony ?? {};
    return joinAppUrl(symfony.baseURL, symfony.basePath, path);
  }
  function getIdeviceResourcesBase(ideviceId) {
    if (!ideviceId) {
      return "";
    }
    const onIndex = typeof document !== "undefined" && document.documentElement.id === "exe-index";
    return onIndex ? `content/resources/${ideviceId}/` : `../content/resources/${ideviceId}/`;
  }
  function getExportLibBaseUrl() {
    const mode = detectMode();
    if (mode.isStaticMode) {
      return `${globalThis.location?.origin ?? ""}/${LIB_RELATIVE_PATH}`;
    }
    if (mode.isServerMode) {
      const config = parseRuntimeConfig();
      const baseURL2 = String(config?.baseURL || globalThis.location?.origin || "").replace(/\/+$/g, "");
      const basePath2 = config?.basePath ? `/${config.basePath.replace(/^\/+|\/+$/g, "")}` : "";
      return `${baseURL2}${basePath2}/${LIB_RELATIVE_PATH}`;
    }
    if (mode.isExportMode) {
      const href = globalThis.location?.href ?? "";
      const pageBase = href.substring(0, href.lastIndexOf("/") + 1);
      return `${pageBase}${mode.isOnIndexPage ? "" : "../"}${EXPORT_LIB_PATH}`;
    }
    const symfony = globalThis.eXeLearning?.symfony ?? {};
    const baseURL = String(symfony.baseURL || globalThis.location?.origin || "").replace(/\/+$/g, "");
    const basePath = symfony.basePath ? `/${String(symfony.basePath).replace(/^\/+|\/+$/g, "")}` : "";
    return `${baseURL}${basePath}/${LIB_RELATIVE_PATH}`;
  }
  function getExportModelViewerUrl() {
    const mode = detectMode();
    const path = `${LIB_RELATIVE_PATH}model-viewer.min.js`;
    if (mode.isStaticMode) {
      return `./${path}`;
    }
    if (mode.isServerMode) {
      return resolveAppUrl(path);
    }
    if (mode.isExportMode) {
      return `${mode.isOnIndexPage ? "./" : "../"}${EXPORT_LIB_PATH}model-viewer.min.js`;
    }
    return resolveAppUrl(path);
  }

  // public/files/perm/idevices/base/three-d-viewer/src/shared/types.ts
  var MARKER_ICONS = ["circle", "pin", "info", "question", "star"];
  var MARKER_ACTION_TYPES = ["information", "image", "video", "link", "question"];

  // public/files/perm/idevices/base/three-d-viewer/src/shared/schema.ts
  var MAX_QUESTION_OPTIONS = 10;
  var MAX_ATTEMPTS_ALLOWED = 20;
  var defaultIdFactory = (prefix) => `${prefix}-${Math.floor(Math.random() * 1e9).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function toNumber(value, fallback) {
    const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function toInteger(value, fallback) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function toText(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function keepOrCreateId(value, prefix, createId) {
    return typeof value === "string" && value ? value : createId(prefix);
  }
  function normalizeVector3(value, fallback) {
    const raw = asRecord(value);
    return {
      x: toNumber(raw.x, fallback.x),
      y: toNumber(raw.y, fallback.y),
      z: toNumber(raw.z, fallback.z)
    };
  }
  function normalizeAnchor(value) {
    const raw = asRecord(value);
    return {
      position: normalizeVector3(raw.position, { x: 0, y: 0, z: 0 }),
      normal: normalizeVector3(raw.normal, { x: 0, y: 1, z: 0 }),
      surface: toText(raw.surface)
    };
  }
  function normalizeCamera(value) {
    const raw = asRecord(value);
    return {
      orbit: toText(raw.orbit),
      target: toText(raw.target),
      fieldOfView: toText(raw.fieldOfView)
    };
  }
  function normalizeQuestion(value, createId = defaultIdFactory) {
    const raw = asRecord(value);
    const rawOptions = Array.isArray(raw.options) ? raw.options : [];
    let seenCorrect = false;
    const options = rawOptions.slice(0, MAX_QUESTION_OPTIONS).map((option) => {
      const item = asRecord(option);
      const correct = Boolean(item.correct) && !seenCorrect;
      if (correct) {
        seenCorrect = true;
      }
      return { id: keepOrCreateId(item.id, "option", createId), text: toText(item.text), correct };
    });
    if (options.length === 0) {
      options.push({ id: createId("option"), text: "", correct: true }, { id: createId("option"), text: "", correct: false });
    } else if (!seenCorrect) {
      const first = options[0];
      if (first) {
        first.correct = true;
      }
    }
    return {
      prompt: toText(raw.prompt),
      type: "single-choice",
      options,
      feedbackCorrect: toText(raw.feedbackCorrect),
      feedbackIncorrect: toText(raw.feedbackIncorrect),
      attemptsAllowed: clamp(Math.round(toNumber(raw.attemptsAllowed, 0)), 0, MAX_ATTEMPTS_ALLOWED)
    };
  }
  function normalizeInformationPayload(raw) {
    return { html: toText(raw.html) };
  }
  function normalizeImagePayload(raw) {
    return { src: stripUnsafeUrl(raw.src), alt: toText(raw.alt), caption: toText(raw.caption) };
  }
  function normalizeVideoPayload(raw) {
    return { src: stripUnsafeUrl(raw.src), poster: stripUnsafeUrl(raw.poster) };
  }
  function normalizeLinkPayload(raw) {
    return { url: stripUnsafeUrl(raw.url), newTab: raw.newTab !== false };
  }
  function toActionType(value) {
    return MARKER_ACTION_TYPES.includes(String(value)) ? value : "information";
  }
  function normalizeAction(value, createId = defaultIdFactory) {
    const raw = asRecord(value);
    const type = toActionType(raw.type);
    const payload = asRecord(raw.payload);
    switch (type) {
      case "image":
        return { type, payload: normalizeImagePayload(payload) };
      case "video":
        return { type, payload: normalizeVideoPayload(payload) };
      case "link":
        return { type, payload: normalizeLinkPayload(payload) };
      case "question":
        return { type, payload: normalizeQuestion(payload, createId) };
      case "information":
        return { type, payload: normalizeInformationPayload(payload) };
    }
    const unreachable = type;
    return { type: "information", payload: { html: "" } };
  }
  function toIcon(value) {
    return MARKER_ICONS.includes(String(value)) ? value : "circle";
  }
  function normalizeMarker(value, index, createId = defaultIdFactory) {
    const raw = asRecord(value);
    const order = toNumber(raw.order, Number.NaN);
    return {
      id: keepOrCreateId(raw.id, "marker", createId),
      label: toText(raw.label),
      description: toText(raw.description),
      icon: toIcon(raw.icon),
      order: Number.isFinite(order) ? order : index,
      anchor: normalizeAnchor(raw.anchor),
      camera: normalizeCamera(raw.camera),
      action: normalizeAction(raw.action, createId)
    };
  }
  function normalizeInteraction(value, createId = defaultIdFactory) {
    const raw = asRecord(value);
    const markers = (Array.isArray(raw.markers) ? raw.markers : []).map((marker, index) => normalizeMarker(marker, index, createId));
    markers.sort((a, b) => a.order - b.order);
    markers.forEach((marker, index) => {
      marker.order = index;
    });
    const ids = markers.map((marker) => marker.id);
    const activeMarkerId = toText(raw.activeMarkerId);
    return {
      enabled: Boolean(raw.enabled),
      guidedMode: Boolean(raw.guidedMode),
      wrapNavigation: Boolean(raw.wrapNavigation),
      showMarkerLabels: raw.showMarkerLabels !== false,
      activeMarkerId: ids.includes(activeMarkerId) ? activeMarkerId : "",
      markers
    };
  }
  function normalizeAnimation(value) {
    const raw = asRecord(value);
    return {
      enabled: Boolean(raw.enabled),
      name: toText(raw.name),
      speed: clamp(toNumber(raw.speed, 1), 0.1, 3)
    };
  }
  function normalizeScorm(value) {
    const raw = asRecord(value);
    const mode = clamp(toInteger(raw.mode ?? raw.isScorm, 0), 0, 2);
    return {
      mode,
      weighted: clamp(toNumber(raw.weighted, 100), 1, 100),
      saveButtonText: toText(raw.saveButtonText ?? raw.textButtonScorm)
    };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/runtime/model-viewer-loader.ts
  var SCRIPT_MARKER = "data-threedviewer-lib";
  var DEFINITION_TIMEOUT_MS = 15000;
  function libs() {
    globalThis.$exeLibs = globalThis.$exeLibs ?? {};
    return globalThis.$exeLibs;
  }
  function isModelViewerDefined() {
    return Boolean(globalThis.customElements?.get?.("model-viewer"));
  }
  function injectScript(url, origin) {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = url;
      script.setAttribute(SCRIPT_MARKER, origin);
      script.addEventListener("load", () => resolve());
      script.addEventListener("error", () => {
        console.error("[3D Viewer] Unable to load the model-viewer library from", url);
        resolve();
      });
      document.head.appendChild(script);
    });
  }
  async function ensureModelViewerLoaded(candidates, origin) {
    if (isModelViewerDefined()) {
      return;
    }
    const shared = libs();
    const pending = shared.modelViewerPromise;
    if (pending instanceof Promise) {
      await pending;
      return;
    }
    const existing = typeof document !== "undefined" ? document.querySelector(`script[${SCRIPT_MARKER}]`) : null;
    const loading = (async () => {
      if (!existing) {
        for (const url of candidates.filter(Boolean)) {
          if (isModelViewerDefined()) {
            return;
          }
          await injectScript(url, origin);
          if (isModelViewerDefined()) {
            return;
          }
        }
      }
      const whenDefined = globalThis.customElements?.whenDefined;
      if (whenDefined) {
        try {
          await Promise.race([
            whenDefined.call(globalThis.customElements, "model-viewer"),
            new Promise((resolve) => setTimeout(resolve, DEFINITION_TIMEOUT_MS))
          ]);
        } catch {}
      }
    })();
    shared.modelViewerPromise = loading;
    await loading;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/runtime/three-loader.ts
  function libs2() {
    globalThis.$exeLibs = globalThis.$exeLibs ?? {};
    return globalThis.$exeLibs;
  }
  function isThreeJsReady() {
    const three = globalThis.THREE;
    return Boolean(three?.STLLoader && three?.OrbitControls);
  }
  async function ensureThreeJsLoaded(baseUrl) {
    if (isThreeJsReady()) {
      return;
    }
    const shared = libs2();
    const pending = shared.threeJsPromise;
    if (pending instanceof Promise) {
      await pending;
      return;
    }
    const loading = (async () => {
      const core = await import(`${baseUrl}three.module.min.js`);
      const { STLLoader } = await import(`${baseUrl}STLLoader.js`);
      const { OrbitControls } = await import(`${baseUrl}OrbitControls.js`);
      const three = globalThis.THREE ?? {};
      Object.assign(three, core);
      three.STLLoader = STLLoader;
      three.OrbitControls = OrbitControls;
      globalThis.THREE = three;
    })();
    shared.threeJsPromise = loading;
    await loading;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/export/source-resolver.ts
  function getOdeSessionId() {
    const session = globalThis.eXeLearning?.app?.project?.odeSession;
    return typeof session === "string" && session.trim().length >= 8 ? session.trim() : "";
  }
  function sessionPrefix(sessionId) {
    return `files/tmp/${sessionId.substring(0, 4)}/${sessionId.substring(4, 6)}/${sessionId.substring(6, 8)}/${sessionId}/`;
  }
  function resolveRuntimeSrc(path) {
    const clean = normalizePath(path);
    if (!clean) {
      return "";
    }
    if (isAbsoluteUrl(clean) || clean.startsWith("blob:")) {
      return clean;
    }
    if (clean.startsWith("files/tmp/")) {
      return resolveAppUrl(clean);
    }
    if (clean.startsWith("asset://")) {
      const assetManager = getAssetManager();
      if (assetManager) {
        return assetManager.resolveAssetURLSync?.(clean) || "";
      }
      const assetPath = clean.substring("asset://".length);
      if (!assetPath) {
        return "";
      }
      const onIndex = typeof document !== "undefined" && document.documentElement.id === "exe-index";
      return `${onIndex ? "content/resources/" : "../content/resources/"}${assetPath}`;
    }
    if (clean.startsWith("content/resources/") || clean.startsWith("../content/resources/")) {
      return clean;
    }
    const sessionId = getOdeSessionId();
    return resolveAppUrl(sessionId ? `${sessionPrefix(sessionId)}${clean}` : clean);
  }

  // public/files/perm/idevices/base/three-d-viewer/src/export/scorm.ts
  function getScormRuntime() {
    return globalThis.$exeDevices?.iDevice?.gamification?.scorm ?? null;
  }
  function isScormExport() {
    return Boolean(typeof document !== "undefined" && document.body?.classList?.contains("exe-scorm"));
  }
  function setupScormScoring(wrapper, interaction, scorm, hooks) {
    if (scorm.mode <= 0 || !isScormExport()) {
      return null;
    }
    const runtime = getScormRuntime();
    if (!runtime || questionMarkers(interaction.markers).length === 0) {
      return null;
    }
    const correctMarkerIds = new Set;
    const game = {
      main: wrapper.id,
      idevice: "three-d-viewer",
      isScorm: scorm.mode,
      weighted: scorm.weighted,
      scorerp: 0,
      gameStarted: true,
      msgs: {}
    };
    try {
      runtime.registerActivity?.(game);
    } catch {}
    hooks.onQuestionAnswered = (markerId, correct) => {
      if (correct) {
        correctMarkerIds.add(markerId);
      }
      game.scorerp = computeScore(interaction.markers, correctMarkerIds);
      game.gameOver = isActivityComplete(interaction.markers, correctMarkerIds);
      try {
        runtime.sendScoreNew?.(true, game);
      } catch {}
    };
    return { game, correctMarkerIds };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/export/i18n.ts
  var FALLBACK_TRANSLATIONS = {
    "viewer.empty_state": "Select a 3D model to display",
    "viewer.animation_paused": "Animation paused",
    "viewer.animation_enabled": "Animation enabled",
    "viewer.local_warning_title": "3D Viewer not available",
    "viewer.local_warning_message": "The 3D viewer requires a web server to work. Open this content from a web server or use eXeLearning preview.",
    "viewer.fullscreen": "Fullscreen",
    "viewer.exit_fullscreen": "Exit fullscreen",
    "viewer.rotate_left": "Rotate left",
    "viewer.rotate_right": "Rotate right",
    "viewer.tilt_up": "Tilt up",
    "viewer.tilt_down": "Tilt down"
  };
  function translate(key) {
    try {
      const translator = globalThis._;
      if (typeof translator === "function") {
        const translated = translator(key);
        if (translated && translated !== key) {
          return translated;
        }
      }
    } catch {}
    return FALLBACK_TRANSLATIONS[key] ?? key;
  }
  function translateContent(text) {
    if (typeof globalThis.c_ === "function") {
      return globalThis.c_(text);
    }
    if (typeof globalThis._ === "function") {
      return globalThis._(text);
    }
    return text;
  }
  function buildRuntimeI18n() {
    const keys = [
      "Marker",
      "Close",
      "Check",
      "Correct",
      "Incorrect",
      "Previous",
      "Next",
      "Please select an answer",
      "No attempts left"
    ];
    const map = {};
    for (const key of keys) {
      map[key] = translateContent(key);
    }
    return map;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/export/renderer.ts
  function buildModelMarkup(config) {
    const attributes = [
      ["shadow-intensity", "1"],
      ["tone-mapping", "pbr-neutral"],
      ["reveal", "auto"],
      ["style", `background-color: ${config.backgroundColor || DEFAULT_BACKGROUND_COLOR};`]
    ];
    if (config.alt) {
      attributes.push(["alt", config.alt], ["aria-label", config.alt]);
    }
    if (config.cameraControls) {
      attributes.push(["camera-controls", ""]);
    }
    if (config.autoRotate) {
      attributes.push(["auto-rotate", ""], ["rotation-per-second", `${config.autoRotateSpeed || 30}deg`]);
    }
    const rendered = attributes.map(([name, value]) => value === "" ? name : `${name}="${escapeHtml(value)}"`).join(" ");
    return `<model-viewer ${rendered}></model-viewer>`;
  }
  function buildWrapperAttributes(config, assetRef = "") {
    const parts = [];
    const push = (name, value) => {
      parts.push(`${name}="${escapeHtml(String(value))}"`);
    };
    const src = config.src;
    const type = config.type || (src ? detectModelType(src) : "");
    if (src) {
      push("data-model-src", src);
    }
    if (assetRef) {
      push("data-model-asset-ref", assetRef);
    }
    if (type && type !== "unknown") {
      push("data-model-type", type);
    }
    push("data-model-color", config.modelColor || DEFAULT_MODEL_COLOR);
    push("data-background-color", config.backgroundColor || DEFAULT_BACKGROUND_COLOR);
    push("data-camera-controls", config.cameraControls ? "true" : "false");
    push("data-auto-rotate", config.autoRotate ? "true" : "false");
    push("data-auto-rotate-speed", config.autoRotateSpeed || 30);
    push("data-show-nav-controls", config.showNavControls ? "true" : "false");
    push("data-animation-enabled", config.animation.enabled ? "true" : "false");
    if (config.animation.name) {
      push("data-animation-name", config.animation.name);
    }
    push("data-animation-speed", config.animation.speed);
    if (config.alt) {
      push("data-alt", config.alt);
    }
    return parts.join(" ");
  }
  function buildControlsMarkup(config) {
    if (!config.showNavControls) {
      return "";
    }
    const fullscreenLabel = escapeHtml(translate("viewer.fullscreen"));
    const directions = [
      ["left", "←", translate("viewer.rotate_left")],
      ["up", "↑", translate("viewer.tilt_up")],
      ["down", "↓", translate("viewer.tilt_down")],
      ["right", "→", translate("viewer.rotate_right")]
    ];
    const buttons = directions.map(([key, glyph, label]) => {
      const safeLabel = escapeHtml(label);
      return `<button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-${key}" data-nav="${key}" aria-label="${safeLabel}" title="${safeLabel}">${glyph}</button>`;
    }).join("");
    return `
            <button type="button" class="three-d-viewer-fullscreen-button" data-fullscreen aria-label="${fullscreenLabel}" title="${fullscreenLabel}">⛶</button>
            <div class="three-d-viewer-nav" role="group" aria-label="${escapeHtml(translate("viewer.rotate_left"))}">${buttons}</div>
        `;
  }
  function buildMarkerFallbackItem(marker, index) {
    const label = marker.label || `${translateContent("Marker")} ${index + 1}`;
    const parts = [`<strong>${index + 1}. ${escapeHtml(label)}</strong>`];
    if (marker.description) {
      parts.push(`<p>${escapeHtml(marker.description)}</p>`);
    }
    const action = marker.action;
    switch (action.type) {
      case "information": {
        const text = stripHtmlToText(action.payload.html);
        if (text) {
          parts.push(`<p>${escapeHtml(text)}</p>`);
        }
        break;
      }
      case "image": {
        if (action.payload.alt) {
          parts.push(`<p>${escapeHtml(action.payload.alt)}</p>`);
        }
        if (action.payload.caption) {
          parts.push(`<p>${escapeHtml(action.payload.caption)}</p>`);
        }
        break;
      }
      case "link": {
        const url = safeUrl(action.payload.url);
        if (url) {
          parts.push(`<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
        }
        break;
      }
      case "question": {
        if (action.payload.prompt) {
          parts.push(`<p>${escapeHtml(action.payload.prompt)}</p>`);
        }
        const options = action.payload.options.map((option) => `<li>${escapeHtml(option.text)}</li>`).join("");
        if (options) {
          parts.push(`<ul>${options}</ul>`);
        }
        break;
      }
      case "video":
        break;
    }
    return `<li>${parts.join("")}</li>`;
  }
  function buildInteractionFallback(interaction) {
    const items = interaction.markers.map(buildMarkerFallbackItem).join("");
    return `<ul class="tdv-fallback" hidden>${items}</ul>`;
  }
  function buildInteractionMarkup(interaction, scorm) {
    if (!interaction.enabled) {
      return "";
    }
    const payload = { ...interaction, i18n: buildRuntimeI18n(), scorm };
    const dataBlock = `<script type="application/json" class="tdv-interaction-data">${escapeJsonForScript(payload)}</${"script"}>`;
    let nav = "";
    if (interaction.guidedMode) {
      nav = '<div class="tdv-guided-nav" data-guided hidden>' + `<button type="button" class="tdv-nav-prev">${escapeHtml(translateContent("Previous"))}</button>` + '<span class="tdv-guided-status" aria-live="polite"></span>' + `<button type="button" class="tdv-nav-next">${escapeHtml(translateContent("Next"))}</button>` + "</div>";
    }
    return dataBlock + buildInteractionFallback(interaction) + nav;
  }
  function buildViewerMarkup(options) {
    const { viewerId, config, interaction, scorm } = options;
    return `
                <div class="three-d-viewer-wrapper" data-three-d id="${escapeHtml(viewerId)}" ${buildWrapperAttributes(config, options.assetRef ?? "")}>
                    ${buildModelMarkup(config)}
                    <span class="sr-only" data-live aria-live="polite"></span>
                    <div class="viewer-empty" data-empty>${escapeHtml(translate("viewer.empty_state"))}</div>
                    ${buildControlsMarkup(config)}
                    ${buildInteractionMarkup(interaction, scorm)}
                </div>
            `;
  }
  function computeEmptyStateDisplay(configSrc, viewerSrc) {
    return configSrc.trim() || viewerSrc.trim() ? "none" : "grid";
  }

  // public/files/perm/idevices/base/three-d-viewer/src/export/viewer-controller.ts
  var YAW_STEP = 15 * Math.PI / 180;
  var PITCH_STEP = 10 * Math.PI / 180;
  var MIN_POLAR = 0.05;
  var MAX_POLAR = Math.PI - 0.05;
  function clamp2(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function isLocalFileProtocol() {
    try {
      return globalThis.location?.protocol === "file:";
    } catch {
      return false;
    }
  }
  function buildLocalWarning() {
    const container = document.createElement("div");
    container.className = "three-d-viewer-local-warning";
    const title = document.createElement("strong");
    title.className = "three-d-viewer-local-warning-title";
    title.textContent = translate("viewer.local_warning_title");
    const message = document.createElement("p");
    message.className = "three-d-viewer-local-warning-message";
    message.textContent = translate("viewer.local_warning_message");
    container.append(title, message);
    return container;
  }
  function orbitPosition(position, dAzimuth, dPolar, currentAngles) {
    const radius = Math.hypot(position.x, position.y, position.z) || 1;
    const azimuth = (currentAngles?.azimuth ?? Math.atan2(position.x, position.z)) + dAzimuth;
    const polar = clamp2((currentAngles?.polar ?? Math.acos(clamp2(position.y / radius, -1, 1))) + dPolar, MIN_POLAR, MAX_POLAR);
    const sinPolar = Math.sin(polar);
    return {
      x: radius * sinPolar * Math.sin(azimuth),
      y: radius * Math.cos(polar),
      z: radius * sinPolar * Math.cos(azimuth)
    };
  }
  var ASSET_TIMEOUT_MS = 1e4;

  class ThreeDViewerController {
    wrapper;
    ideviceId;
    config;
    modelViewer;
    emptyState;
    ariaLive;
    observers = [];
    assetTimeoutMs;
    availableAnimations = [];
    constructor(wrapper, config, options = {}) {
      this.wrapper = wrapper;
      this.ideviceId = wrapper.id;
      this.config = config;
      this.assetTimeoutMs = options.assetTimeoutMs ?? ASSET_TIMEOUT_MS;
      this.modelViewer = wrapper.querySelector("model-viewer");
      this.emptyState = wrapper.querySelector("[data-empty]");
      this.ariaLive = wrapper.querySelector("[data-live]");
    }
    async start() {
      if (isLocalFileProtocol()) {
        this.showLocalWarning();
        return;
      }
      if (isStlSource(this.config.src)) {
        await this.renderStl();
      } else {
        await this.applyModelViewerConfig();
        this.observeModelViewer();
      }
      this.setupControls();
    }
    showLocalWarning() {
      if (this.modelViewer) {
        this.modelViewer.style.display = "none";
      }
      if (this.emptyState) {
        this.emptyState.style.display = "none";
      }
      this.wrapper.appendChild(buildLocalWarning());
    }
    async renderStl() {
      let url = resolveRuntimeSrc(this.config.src);
      if (!url && this.config.src.startsWith("asset://")) {
        url = await resolveAssetUrlAsync(this.config.src, this.assetTimeoutMs) ?? "";
      }
      if (!url) {
        console.warn("[3D Viewer] No STL URL resolved for:", this.config.src);
        this.toggleEmptyState();
        return;
      }
      try {
        await ensureThreeJsLoaded(getExportLibBaseUrl());
        const runtime = publishViewerRuntime();
        runtime.destroy(this.wrapper);
        runtime.init(this.wrapper, {
          src: url,
          type: "stl",
          modelColor: this.config.modelColor || DEFAULT_MODEL_COLOR,
          backgroundColor: this.config.backgroundColor || DEFAULT_BACKGROUND_COLOR,
          cameraControls: this.config.cameraControls,
          autoRotate: this.config.autoRotate,
          autoRotateSpeed: this.config.autoRotateSpeed || 30
        });
        this.toggleEmptyState();
      } catch (error) {
        console.error("[3D Viewer] Failed to render STL:", error);
        this.toggleEmptyState();
      }
    }
    async applyModelViewerConfig() {
      const modelViewer = this.modelViewer;
      if (!modelViewer) {
        return;
      }
      let src = resolveRuntimeSrc(this.config.src);
      if (!src && this.config.src.startsWith("asset://")) {
        src = await resolveAssetUrlAsync(this.config.src, this.assetTimeoutMs) ?? "";
      }
      if (src) {
        modelViewer.src = src;
        modelViewer.setAttribute("src", src);
      }
      modelViewer.alt = this.config.alt;
      if (this.config.alt) {
        modelViewer.setAttribute("aria-label", this.config.alt);
      } else {
        modelViewer.removeAttribute("aria-label");
      }
      if (this.config.backgroundColor) {
        modelViewer.style.backgroundColor = this.config.backgroundColor;
      }
      modelViewer.setAttribute("shadow-intensity", "1");
      modelViewer.setAttribute("tone-mapping", "pbr-neutral");
      if (this.config.cameraControls) {
        modelViewer.setAttribute("camera-controls", "");
      } else {
        modelViewer.removeAttribute("camera-controls");
      }
      if (this.config.autoRotate) {
        modelViewer.setAttribute("auto-rotate", "");
        modelViewer.setAttribute("rotation-per-second", `${this.config.autoRotateSpeed || 30}deg`);
      } else {
        modelViewer.removeAttribute("auto-rotate");
        modelViewer.removeAttribute("rotation-per-second");
      }
      this.applyAnimation();
      this.toggleEmptyState();
    }
    observeModelViewer() {
      const modelViewer = this.modelViewer;
      if (!modelViewer) {
        return;
      }
      modelViewer.addEventListener("load", () => {
        this.updateAnimationOptions();
        this.applyAnimation();
        this.toggleEmptyState();
      });
      const observer = new MutationObserver(() => this.toggleEmptyState());
      observer.observe(modelViewer, { attributes: true, attributeFilter: ["src"] });
      this.observers.push(observer);
    }
    setupControls() {
      const fullscreenButton = this.wrapper.querySelector("[data-fullscreen]");
      if (fullscreenButton) {
        const isFullscreen = () => document.fullscreenElement === this.wrapper;
        const syncLabel = () => {
          const label = translate(isFullscreen() ? "viewer.exit_fullscreen" : "viewer.fullscreen");
          fullscreenButton.setAttribute("aria-label", label);
          fullscreenButton.setAttribute("title", label);
        };
        fullscreenButton.addEventListener("click", () => {
          if (isFullscreen()) {
            document.exitFullscreen?.();
          } else {
            this.wrapper.requestFullscreen?.();
          }
        });
        document.addEventListener("fullscreenchange", syncLabel);
      }
      for (const button of Array.from(this.wrapper.querySelectorAll("[data-nav]"))) {
        const direction = button.getAttribute("data-nav");
        const dAzimuth = direction === "right" ? -YAW_STEP : direction === "left" ? YAW_STEP : 0;
        const dPolar = direction === "up" ? PITCH_STEP : direction === "down" ? -PITCH_STEP : 0;
        button.addEventListener("click", () => this.nudgeCamera(dAzimuth, dPolar));
      }
    }
    nudgeCamera(dAzimuth, dPolar) {
      const instance = publishViewerRuntime().getInstance(this.wrapper);
      const camera = instance?.camera;
      if (camera) {
        const controls = instance?.controls;
        const angles = controls?.getAzimuthalAngle && controls?.getPolarAngle ? { azimuth: controls.getAzimuthalAngle(), polar: controls.getPolarAngle() } : undefined;
        const next = orbitPosition(camera.position, dAzimuth, dPolar, angles);
        camera.position.set(next.x, next.y, next.z);
        camera.lookAt(0, 0, 0);
        controls?.update?.();
        return;
      }
      const modelViewer = this.modelViewer;
      const orbit = modelViewer?.getCameraOrbit?.();
      if (!modelViewer || !orbit) {
        return;
      }
      const theta = (orbit.theta ?? 0) + dAzimuth;
      const phi = clamp2((orbit.phi ?? Math.PI / 2) + dPolar, MIN_POLAR, MAX_POLAR);
      modelViewer.cameraOrbit = `${theta}rad ${phi}rad ${orbit.radius ?? "auto"}m`;
      modelViewer.jumpCameraToGoal?.();
    }
    updateAnimationOptions() {
      const available = Array.from(this.modelViewer?.availableAnimations ?? []);
      this.availableAnimations = available;
      if (available.length === 0) {
        this.config.animation.name = "";
        this.config.animation.enabled = false;
        return;
      }
      if (!available.includes(this.config.animation.name)) {
        this.config.animation.name = available[0] ?? "";
      }
    }
    applyAnimation() {
      const modelViewer = this.modelViewer;
      if (!modelViewer) {
        return;
      }
      const animation = this.config.animation;
      if (!animation.enabled) {
        modelViewer.pause?.();
        this.announce(translate("viewer.animation_paused"));
        return;
      }
      const available = this.availableAnimations.length ? this.availableAnimations : Array.from(modelViewer.availableAnimations ?? []);
      const name = animation.name && available.includes(animation.name) ? animation.name : available[0];
      if (!name) {
        modelViewer.pause?.();
        return;
      }
      modelViewer.animationName = name;
      modelViewer.animationSpeed = animation.speed || 1;
      modelViewer.play?.({ repetitions: Number.POSITIVE_INFINITY });
      this.announce(`${translate("viewer.animation_enabled")}: ${name}`);
    }
    toggleEmptyState() {
      if (!this.emptyState) {
        return;
      }
      const viewerSrc = this.modelViewer?.getAttribute("src") ?? this.modelViewer?.src ?? "";
      this.emptyState.style.display = computeEmptyStateDisplay(this.config.src, viewerSrc);
    }
    announce(message) {
      if (this.ariaLive) {
        this.ariaLive.textContent = message;
      }
    }
    destroy() {
      for (const observer of this.observers) {
        observer.disconnect();
      }
      this.observers.length = 0;
      publishViewerRuntime().destroy(this.wrapper);
    }
  }

  // public/files/perm/idevices/base/three-d-viewer/src/export/bootstrap.ts
  var STL_INTERACTION_TIMEOUT_MS = 20000;
  function migrateLegacyConfig(wrapper) {
    const encoded = wrapper.getAttribute("data-config");
    if (!encoded) {
      return;
    }
    let config = {};
    try {
      config = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    } catch {
      try {
        config = JSON.parse(encoded);
      } catch {
        config = {};
      }
    }
    const data = wrapper.dataset;
    const setIfMissing = (key, value) => {
      if (data[key] == null && value != null && value !== "") {
        data[key] = String(value);
      }
    };
    setIfMissing("modelSrc", config.src);
    setIfMissing("alt", config.alt);
    setIfMissing("backgroundColor", config.backgroundColor);
    if (config.cameraControls != null) {
      setIfMissing("cameraControls", Boolean(config.cameraControls));
    }
    if (config.autoRotate != null) {
      setIfMissing("autoRotate", Boolean(config.autoRotate));
    }
    setIfMissing("autoRotateSpeed", config.autoRotateSpeed);
    if (config.showNavControls != null) {
      setIfMissing("showNavControls", Boolean(config.showNavControls));
    }
    const animation = config.animation;
    if (animation) {
      if (animation.enabled != null) {
        setIfMissing("animationEnabled", Boolean(animation.enabled));
      }
      setIfMissing("animationName", animation.name);
      setIfMissing("animationSpeed", animation.speed);
    }
    if (!data.modelType && data.modelSrc) {
      const type = detectModelType(data.modelSrc);
      if (type !== "unknown") {
        data.modelType = type;
      }
    }
    if (!data.modelColor) {
      data.modelColor = DEFAULT_MODEL_COLOR;
    }
    wrapper.removeAttribute("data-config");
  }
  function resolveBootConfig(wrapper) {
    const data = wrapper.dataset;
    const showNavControls = data.showNavControls === "true";
    const rawSrc = (data.modelSrc ?? "").trim();
    const assetRef = (data.modelAssetRef ?? "").trim();
    let src = assetRef && getAssetManager() ? `asset://${assetRef}` : rawSrc;
    if (src.startsWith("data:")) {
      src = "";
    }
    return {
      src,
      type: data.modelType ? data.modelType : detectModelType(src),
      alt: data.alt ?? "",
      modelColor: normalizeColor(data.modelColor, DEFAULT_MODEL_COLOR),
      backgroundColor: normalizeColor(data.backgroundColor, DEFAULT_BACKGROUND_COLOR),
      cameraControls: data.cameraControls !== "false",
      autoRotate: !showNavControls && data.autoRotate !== "false",
      autoRotateSpeed: Number.parseFloat(data.autoRotateSpeed ?? "") || 30,
      showNavControls,
      animation: normalizeAnimation({
        enabled: data.animationEnabled === "true",
        name: data.animationName ?? "",
        speed: Number.parseFloat(data.animationSpeed ?? "") || 1
      })
    };
  }
  function parseInteractionData(wrapper) {
    const script = wrapper.querySelector("script.tdv-interaction-data");
    if (!script) {
      return null;
    }
    try {
      const parsed = JSON.parse(script.textContent || "{}");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  function buildInteractionHooks(wrapper, raw) {
    const i18n = raw.i18n && typeof raw.i18n === "object" ? raw.i18n : {};
    return {
      t: (key) => i18n[key] ?? key,
      resolveMediaUrl: (url) => {
        try {
          return resolveRuntimeSrc(url) || url;
        } catch {
          return url;
        }
      }
    };
  }
  function waitForStlMesh(wrapper, timeoutMs) {
    const runtime = publishViewerRuntime();
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve) => {
      const poll = () => {
        const instance = runtime.getInstance(wrapper);
        if (instance?.mesh || Date.now() >= deadline) {
          resolve(instance);
          return;
        }
        const raf = globalThis.requestAnimationFrame;
        if (typeof raf === "function") {
          raf(poll);
        } else {
          setTimeout(poll, 16);
        }
      };
      poll();
    });
  }
  async function attachInteractionLayer(wrapper, timeoutMs = STL_INTERACTION_TIMEOUT_MS) {
    if (wrapper.dataset.tdvInteractionBooted === "1") {
      return;
    }
    const raw = parseInteractionData(wrapper);
    if (!raw?.enabled) {
      return;
    }
    wrapper.dataset.tdvInteractionBooted = "1";
    const interaction = normalizeInteraction(raw);
    const scorm = normalizeScorm(raw.scorm);
    const hooks = buildInteractionHooks(wrapper, raw);
    setupScormScoring(wrapper, interaction, scorm, hooks);
    const runtime = publishViewerRuntime();
    const type = wrapper.dataset.modelType || detectModelType(wrapper.dataset.modelSrc ?? "");
    if (type === "stl") {
      const instance = await waitForStlMesh(wrapper, timeoutMs);
      if (!instance?.mesh) {
        revealFallback(wrapper, true);
        return;
      }
      instance.interaction = runtime.createInteractionLayer({ wrapper, type: "stl", instance }, interaction, "view", hooks);
      return;
    }
    const modelViewer = wrapper.querySelector("model-viewer");
    runtime.createInteractionLayer({ wrapper, type, modelViewer }, interaction, "view", hooks);
  }
  function findWrappers(ideviceId) {
    const selector = ".three-d-viewer-wrapper[data-three-d]";
    let scope = document;
    if (ideviceId) {
      scope = document.querySelector(`.idevice_node.three-d-viewer[id="${ideviceId}"]`) ?? document.querySelector(`[idevice-id="${ideviceId}"]`) ?? document.getElementById(ideviceId) ?? document;
    }
    const scoped = Array.from(scope.querySelectorAll(selector));
    if (scoped.length > 0 || scope === document) {
      return scoped;
    }
    return Array.from(document.querySelectorAll(selector));
  }
  function stripStlModelViewerSrc(wrapper) {
    const modelViewer = wrapper.querySelector("model-viewer");
    if (!modelViewer) {
      return;
    }
    const data = wrapper.dataset;
    const isStl = data.modelType === "stl" || isStlSource(data.modelSrc ?? "") || isStlSource(modelViewer.getAttribute("src") ?? "");
    if (isStl) {
      modelViewer.removeAttribute("src");
    }
  }
  function bootWrappers(ideviceId) {
    const wrappers = findWrappers(ideviceId);
    if (wrappers.length === 0) {
      return true;
    }
    wrappers.forEach(migrateLegacyConfig);
    wrappers.forEach(stripStlModelViewerSrc);
    const modelViewerCandidates = [getExportModelViewerUrl()];
    const resourcesBase = getIdeviceResourcesBase(ideviceId);
    if (resourcesBase) {
      modelViewerCandidates.push(`${resourcesBase}model-viewer.min.js`);
    }
    ensureModelViewerLoaded(modelViewerCandidates, "export").then(() => {
      for (const wrapper of wrappers) {
        if (wrapper.dataset.threedBooted === "1") {
          continue;
        }
        wrapper.dataset.threedBooted = "1";
        new ThreeDViewerController(wrapper, resolveBootConfig(wrapper)).start();
      }
    });
    const interactive = wrappers.filter((wrapper) => parseInteractionData(wrapper)?.enabled);
    if (interactive.length > 0) {
      const needsThree = interactive.some((wrapper) => wrapper.dataset.modelType === "stl");
      const ready = needsThree ? ensureThreeJsLoaded(getExportLibBaseUrl()) : Promise.resolve();
      ready.then(() => Promise.all(interactive.map(attachInteractionLayer))).catch(() => {
        for (const wrapper of interactive) {
          revealFallback(wrapper, true);
        }
      });
    }
    return true;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/export/runtime.ts
  function appendModulePreloadOnce(href) {
    if (!href || typeof document === "undefined") {
      return;
    }
    if (document.querySelector(`link[rel="modulepreload"][href="${href}"]`)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "modulepreload";
    link.href = href;
    document.head.appendChild(link);
  }
  function buildAssetRef(src) {
    if (src.startsWith("asset://")) {
      return src.substring("asset://".length);
    }
    if (!src.startsWith("blob:")) {
      return "";
    }
    const assetManager = getAssetManager();
    const assetId = assetManager?.reverseBlobCache?.get?.(src);
    if (!assetId) {
      return "";
    }
    const filename = assetManager?.getAssetMetadata?.(assetId)?.filename ?? "";
    const dot = filename.lastIndexOf(".");
    const extension = dot !== -1 ? filename.substring(dot + 1).toLowerCase() : "";
    return extension ? `${assetId}.${extension}` : String(assetId);
  }
  function toDisplayConfig(data) {
    const showNavControls = Boolean(data.showNavControls);
    const src = normalizePath(data.src);
    const speed = Number.parseFloat(String(data.autoRotateSpeed));
    return {
      src,
      type: detectModelType(src),
      alt: typeof data.alt === "string" ? data.alt : "",
      modelColor: normalizeColor(data.modelColor, DEFAULT_MODEL_COLOR),
      backgroundColor: normalizeColor(data.backgroundColor, DEFAULT_BACKGROUND_COLOR),
      cameraControls: data.cameraControls !== false,
      autoRotate: !showNavControls && data.autoRotate !== false,
      autoRotateSpeed: Number.isFinite(speed) ? speed : 30,
      showNavControls,
      animation: normalizeAnimation(data.animation)
    };
  }
  function createExportRuntime() {
    const runtime = {
      currentIdeviceId: "",
      renderView(data, _accessibility, template) {
        const record = data && typeof data === "object" ? data : {};
        const viewerId = typeof record.ideviceId === "string" && record.ideviceId ? record.ideviceId : `three-d-viewer-${Date.now()}`;
        const config = toDisplayConfig(record);
        const interaction = normalizeInteraction(record.interaction);
        const scorm = normalizeScorm(record.scorm ?? record);
        appendModulePreloadOnce(getExportModelViewerUrl());
        runtime.currentIdeviceId = viewerId;
        const content = buildViewerMarkup({
          viewerId,
          config,
          interaction,
          scorm,
          assetRef: buildAssetRef(config.src)
        });
        return typeof template === "string" ? template.replace("{content}", content) : content;
      },
      renderBehaviour(data, _accessibility, ideviceId) {
        const record = data && typeof data === "object" ? data : {};
        const id = (typeof record.ideviceId === "string" ? record.ideviceId : "") || ideviceId || "";
        return bootWrappers(id);
      },
      init() {},
      resolveBootConfig: (_data, wrapper) => resolveBootConfig(wrapper)
    };
    return runtime;
  }

  class ThreeDViewerExportObject {
    node = null;
    resources = null;
    init(node, resources) {
      this.node = node ?? null;
      this.resources = resources ?? null;
      return true;
    }
    toJSON() {
      return this.node?.get3DViewerJSON?.() ?? {};
    }
    fromJSON(data) {
      this.node?.set3DViewerJSON?.(data ?? {});
    }
    getResources() {
      return this.resources;
    }
  }

  // public/files/perm/idevices/base/three-d-viewer/src/export/index.ts
  var runtime = createExportRuntime();
  publishViewerRuntime();
  globalThis.$threedviewer = runtime;
  globalThis.ThreeDViewerExportObject = ThreeDViewerExportObject;
  if (typeof window !== "undefined") {
    window.$threedviewer = runtime;
    window.ThreeDViewerExportObject = ThreeDViewerExportObject;
  }
})();

//# debugId=773D4950041C5E6264756E2164756E21
//# sourceMappingURL=three-d-viewer.js.map

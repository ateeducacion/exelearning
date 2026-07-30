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
  var SUPPORTED_MODEL_EXTENSIONS = ["glb", "gltf", "stl"];
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
  function isSupportedModelFile(path) {
    if (!path) {
      return false;
    }
    let filename = String(path).toLowerCase();
    if (filename.startsWith("asset://")) {
      filename = filename.substring("asset://".length);
    } else if (filename.startsWith("blob:")) {
      return true;
    } else {
      filename = filename.split("/").pop() ?? "";
    }
    filename = stripQueryAndHash(filename);
    if (!filename) {
      return false;
    }
    return SUPPORTED_MODEL_EXTENSIONS.some((ext) => filename.endsWith(`.${ext}`));
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
  function recoverAssetRefFromBlob(blobUrl, assetManager) {
    if (typeof blobUrl !== "string" || !blobUrl.startsWith("blob:")) {
      return "";
    }
    const manager = assetManager ?? getAssetManager();
    const assetId = manager?.reverseBlobCache?.get?.(blobUrl);
    if (!assetId) {
      return "";
    }
    const filename = manager?.getAssetMetadata?.(assetId)?.filename ?? "";
    const dot = filename.lastIndexOf(".");
    const extension = dot !== -1 ? filename.substring(dot + 1).toLowerCase() : "";
    return extension ? `${assetId}.${extension}` : String(assetId);
  }
  async function waitForAssetManager(timeoutMs = 5000, pollIntervalMs = 100) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const manager = getAssetManager();
      if (manager) {
        return manager;
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
  function gradeSingleChoice(question, selectedOptionId) {
    const chosen = question.options.find((option) => option.id === selectedOptionId);
    return Boolean(chosen?.correct);
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

  // public/files/perm/idevices/base/three-d-viewer/src/shared/types.ts
  var SCHEMA_VERSION = 2;
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
  function createDefaultDocument() {
    return {
      schemaVersion: 2,
      src: "",
      alt: "",
      modelColor: DEFAULT_MODEL_COLOR,
      backgroundColor: DEFAULT_BACKGROUND_COLOR,
      cameraControls: true,
      autoRotate: true,
      autoRotateSpeed: 30,
      showNavControls: false,
      animation: { enabled: false, name: "", speed: 1 },
      interaction: {
        enabled: false,
        guidedMode: false,
        wrapNavigation: false,
        showMarkerLabels: true,
        activeMarkerId: "",
        markers: []
      },
      scorm: { mode: 0, weighted: 100, saveButtonText: "" }
    };
  }
  function normalizeDocument(value, createId = defaultIdFactory) {
    const raw = asRecord(value);
    const defaults = createDefaultDocument();
    const showNavControls = typeof raw.showNavControls === "boolean" ? raw.showNavControls : defaults.showNavControls;
    const autoRotate = typeof raw.autoRotate === "boolean" ? raw.autoRotate : defaults.autoRotate;
    return {
      schemaVersion: 2,
      src: normalizeModelSource(raw.src),
      alt: toText(raw.alt),
      modelColor: normalizeColor(raw.modelColor, DEFAULT_MODEL_COLOR),
      backgroundColor: normalizeColor(raw.backgroundColor, DEFAULT_BACKGROUND_COLOR),
      cameraControls: typeof raw.cameraControls === "boolean" ? raw.cameraControls : defaults.cameraControls,
      autoRotate: showNavControls ? false : autoRotate,
      autoRotateSpeed: clamp(toNumber(raw.autoRotateSpeed, 30), 1, 90),
      showNavControls,
      animation: normalizeAnimation(raw.animation),
      interaction: normalizeInteraction(raw.interaction, createId),
      scorm: normalizeScorm(raw.scorm ?? raw)
    };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/shared/migration.ts
  function readSchemaVersion(raw) {
    const value = raw.schemaVersion;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return 0;
  }
  function hydrateDocument(value, createId = defaultIdFactory) {
    if (value === null || value === undefined || value === "") {
      return { status: "ok", document: createDefaultDocument() };
    }
    if (typeof value !== "object" || Array.isArray(value)) {
      return { status: "invalid", reason: "expected an object", original: value };
    }
    const raw = value;
    const version = readSchemaVersion(raw);
    if (version > SCHEMA_VERSION) {
      return { status: "unsupported-version", version, original: value };
    }
    return { status: "ok", document: normalizeDocument(raw, createId) };
  }
  function serializeDocument(document2, createId = defaultIdFactory) {
    return normalizeDocument(document2, createId);
  }

  // public/files/perm/idevices/base/three-d-viewer/src/edition/editor.ts
  function renderEditorMarkup(t) {
    const e = (text) => escapeHtml(t(text));
    return `
                <div class="three-d-viewer-editor" id="threeDViewerEditor">
                    <div class="container">
                        <!-- Preview area -->
                        <div class="ratio ratio-16x9 mb-4 viewer-preview-container">
                            <div class="viewer-preview" id="threeDViewerPreview">
                                <div class="viewer-empty" data-empty-state>
                                    <div class="viewer-empty-content">
                                        <svg class="viewer-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                                        </svg>
                                        <span>${e("Select a 3D model to preview")}</span>
                                    </div>
                                </div>
                                <button type="button" class="three-d-viewer-fullscreen-button" data-fullscreen aria-label="${e("Fullscreen")}" title="${e("Fullscreen")}">⛶</button>
                                <div class="three-d-viewer-nav" role="group" aria-label="${e("Rotate model")}">
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-left" data-nav="left" aria-label="${e("Rotate left")}" title="${e("Rotate left")}">←</button>
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-up" data-nav="up" aria-label="${e("Tilt up")}" title="${e("Tilt up")}">↑</button>
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-down" data-nav="down" aria-label="${e("Tilt down")}" title="${e("Tilt down")}">↓</button>
                                    <button type="button" class="three-d-viewer-nav-btn three-d-viewer-nav-right" data-nav="right" aria-label="${e("Rotate right")}" title="${e("Rotate right")}">→</button>
                                </div>
                            </div>
                        </div>

                        <!-- Model file selector -->
                        <div class="d-flex align-items-center mb-3">
                            <label for="threeD3DModelFile" class="form-label me-2 mb-0 text-nowrap">${e("3D Model")}:</label>
                            <input type="text" class="exe-file-picker form-control" id="threeD3DModelFile" readonly placeholder="${e("Select a GLB, GLTF or STL file")}" />
                        </div>
                        <p class="form-text text-muted mb-4">${e("Supported formats")}: GLB, GLTF, STL</p>

                        <!-- Alt text -->
                        <div class="mb-4">
                            <label for="threeDAlt" class="form-label">${e("Alternative text")}:</label>
                            <input type="text" class="form-control" id="threeDAlt" maxlength="180" placeholder="${e("Describe the 3D model for accessibility")}" />
                            <p class="form-text text-muted">${e("Describe the 3D model for screen readers and accessibility")}</p>
                        </div>

                        <!-- Display options -->
                        <fieldset class="mb-4">
                            <legend class="h6 mb-3">${e("Display Options")}</legend>

                            <div class="row align-items-center mb-3">
                                <label for="threeDBackground" class="col-auto col-form-label">${e("Background color")}:</label>
                                <div class="col-auto">
                                    <input type="color" class="form-control form-control-color" id="threeDBackground" title="${e("Choose background color")}" />
                                </div>
                            </div>

                            <div class="row align-items-center mb-3">
                                <label for="threeDModelColor" class="col-auto col-form-label">${e("STL model color")}:</label>
                                <div class="col-auto">
                                    <input type="color" class="form-control form-control-color" id="threeDModelColor" title="${e("Choose STL model color")}" value="#888888" />
                                </div>
                                <div class="col form-text text-muted mb-0" id="threeDModelColorHint">${e("Only used for STL files; ignored for GLB/GLTF (materials come from the model).")}</div>
                            </div>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDCameraControls" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDCameraControls" class="toggle-label">${e("Enable camera controls")}</label>
                                </div>
                            </div>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDAutoRotate" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDAutoRotate" class="toggle-label">${e("Auto-rotate model")}</label>
                                </div>
                                <div class="d-flex align-items-center gap-2" id="threeDAutoRotateSpeedRow">
                                    <label for="threeDAutoRotateSpeed" class="form-label mb-0 text-nowrap">${e("Speed")}:</label>
                                    <div class="input-group" style="width: 7em;">
                                        <input type="number" class="form-control" id="threeDAutoRotateSpeed" min="1" max="90" step="1" value="30" />
                                        <span class="input-group-text">°/s</span>
                                    </div>
                                </div>
                            </div>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-1">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDShowNavControls" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDShowNavControls" class="toggle-label">${e("Show navigation controls (fullscreen + arrows)")}</label>
                                </div>
                            </div>
                            <p class="form-text text-muted">${e("Mutually exclusive with auto-rotate.")}</p>
                        </fieldset>

                        <!-- Animation options (shown when the model has animations) -->
                        <fieldset class="mb-3" data-animation-row hidden>
                            <legend class="h6 mb-3">${e("Animation")}</legend>

                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDAnimationToggle" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDAnimationToggle" class="toggle-label">${e("Play animation")}</label>
                                </div>
                            </div>

                            <div class="row g-3">
                                <div class="col-sm-6">
                                    <label for="threeDAnimationName" class="form-label">${e("Animation")}:</label>
                                    <select class="form-select" id="threeDAnimationName"></select>
                                </div>
                                <div class="col-sm-6">
                                    <label for="threeDAnimationSpeed" class="form-label">${e("Speed")}:</label>
                                    <div class="input-group">
                                        <input type="number" class="form-control" id="threeDAnimationSpeed" min="0.1" max="3" step="0.1" value="1" />
                                        <span class="input-group-text">x</span>
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        <!-- Interactions (markers / guided navigation / questions) -->
                        <fieldset class="mb-3 tdv-interactions" data-interactions>
                            <legend class="h6 mb-3">${e("Interactions")}</legend>
                            <div class="toggle-item mb-2">
                                <span class="toggle-control">
                                    <input type="checkbox" id="threeDInteractionsEnable" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label for="threeDInteractionsEnable" class="toggle-label">${e("Enable interactions")}</label>
                            </div>
                            <div id="threeDInteractionsBody" hidden>
                                <div class="toggle-item mb-2">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDGuidedMode" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDGuidedMode" class="toggle-label">${e("Guided navigation (previous / next)")}</label>
                                </div>
                                <div class="toggle-item mb-2">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDWrapNavigation" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDWrapNavigation" class="toggle-label">${e("Wrap around at the ends")}</label>
                                </div>
                                <div class="toggle-item mb-3">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="threeDShowMarkerLabels" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label for="threeDShowMarkerLabels" class="toggle-label">${e("Show marker labels")}</label>
                                </div>
                                <button type="button" class="btn btn-secondary btn-sm mb-2" id="threeDAddMarker">${e("Add marker")}</button>
                                <p class="form-text text-muted" id="threeDPlacementHint" hidden>${e("Click on the model to place the marker.")}</p>
                                <ul class="tdv-marker-list list-unstyled mb-0" id="threeDMarkerList"></ul>
                                <div class="tdv-scorm mt-3" id="threeDScormSection" hidden>
                                    <h4 class="h6">${e("Assessment (SCORM)")}</h4>
                                    <div id="threeDScormTab"></div>
                                </div>
                            </div>
                        </fieldset>
                        <div class="tdv-marker-editor-host" id="threeDMarkerEditorHost"></div>
                    </div>
                    <div class="sr-only" id="threeDAnimationLive" aria-live="polite"></div>
                </div>
            `;
  }
  function renderUnsupportedVersionMarkup(t, version) {
    return `
                <div class="three-d-viewer-editor three-d-viewer-editor--unsupported" id="threeDViewerEditor">
                    <div class="container">
                        <div class="alert alert-warning" role="alert" data-unsupported-version="${escapeHtml(String(version))}">
                            <p class="mb-0">${escapeHtml(t("This 3D Viewer was created with a newer version of eXeLearning and cannot be edited here."))}</p>
                            <p class="mb-0">${escapeHtml(t("Update eXeLearning to edit it. Its content is preserved."))}</p>
                        </div>
                    </div>
                </div>
            `;
  }
  function require2(root, selector) {
    const element = root.querySelector(selector);
    if (!element) {
      throw new Error(`[3D Viewer] Editor element not found: ${selector}`);
    }
    return element;
  }
  function collectElements(root) {
    return {
      root,
      preview: require2(root, "#threeDViewerPreview"),
      ariaLive: require2(root, "#threeDAnimationLive"),
      animationRow: require2(root, "[data-animation-row]"),
      autoRotateSpeedRow: require2(root, "#threeDAutoRotateSpeedRow"),
      modelColorHint: require2(root, "#threeDModelColorHint"),
      src: require2(root, "#threeD3DModelFile"),
      alt: require2(root, "#threeDAlt"),
      modelColor: require2(root, "#threeDModelColor"),
      backgroundColor: require2(root, "#threeDBackground"),
      cameraControls: require2(root, "#threeDCameraControls"),
      autoRotate: require2(root, "#threeDAutoRotate"),
      autoRotateSpeed: require2(root, "#threeDAutoRotateSpeed"),
      showNavControls: require2(root, "#threeDShowNavControls"),
      animationToggle: require2(root, "#threeDAnimationToggle"),
      animationName: require2(root, "#threeDAnimationName"),
      animationSpeed: require2(root, "#threeDAnimationSpeed"),
      interactionsEnable: require2(root, "#threeDInteractionsEnable"),
      interactionsBody: require2(root, "#threeDInteractionsBody"),
      guidedMode: require2(root, "#threeDGuidedMode"),
      wrapNavigation: require2(root, "#threeDWrapNavigation"),
      showMarkerLabels: require2(root, "#threeDShowMarkerLabels"),
      addMarker: require2(root, "#threeDAddMarker"),
      placementHint: require2(root, "#threeDPlacementHint"),
      markerList: require2(root, "#threeDMarkerList"),
      markerEditorHost: require2(root, "#threeDMarkerEditorHost"),
      scormSection: require2(root, "#threeDScormSection"),
      scormHost: require2(root, "#threeDScormTab")
    };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/edition/form.ts
  function applyDocumentToForm(elements, document2) {
    elements.src.value = document2.src;
    elements.alt.value = document2.alt;
    elements.modelColor.value = document2.modelColor || DEFAULT_MODEL_COLOR;
    elements.backgroundColor.value = document2.backgroundColor || DEFAULT_BACKGROUND_COLOR;
    elements.cameraControls.checked = document2.cameraControls;
    elements.autoRotate.checked = document2.autoRotate;
    elements.autoRotateSpeed.value = String(document2.autoRotateSpeed || 30);
    elements.showNavControls.checked = document2.showNavControls;
    elements.animationToggle.checked = document2.animation.enabled;
    elements.animationSpeed.value = String(document2.animation.speed || 1);
    elements.animationName.value = document2.animation.name;
    elements.interactionsEnable.checked = document2.interaction.enabled;
    elements.guidedMode.checked = document2.interaction.guidedMode;
    elements.wrapNavigation.checked = document2.interaction.wrapNavigation;
    elements.showMarkerLabels.checked = document2.interaction.showMarkerLabels;
  }
  function readDisplaySettings(elements, currentSrc) {
    const showNavControls = elements.showNavControls.checked;
    const speed = Number.parseFloat(elements.animationSpeed.value);
    return {
      src: elements.src.value.trim() || currentSrc,
      alt: elements.alt.value.trim(),
      modelColor: normalizeColor(elements.modelColor.value, DEFAULT_MODEL_COLOR),
      backgroundColor: normalizeColor(elements.backgroundColor.value, DEFAULT_BACKGROUND_COLOR),
      cameraControls: elements.cameraControls.checked,
      autoRotate: !showNavControls && elements.autoRotate.checked,
      autoRotateSpeed: Number.parseFloat(elements.autoRotateSpeed.value) || 30,
      showNavControls,
      animation: {
        enabled: elements.animationToggle.checked,
        name: elements.animationName.value,
        speed: Number.isFinite(speed) ? Math.min(Math.max(speed, 0.1), 3) : 1
      }
    };
  }
  function updateAutoRotateSpeedState(elements) {
    const enabled = elements.autoRotate.checked;
    elements.autoRotateSpeed.disabled = !enabled;
    elements.autoRotateSpeedRow.style.display = enabled ? "" : "none";
  }
  function updateModelColorFieldState(elements, src, t) {
    const isStl = isStlSource(src);
    elements.modelColor.disabled = !isStl;
    elements.modelColor.title = isStl ? t("Choose STL model color") : t("Only STL files use this color; the current file is not STL");
    elements.modelColorHint.classList.toggle("text-muted", !isStl);
  }
  function updateNavControlsVisibility(elements, visible) {
    const fullscreen = elements.preview.querySelector("[data-fullscreen]");
    const nav = elements.preview.querySelector(".three-d-viewer-nav");
    if (fullscreen) {
      fullscreen.style.display = visible ? "" : "none";
    }
    if (nav) {
      nav.style.display = visible ? "" : "none";
    }
  }
  function updateEmptyState(elements, src) {
    const empty = elements.preview.querySelector("[data-empty-state]");
    if (empty) {
      empty.style.display = src ? "none" : "grid";
    }
  }
  function updateAnimationOptions(elements, available, animation) {
    elements.animationName.innerHTML = "";
    for (const name of available) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      elements.animationName.appendChild(option);
    }
    if (available.length === 0) {
      elements.animationToggle.checked = false;
      elements.animationToggle.disabled = true;
      elements.animationName.disabled = true;
      elements.animationSpeed.disabled = true;
      elements.animationRow.hidden = true;
      return { ...animation, enabled: false, name: "" };
    }
    const selected = available.includes(animation.name) ? animation.name : available[0] ?? "";
    elements.animationName.value = selected;
    elements.animationRow.hidden = false;
    elements.animationToggle.disabled = false;
    elements.animationName.disabled = false;
    elements.animationSpeed.disabled = false;
    return { ...animation, name: selected };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/edition/marker-editor.ts
  var MAX_AUTHORED_OPTIONS = 8;
  function validateMarker(marker, t) {
    if (marker.action.type !== "question") {
      return { valid: true };
    }
    const question = marker.action.payload;
    if (!question.prompt.trim()) {
      return { valid: false, message: t("Enter the question prompt.") };
    }
    const answered = question.options.filter((option) => option.text.trim().length > 0);
    if (answered.length < 2) {
      return { valid: false, message: t("Enter at least two answer options.") };
    }
    if (question.options.filter((option) => option.correct).length !== 1) {
      return { valid: false, message: t("Mark exactly one option as correct.") };
    }
    return { valid: true };
  }
  function labelledInput(container, id, labelText, element) {
    const wrapper = document.createElement("div");
    wrapper.className = "mb-2";
    const label = document.createElement("label");
    label.className = "form-label";
    label.setAttribute("for", id);
    label.textContent = labelText;
    element.id = id;
    wrapper.append(label, element);
    container.appendChild(wrapper);
  }
  function textInput(value) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control";
    input.value = value;
    return input;
  }
  function textArea(value, rows = 3) {
    const area = document.createElement("textarea");
    area.className = "form-control";
    area.rows = rows;
    area.value = value;
    return area;
  }
  function renderQuestionFields(container, question, t, createId) {
    const prompt = textArea(question.prompt, 2);
    prompt.classList.add("mb-2");
    prompt.setAttribute("aria-label", t("Question prompt"));
    prompt.placeholder = t("Question prompt");
    prompt.addEventListener("input", () => {
      question.prompt = prompt.value;
    });
    container.appendChild(prompt);
    const optionsHost = document.createElement("div");
    optionsHost.className = "tdv-q-options";
    container.appendChild(optionsHost);
    const renderOptions = () => {
      optionsHost.innerHTML = "";
      question.options.forEach((option, index) => {
        const row = document.createElement("div");
        row.className = "input-group input-group-sm mb-1";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "tdvMkCorrect";
        radio.className = "form-check-input mt-2 me-2";
        radio.checked = option.correct;
        radio.setAttribute("aria-label", `${t("Correct answer")} ${index + 1}`);
        radio.addEventListener("change", () => {
          for (const other of question.options) {
            other.correct = other === option;
          }
        });
        const text = textInput(option.text);
        text.placeholder = `${t("Option")} ${index + 1}`;
        text.addEventListener("input", () => {
          option.text = text.value;
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-outline-secondary";
        remove.textContent = "✕";
        remove.setAttribute("aria-label", `${t("Remove option")} ${index + 1}`);
        remove.disabled = question.options.length <= 2;
        remove.addEventListener("click", () => {
          question.options = question.options.filter((other) => other !== option);
          if (!question.options.some((other) => other.correct) && question.options[0]) {
            question.options[0].correct = true;
          }
          renderOptions();
        });
        row.append(radio, text, remove);
        optionsHost.appendChild(row);
      });
    };
    renderOptions();
    const addOption = document.createElement("button");
    addOption.type = "button";
    addOption.className = "btn btn-outline-secondary btn-sm mb-2";
    addOption.textContent = t("Add option");
    addOption.addEventListener("click", () => {
      if (question.options.length >= MAX_AUTHORED_OPTIONS) {
        return;
      }
      question.options.push({ id: createId("option"), text: "", correct: false });
      renderOptions();
    });
    container.appendChild(addOption);
    const feedbackCorrect = textInput(question.feedbackCorrect);
    feedbackCorrect.classList.add("mb-2");
    feedbackCorrect.placeholder = t("Feedback when correct");
    feedbackCorrect.addEventListener("input", () => {
      question.feedbackCorrect = feedbackCorrect.value;
    });
    container.appendChild(feedbackCorrect);
    const feedbackIncorrect = textInput(question.feedbackIncorrect);
    feedbackIncorrect.classList.add("mb-2");
    feedbackIncorrect.placeholder = t("Feedback when incorrect");
    feedbackIncorrect.addEventListener("input", () => {
      question.feedbackIncorrect = feedbackIncorrect.value;
    });
    container.appendChild(feedbackIncorrect);
    const attemptsWrapper = document.createElement("div");
    attemptsWrapper.className = "mb-1";
    const attempts = document.createElement("input");
    attempts.type = "number";
    attempts.className = "form-control";
    attempts.min = "0";
    attempts.max = "20";
    attempts.value = String(question.attemptsAllowed);
    attempts.addEventListener("input", () => {
      question.attemptsAllowed = Number.parseInt(attempts.value, 10) || 0;
    });
    labelledInput(attemptsWrapper, "tdvMkAttempts", t("Attempts allowed (0 = unlimited)"), attempts);
    container.appendChild(attemptsWrapper);
  }
  function renderActionFields(container, draft, t, createId) {
    container.innerHTML = "";
    const action = draft.action;
    switch (action.type) {
      case "information": {
        const html = textArea(action.payload.html);
        html.addEventListener("input", () => {
          action.payload.html = html.value;
        });
        labelledInput(container, "tdvMkHtml", t("Content (HTML allowed)"), html);
        return;
      }
      case "image": {
        const src = textInput(action.payload.src);
        src.addEventListener("input", () => {
          action.payload.src = src.value;
        });
        labelledInput(container, "tdvMkImgSrc", t("Image URL"), src);
        const alt = textInput(action.payload.alt);
        alt.addEventListener("input", () => {
          action.payload.alt = alt.value;
        });
        labelledInput(container, "tdvMkImgAlt", t("Alternative text"), alt);
        const caption = textInput(action.payload.caption);
        caption.addEventListener("input", () => {
          action.payload.caption = caption.value;
        });
        labelledInput(container, "tdvMkImgCap", t("Caption"), caption);
        return;
      }
      case "video": {
        const src = textInput(action.payload.src);
        src.addEventListener("input", () => {
          action.payload.src = src.value;
        });
        labelledInput(container, "tdvMkVidSrc", t("Video URL"), src);
        const poster = textInput(action.payload.poster);
        poster.addEventListener("input", () => {
          action.payload.poster = poster.value;
        });
        labelledInput(container, "tdvMkVidPoster", t("Poster URL"), poster);
        return;
      }
      case "link": {
        const url = textInput(action.payload.url);
        url.addEventListener("input", () => {
          action.payload.url = url.value;
        });
        labelledInput(container, "tdvMkLinkUrl", t("Link URL"), url);
        const check = document.createElement("div");
        check.className = "form-check";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.className = "form-check-input";
        box.id = "tdvMkNewTab";
        box.checked = action.payload.newTab;
        box.addEventListener("change", () => {
          action.payload.newTab = box.checked;
        });
        const label = document.createElement("label");
        label.className = "form-check-label";
        label.setAttribute("for", "tdvMkNewTab");
        label.textContent = t("Open in a new tab");
        check.append(box, label);
        container.appendChild(check);
        return;
      }
      case "question":
        renderQuestionFields(container, action.payload, t, createId);
        return;
    }
  }
  function buildPanelMarkup(t) {
    return `
                <div class="tdv-marker-editor" role="dialog" aria-modal="false" aria-label="${t("Edit marker")}">
                    <div class="tdv-marker-editor-head d-flex justify-content-between align-items-center mb-2">
                        <h3 class="h6 mb-0">${t("Edit marker")}</h3>
                        <button type="button" class="btn-close" data-close aria-label="${t("Close")}"></button>
                    </div>
                    <div class="mb-2">
                        <label class="form-label" for="tdvMkLabel">${t("Label")}</label>
                        <input type="text" class="form-control" id="tdvMkLabel" maxlength="120" />
                    </div>
                    <div class="row g-2 mb-2">
                        <div class="col">
                            <label class="form-label" for="tdvMkIcon">${t("Icon")}</label>
                            <select class="form-select" id="tdvMkIcon"></select>
                        </div>
                        <div class="col">
                            <label class="form-label" for="tdvMkType">${t("Action type")}</label>
                            <select class="form-select" id="tdvMkType"></select>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label" for="tdvMkDesc">${t("Short description")}</label>
                        <input type="text" class="form-control" id="tdvMkDesc" maxlength="200" />
                    </div>
                    <div class="tdv-action-fields mb-2" id="tdvActionFields"></div>
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <button type="button" class="btn btn-outline-secondary btn-sm" data-capture-camera>${t("Capture current camera")}</button>
                        <span class="form-text text-muted mb-0" data-camera-note></span>
                    </div>
                    <p class="tdv-marker-editor-error text-danger mb-2" data-error role="alert" hidden></p>
                    <div class="d-flex justify-content-between mt-2">
                        <button type="button" class="btn btn-outline-danger btn-sm" data-delete>${t("Delete marker")}</button>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-outline-secondary btn-sm" data-cancel>${t("Cancel")}</button>
                            <button type="button" class="btn btn-primary btn-sm" data-save>${t("Save marker")}</button>
                        </div>
                    </div>
                </div>`;
  }
  function openMarkerEditor(host, marker, t, createId, callbacks) {
    const draft = normalizeMarker(JSON.parse(JSON.stringify(marker)), marker.order, createId);
    host.innerHTML = buildPanelMarkup(t);
    const panel = host.querySelector(".tdv-marker-editor");
    if (!panel) {
      throw new Error("[3D Viewer] Marker editor panel failed to render");
    }
    const query = (selector) => {
      const element = panel.querySelector(selector);
      if (!element) {
        throw new Error(`[3D Viewer] Marker editor element not found: ${selector}`);
      }
      return element;
    };
    const iconSelect = query("#tdvMkIcon");
    for (const icon of MARKER_ICONS) {
      const option = document.createElement("option");
      option.value = icon;
      option.textContent = icon;
      iconSelect.appendChild(option);
    }
    const typeLabels = {
      information: t("Information"),
      image: t("Image"),
      video: t("Video"),
      link: t("Link"),
      question: t("Question")
    };
    const typeSelect = query("#tdvMkType");
    for (const type of MARKER_ACTION_TYPES) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = typeLabels[type];
      typeSelect.appendChild(option);
    }
    const labelInput = query("#tdvMkLabel");
    const descriptionInput = query("#tdvMkDesc");
    labelInput.value = draft.label;
    descriptionInput.value = draft.description;
    iconSelect.value = draft.icon;
    typeSelect.value = draft.action.type;
    const cameraNote = query("[data-camera-note]");
    if (draft.camera.orbit || draft.camera.target) {
      cameraNote.textContent = t("Camera captured");
    }
    const errorNote = query("[data-error]");
    const actionFields = query("#tdvActionFields");
    const renderFields = () => renderActionFields(actionFields, draft, t, createId);
    renderFields();
    typeSelect.addEventListener("change", () => {
      draft.action = normalizeAction({ type: typeSelect.value, payload: {} }, createId);
      if (typeSelect.value === "question") {
        iconSelect.value = "question";
      }
      renderFields();
    });
    query("[data-capture-camera]").addEventListener("click", () => {
      const camera = callbacks.captureCamera();
      if (camera) {
        draft.camera = camera;
        cameraNote.textContent = t("Camera captured");
      }
    });
    let closed = false;
    const close = () => {
      if (closed) {
        return;
      }
      closed = true;
      host.innerHTML = "";
    };
    const cancel = () => {
      close();
      callbacks.onCancel();
    };
    query("[data-close]").addEventListener("click", cancel);
    query("[data-cancel]").addEventListener("click", cancel);
    query("[data-delete]").addEventListener("click", () => {
      close();
      callbacks.onDelete(marker.id);
    });
    query("[data-save]").addEventListener("click", () => {
      draft.label = labelInput.value;
      draft.description = descriptionInput.value;
      draft.icon = iconSelect.value || "circle";
      const normalized = normalizeMarker(draft, draft.order, createId);
      const validation = validateMarker(normalized, t);
      if (!validation.valid) {
        errorNote.hidden = false;
        errorNote.textContent = validation.message;
        return;
      }
      errorNote.hidden = true;
      errorNote.textContent = "";
      close();
      callbacks.onSave(normalized);
    });
    try {
      labelInput.focus();
    } catch {}
    return { markerId: marker.id, draft, close };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/edition/marker-list.ts
  function actionTypeLabel(type, t) {
    const labels = {
      information: t("Information"),
      image: t("Image"),
      video: t("Video"),
      link: t("Link"),
      question: t("Question")
    };
    return labels[type];
  }
  function createRowButton(options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn btn-sm btn-outline-secondary ${options.className}`;
    button.textContent = options.glyph;
    button.title = options.title;
    button.setAttribute("aria-label", `${options.title}: ${options.markerName}`);
    button.disabled = options.disabled;
    button.addEventListener("click", options.onClick);
    return button;
  }
  function renderMarkerList(host, markers, t, callbacks) {
    host.innerHTML = "";
    markers.forEach((marker, index) => {
      const name = marker.label || `${t("Marker")} ${index + 1}`;
      const row = document.createElement("li");
      row.className = "tdv-marker-row d-flex align-items-center gap-1 mb-1";
      row.dataset.markerId = marker.id;
      const label = document.createElement("span");
      label.className = "tdv-marker-row-label flex-grow-1";
      label.textContent = `${index + 1}. ${name} — ${actionTypeLabel(marker.action.type, t)}`;
      row.appendChild(label);
      row.append(createRowButton({
        className: "tdv-move-up",
        glyph: "↑",
        title: t("Move up"),
        markerName: name,
        disabled: index === 0,
        onClick: () => callbacks.onMove(marker.id, -1)
      }), createRowButton({
        className: "tdv-move-down",
        glyph: "↓",
        title: t("Move down"),
        markerName: name,
        disabled: index === markers.length - 1,
        onClick: () => callbacks.onMove(marker.id, 1)
      }), createRowButton({
        className: "tdv-edit-marker",
        glyph: "✎",
        title: t("Edit"),
        markerName: name,
        disabled: false,
        onClick: () => callbacks.onEdit(marker.id)
      }), createRowButton({
        className: "tdv-delete-marker",
        glyph: "✕",
        title: t("Delete"),
        markerName: name,
        disabled: false,
        onClick: () => callbacks.onDelete(marker.id)
      }));
      host.appendChild(row);
    });
  }
  function moveMarker(markers, markerId, delta) {
    const from = markers.findIndex((marker) => marker.id === markerId);
    const to = from + delta;
    const next = [...markers];
    const moved = next[from];
    const displaced = next[to];
    if (from < 0 || !moved || !displaced) {
      return next;
    }
    next[from] = displaced;
    next[to] = moved;
    return next.map((marker, index) => ({ ...marker, order: index }));
  }
  function removeMarker(markers, markerId) {
    return markers.filter((marker) => marker.id !== markerId).map((marker, index) => ({ ...marker, order: index }));
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

  // public/files/perm/idevices/base/three-d-viewer/src/runtime/paths.ts
  var LIB_RELATIVE_PATH = "files/perm/idevices/base/three-d-viewer/export/";
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
  function isStaticMode() {
    const config = parseRuntimeConfig();
    return Boolean(config?.isStaticMode || config?.isOfflineInstallation);
  }
  function resolveAppUrl(path) {
    const symfony = globalThis.eXeLearning?.symfony ?? {};
    return joinAppUrl(symfony.baseURL, symfony.basePath, path);
  }
  function withOrigin(url) {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    const origin = globalThis.location?.origin ?? "";
    return origin + (url.startsWith("/") ? "" : "/") + url;
  }
  function getEditionLibBaseUrl() {
    if (isStaticMode()) {
      return `${globalThis.location?.origin ?? ""}/${LIB_RELATIVE_PATH}`;
    }
    const symfony = globalThis.eXeLearning?.symfony ?? {};
    const baseURL = String(symfony.baseURL ?? "").replace(/\/+$/g, "");
    const basePath = symfony.basePath ? `/${String(symfony.basePath).replace(/^\/+|\/+$/g, "")}` : "";
    return withOrigin(`${baseURL}${basePath}/${LIB_RELATIVE_PATH}`);
  }
  function getEditionModelViewerUrl() {
    const path = `${LIB_RELATIVE_PATH}model-viewer.min.js`;
    return isStaticMode() ? `./${path}` : resolveAppUrl(path);
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

  // public/files/perm/idevices/base/three-d-viewer/src/edition/preview.ts
  var STL_READY_TIMEOUT_MS = 20000;
  var MIN_POLAR = 0.05;
  var MAX_POLAR = Math.PI - 0.05;
  function clamp2(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function createEditorPreview(container, callbacks) {
    const runtime = publishViewerRuntime();
    let modelViewer = null;
    let interactions = null;
    let previewBlobUrl = "";
    let lastPreviewKey = "";
    const destroyInteractions = () => {
      if (interactions) {
        try {
          interactions.destroy();
        } catch {}
        interactions = null;
      }
    };
    const resolveMediaUrl = (url) => {
      if (previewBlobUrl && url === "") {
        return previewBlobUrl;
      }
      if (url.startsWith("asset://")) {
        return getAssetManager()?.resolveAssetURLSync?.(url) || url;
      }
      return url;
    };
    const resolvePreviewUrl = async (src) => {
      if (!src) {
        return "";
      }
      if (src.startsWith("blob:")) {
        return src;
      }
      if (!src.startsWith("asset://")) {
        return src;
      }
      const cached = getAssetManager()?.resolveAssetURLSync?.(src);
      if (cached) {
        previewBlobUrl = cached;
        return cached;
      }
      const manager = await waitForAssetManager(5000);
      if (!manager) {
        console.warn("[3D Viewer] AssetManager not available; cannot preview", src);
        return "";
      }
      const resolved = await resolveModelSource(src, manager);
      if (resolved) {
        previewBlobUrl = resolved;
      }
      return resolved;
    };
    const waitForStlInstance = (timeoutMs) => {
      const deadline = Date.now() + timeoutMs;
      return new Promise((resolve) => {
        const poll = () => {
          const instance = runtime.getInstance(container);
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
    };
    const preview = {
      async mount() {
        await ensureModelViewerLoaded([getEditionModelViewerUrl()], "edition");
        const element = document.createElement("model-viewer");
        element.setAttribute("shadow-intensity", "1");
        element.setAttribute("tone-mapping", "pbr-neutral");
        element.setAttribute("reveal", "auto");
        element.style.width = "100%";
        element.style.height = "100%";
        element.addEventListener("load", () => {
          callbacks.onModelLoaded(Array.from(element.availableAnimations ?? []));
        });
        element.addEventListener("error", () => callbacks.onModelError());
        container.prepend(element);
        modelViewer = element;
      },
      async update(documentState, force = false) {
        const background = documentState.backgroundColor || DEFAULT_BACKGROUND_COLOR;
        container.style.setProperty("--viewer-preview-bg", background);
        if (documentState.src && isStlSource(documentState.src)) {
          await renderStl(documentState, force);
          return;
        }
        if (!modelViewer) {
          return;
        }
        modelViewer.style.display = "";
        runtime.destroy(container);
        const url = await resolvePreviewUrl(documentState.src);
        if (url && (force || url !== lastPreviewKey || !modelViewer.src)) {
          lastPreviewKey = url;
          modelViewer.src = url;
          modelViewer.setAttribute("src", url);
        }
        modelViewer.alt = documentState.alt;
        if (documentState.alt) {
          modelViewer.setAttribute("aria-label", documentState.alt);
        } else {
          modelViewer.removeAttribute("aria-label");
        }
        modelViewer.style.backgroundColor = background;
        if (documentState.cameraControls) {
          modelViewer.setAttribute("camera-controls", "");
        } else {
          modelViewer.removeAttribute("camera-controls");
        }
        if (documentState.autoRotate) {
          modelViewer.setAttribute("auto-rotate", "");
          modelViewer.setAttribute("rotation-per-second", `${documentState.autoRotateSpeed || 30}deg`);
        } else {
          modelViewer.removeAttribute("auto-rotate");
          modelViewer.removeAttribute("rotation-per-second");
        }
      },
      async attachInteractions(documentState, hooks) {
        destroyInteractions();
        const interaction = documentState.interaction;
        if (!interaction.enabled || !documentState.src) {
          return null;
        }
        const type = detectModelType(documentState.src);
        if (type === "stl") {
          const instance = await waitForStlInstance(STL_READY_TIMEOUT_MS);
          if (!instance) {
            return null;
          }
          interactions = runtime.createInteractionLayer({ wrapper: container, type: "stl", instance }, interaction, "edit", hooks);
          instance.interaction = interactions;
          return interactions;
        }
        interactions = runtime.createInteractionLayer({ wrapper: container, type, modelViewer }, interaction, "edit", hooks);
        return interactions;
      },
      getInteractions: () => interactions,
      syncInteractions(interaction) {
        interactions?.setState(interaction);
      },
      nudgeCamera(dAzimuth, dPolar) {
        const instance = runtime.getInstance(container);
        const camera = instance?.camera;
        if (camera) {
          const controls = instance?.controls;
          const radius = Math.hypot(camera.position.x, camera.position.y, camera.position.z) || 1;
          const azimuth = (controls?.getAzimuthalAngle?.() ?? Math.atan2(camera.position.x, camera.position.z)) + dAzimuth;
          const polar = clamp2((controls?.getPolarAngle?.() ?? Math.acos(clamp2(camera.position.y / radius, -1, 1))) + dPolar, MIN_POLAR, MAX_POLAR);
          const sinPolar = Math.sin(polar);
          camera.position.set(radius * sinPolar * Math.sin(azimuth), radius * Math.cos(polar), radius * sinPolar * Math.cos(azimuth));
          camera.lookAt(0, 0, 0);
          controls?.update?.();
          return;
        }
        const orbit = modelViewer?.getCameraOrbit?.();
        if (!modelViewer || !orbit) {
          return;
        }
        const theta = (orbit.theta ?? 0) + dAzimuth;
        const phi = clamp2((orbit.phi ?? Math.PI / 2) + dPolar, MIN_POLAR, MAX_POLAR);
        modelViewer.cameraOrbit = `${theta}rad ${phi}rad ${orbit.radius ?? "auto"}m`;
        modelViewer.jumpCameraToGoal?.();
      },
      getModelViewer: () => modelViewer,
      resolveMediaUrl,
      destroy() {
        destroyInteractions();
        runtime.destroy(container);
        previewBlobUrl = "";
        lastPreviewKey = "";
      }
    };
    async function renderStl(documentState, force) {
      const url = await resolvePreviewUrl(documentState.src);
      if (!url) {
        console.warn("[3D Viewer] STL: no URL available for", documentState.src);
        return;
      }
      const key = JSON.stringify({
        url,
        modelColor: documentState.modelColor,
        backgroundColor: documentState.backgroundColor,
        cameraControls: documentState.cameraControls,
        autoRotate: documentState.autoRotate,
        autoRotateSpeed: documentState.autoRotateSpeed
      });
      const existing = runtime.getInstance(container);
      if (!force && key === lastPreviewKey && existing?.renderer) {
        return;
      }
      lastPreviewKey = key;
      if (modelViewer) {
        modelViewer.style.display = "none";
      }
      await ensureThreeJsLoaded(getEditionLibBaseUrl());
      runtime.destroy(container);
      runtime.init(container, {
        src: url,
        type: "stl",
        modelColor: documentState.modelColor || DEFAULT_MODEL_COLOR,
        backgroundColor: documentState.backgroundColor || DEFAULT_BACKGROUND_COLOR,
        cameraControls: documentState.cameraControls,
        autoRotate: documentState.autoRotate,
        autoRotateSpeed: documentState.autoRotateSpeed || 30
      });
    }
    return preview;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/edition/scorm.ts
  function getScormEdition() {
    return globalThis.$exeDevicesEdition?.iDevice?.gamification?.scorm ?? null;
  }
  function shouldShowScormSection(interactionEnabled, markers) {
    return interactionEnabled && markers.some((marker) => marker.action.type === "question");
  }
  function createScormSection(host) {
    let rendered = false;
    return {
      render(scorm, defaultButtonText) {
        const framework = getScormEdition();
        if (!framework?.getTab) {
          return;
        }
        try {
          host.innerHTML = framework.getTab(false, false);
          framework.init?.();
          framework.setValues?.(scorm.mode, scorm.saveButtonText || defaultButtonText, true, scorm.weighted);
          rendered = true;
        } catch (error) {
          console.warn("[3D Viewer] SCORM tab unavailable:", error);
        }
      },
      read(current) {
        const framework = getScormEdition();
        if (rendered && framework?.getValues) {
          try {
            const values = framework.getValues();
            if (values) {
              return normalizeScorm(values);
            }
          } catch {}
        }
        return normalizeScorm(current);
      },
      isRendered: () => rendered,
      reset() {
        rendered = false;
        host.innerHTML = "";
      }
    };
  }

  // public/files/perm/idevices/base/three-d-viewer/src/edition/device.ts
  var YAW_STEP = 15 * Math.PI / 180;
  var PITCH_STEP = 10 * Math.PI / 180;
  var MAX_PREVIEW_RETRIES = 3;
  function defaultTranslate(text) {
    return typeof globalThis._ === "function" ? globalThis._(text) : text;
  }
  function defaultAlert(message) {
    const app = globalThis.eXe?.app;
    if (typeof app?.alert === "function") {
      app.alert(message);
      return;
    }
    console.warn("[3D Viewer]", message);
  }
  var defaultDependencies = {
    translate: defaultTranslate,
    createId: defaultIdFactory,
    createPreview: createEditorPreview,
    alert: defaultAlert
  };
  function createThreeDViewerDevice(overrides = {}) {
    const deps = { ...defaultDependencies, ...overrides };
    const t = deps.translate;
    const emptyDocument = () => {
      const fresh = hydrateDocument(null, deps.createId);
      if (fresh.status !== "ok") {
        throw new Error("[3D Viewer] Default document failed to hydrate");
      }
      return fresh.document;
    };
    let hydration = { status: "ok", document: emptyDocument() };
    let documentState = hydration.status === "ok" ? hydration.document : emptyDocument();
    let elements = null;
    let preview = null;
    let scormSection = null;
    let markerEditor = null;
    let previewRetries = 0;
    const announce = (message) => {
      if (elements) {
        elements.ariaLive.textContent = message;
      }
    };
    const interactionHooks = () => ({
      t,
      onPlaced: (placement) => device.handleMarkerPlaced(placement),
      resolveMediaUrl: (url) => preview?.resolveMediaUrl(url) ?? url
    });
    const syncPreviewInteractions = () => {
      preview?.syncInteractions(documentState.interaction);
    };
    const refreshScormVisibility = () => {
      if (!elements || !scormSection) {
        return;
      }
      const show = shouldShowScormSection(documentState.interaction.enabled, documentState.interaction.markers);
      elements.scormSection.hidden = !show;
      if (show && !scormSection.isRendered()) {
        scormSection.render(documentState.scorm, t("Save score"));
      }
    };
    const refreshMarkerList = () => {
      if (!elements) {
        return;
      }
      renderMarkerList(elements.markerList, documentState.interaction.markers, t, {
        onMove: (markerId, delta) => {
          documentState.interaction.markers = moveMarker(documentState.interaction.markers, markerId, delta);
          refreshMarkerList();
          syncPreviewInteractions();
        },
        onEdit: (markerId) => openEditorFor(markerId),
        onDelete: (markerId) => deleteMarker(markerId)
      });
      refreshScormVisibility();
    };
    const deleteMarker = (markerId) => {
      documentState.interaction.markers = removeMarker(documentState.interaction.markers, markerId);
      if (markerEditor?.markerId === markerId) {
        markerEditor.close();
        markerEditor = null;
      }
      refreshMarkerList();
      syncPreviewInteractions();
    };
    const openEditorFor = (markerId) => {
      if (!elements) {
        return;
      }
      const marker = documentState.interaction.markers.find((candidate) => candidate.id === markerId);
      if (!marker) {
        return;
      }
      markerEditor?.close();
      markerEditor = openMarkerEditor(elements.markerEditorHost, marker, t, deps.createId, {
        onSave: (saved) => {
          const index = documentState.interaction.markers.findIndex((candidate) => candidate.id === markerId);
          if (index >= 0) {
            documentState.interaction.markers[index] = { ...saved, order: index };
          }
          markerEditor = null;
          refreshMarkerList();
          syncPreviewInteractions();
        },
        onCancel: () => {
          markerEditor = null;
        },
        onDelete: (id) => {
          markerEditor = null;
          deleteMarker(id);
        },
        captureCamera: () => preview?.getInteractions()?.captureCamera() ?? null
      });
    };
    const refreshInteractionVisibility = () => {
      if (!elements) {
        return;
      }
      elements.interactionsBody.hidden = !documentState.interaction.enabled;
      elements.addMarker.disabled = !documentState.src;
      refreshScormVisibility();
    };
    const applyDisplayFormState = () => {
      if (!elements) {
        return;
      }
      const settings = readDisplaySettings(elements, documentState.src);
      documentState = { ...documentState, ...settings };
      updateAutoRotateSpeedState(elements);
    };
    const refreshPreview = (force = false) => {
      if (!elements || !preview) {
        return;
      }
      updateEmptyState(elements, documentState.src);
      preview.update(documentState, force).then(() => {
        preview?.attachInteractions(documentState, interactionHooks());
      });
    };
    const registerBehaviours = () => {
      if (!elements) {
        return;
      }
      const el = elements;
      const onDisplayChange = () => {
        applyDisplayFormState();
        refreshPreview();
      };
      for (const control of [
        el.alt,
        el.modelColor,
        el.backgroundColor,
        el.cameraControls,
        el.autoRotateSpeed,
        el.animationToggle,
        el.animationName,
        el.animationSpeed
      ]) {
        control.addEventListener("change", onDisplayChange);
        if (control instanceof HTMLInputElement && control.type === "text") {
          control.addEventListener("input", onDisplayChange);
        }
      }
      const onExclusiveToggle = (winner) => {
        if (winner === "autoRotate" && el.autoRotate.checked) {
          el.showNavControls.checked = false;
        } else if (winner === "showNavControls" && el.showNavControls.checked) {
          el.autoRotate.checked = false;
        }
        applyDisplayFormState();
        updateNavControlsVisibility(el, documentState.showNavControls);
        refreshPreview();
      };
      el.autoRotate.addEventListener("change", () => onExclusiveToggle("autoRotate"));
      el.showNavControls.addEventListener("change", () => onExclusiveToggle("showNavControls"));
      el.src.addEventListener("change", () => {
        handleModelSelection();
      });
      el.interactionsEnable.addEventListener("change", () => {
        documentState.interaction.enabled = el.interactionsEnable.checked;
        refreshInteractionVisibility();
        preview?.attachInteractions(documentState, interactionHooks());
      });
      const syncFlag = (control, key) => {
        control.addEventListener("change", () => {
          documentState.interaction[key] = control.checked;
          syncPreviewInteractions();
        });
      };
      syncFlag(el.guidedMode, "guidedMode");
      syncFlag(el.wrapNavigation, "wrapNavigation");
      syncFlag(el.showMarkerLabels, "showMarkerLabels");
      el.addMarker.addEventListener("click", () => {
        startMarkerPlacement();
      });
      const fullscreen = el.preview.querySelector("[data-fullscreen]");
      if (fullscreen) {
        const target = el.preview.parentElement ?? el.preview;
        const isFullscreen = () => document.fullscreenElement === target;
        fullscreen.addEventListener("click", () => {
          if (isFullscreen()) {
            document.exitFullscreen?.();
          } else {
            target.requestFullscreen?.();
          }
        });
        document.addEventListener("fullscreenchange", () => {
          const label = t(isFullscreen() ? "Exit fullscreen" : "Fullscreen");
          fullscreen.setAttribute("aria-label", label);
          fullscreen.setAttribute("title", label);
        });
      }
      for (const button of Array.from(el.preview.querySelectorAll("[data-nav]"))) {
        const direction = button.getAttribute("data-nav");
        const dAzimuth = direction === "right" ? -YAW_STEP : direction === "left" ? YAW_STEP : 0;
        const dPolar = direction === "up" ? PITCH_STEP : direction === "down" ? -PITCH_STEP : 0;
        button.addEventListener("click", () => preview?.nudgeCamera(dAzimuth, dPolar));
      }
    };
    const handleModelSelection = async () => {
      if (!elements) {
        return;
      }
      const picked = elements.src.value;
      if (!picked) {
        return;
      }
      if (picked.startsWith("blob:")) {
        console.warn("[3D Viewer] Refusing to store a blob: URL as the model source");
        elements.src.value = documentState.src;
        return;
      }
      documentState.src = picked;
      applyDisplayFormState();
      updateModelColorFieldState(elements, documentState.src, t);
      refreshInteractionVisibility();
      refreshPreview(true);
    };
    const startMarkerPlacement = async () => {
      if (!elements || !documentState.src) {
        return;
      }
      if (!documentState.interaction.enabled) {
        documentState.interaction.enabled = true;
        elements.interactionsEnable.checked = true;
        refreshInteractionVisibility();
      }
      const layer = await preview?.attachInteractions(documentState, interactionHooks());
      if (!layer) {
        return;
      }
      layer.enterPlacementMode();
      elements.placementHint.hidden = false;
      announce(t("Click on the model to place the marker."));
    };
    const device = {
      name: t("3D Viewer"),
      i18n: { name: t("3D Viewer") },
      async init(element, previousData) {
        preview?.destroy();
        preview = null;
        markerEditor = null;
        previewRetries = 0;
        device.set3DViewerJSON(previousData ?? {});
        if (hydration.status !== "ok") {
          const version = hydration.status === "unsupported-version" ? hydration.version : 0;
          element.innerHTML = renderUnsupportedVersionMarkup(t, version);
          elements = null;
          return;
        }
        element.innerHTML = renderEditorMarkup(t);
        elements = collectElements(element);
        scormSection = createScormSection(elements.scormHost);
        applyDocumentToForm(elements, documentState);
        updateAutoRotateSpeedState(elements);
        updateNavControlsVisibility(elements, documentState.showNavControls);
        updateModelColorFieldState(elements, documentState.src, t);
        updateEmptyState(elements, documentState.src);
        elements.animationRow.hidden = true;
        elements.animationToggle.disabled = true;
        elements.animationName.disabled = true;
        elements.animationSpeed.disabled = true;
        refreshInteractionVisibility();
        refreshMarkerList();
        preview = deps.createPreview(elements.preview, {
          onModelLoaded: (available) => {
            if (!elements) {
              return;
            }
            previewRetries = 0;
            documentState.animation = updateAnimationOptions(elements, available, documentState.animation);
            updateEmptyState(elements, documentState.src);
            preview?.attachInteractions(documentState, interactionHooks());
          },
          onModelError: () => {
            if (!documentState.src || previewRetries >= MAX_PREVIEW_RETRIES) {
              return;
            }
            previewRetries += 1;
            setTimeout(() => refreshPreview(true), 150 * previewRetries);
          }
        });
        await preview.mount();
        registerBehaviours();
        refreshPreview(true);
      },
      save() {
        if (hydration.status !== "ok") {
          deps.alert(t("This 3D Viewer was created with a newer version of eXeLearning and cannot be edited here."));
          return hydration.original;
        }
        if (elements) {
          applyDisplayFormState();
          documentState.scorm = scormSection?.read(documentState.scorm) ?? documentState.scorm;
        }
        if (!documentState.src) {
          deps.alert(t("Please select a 3D model file"));
          return false;
        }
        if (!isSupportedModelFile(documentState.src)) {
          deps.alert(t("Please select a valid 3D model file (GLB, GLTF, or STL)"));
          return false;
        }
        return device.get3DViewerJSON();
      },
      set3DViewerJSON(data) {
        hydration = hydrateDocument(data, deps.createId);
        if (hydration.status !== "ok") {
          return;
        }
        documentState = hydration.document;
        const rawSrc = data?.src;
        if (typeof rawSrc === "string" && rawSrc.startsWith("blob:")) {
          const assetRef = recoverAssetRefFromBlob(rawSrc);
          if (assetRef) {
            documentState.src = `asset://${assetRef}`;
          } else {
            console.warn("[3D Viewer] Discarding a stale blob: URL from stored data");
          }
        }
      },
      get3DViewerJSON() {
        if (hydration.status !== "ok") {
          return hydration.original;
        }
        return serializeDocument(documentState, deps.createId);
      },
      handleMarkerPlaced(placement) {
        if (elements) {
          elements.placementHint.hidden = true;
        }
        const index = documentState.interaction.markers.length;
        const marker = normalizeMarker({
          label: "",
          icon: "circle",
          order: index,
          anchor: {
            position: placement.position,
            normal: placement.normal,
            surface: placement.surface
          },
          camera: placement.camera,
          action: { type: "information", payload: { html: "" } }
        }, index, deps.createId);
        documentState.interaction.markers.push(marker);
        refreshMarkerList();
        syncPreviewInteractions();
        openEditorFor(marker.id);
      },
      getDocument: () => documentState,
      getHydration: () => hydration
    };
    return device;
  }

  // public/files/perm/idevices/base/three-d-viewer/src/edition/index.ts
  var device = createThreeDViewerDevice();
  publishViewerRuntime();
  globalThis.$exeDevice = device;
  if (typeof window !== "undefined") {
    window.$exeDevice = device;
  }
})();

//# debugId=1D7312B920602D2464756E2164756E21
//# sourceMappingURL=three-d-viewer.js.map

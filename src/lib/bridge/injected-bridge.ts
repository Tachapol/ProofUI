/**
 * Source code for the Editor Bridge script that runs inside the preview iframe.
 * Validates session ID on all messages, executes optimistic DOM operations in-place,
 * reports bounding rects and serialized DOM mutations to the parent editor.
 */
export function getInjectedBridgeScript(sessionId = "editor-session"): string {
  return `
(function() {
  var ACTIVE_SESSION_ID = "${sessionId}";
  var currentRevision = 0;
  var IGNORED_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'HEAD', 'HTML'];
  var SEMANTIC_SECTIONS = ['HEADER', 'FOOTER', 'MAIN', 'NAV', 'SECTION', 'ARTICLE', 'ASIDE'];

  var selectedElement = null;
  var hoveredElement = null;
  var currentEditorMode = 'design';

  function generateNodeId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'node_' + crypto.randomUUID();
    }
    var s4 = function() { return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1); };
    return 'node_' + s4() + s4() + '-' + s4() + '-4' + s4().substring(0, 3) + '-a' + s4().substring(0, 3) + '-' + s4() + s4() + s4();
  }

  function assignEditorIds(root) {
    if (!root || IGNORED_TAGS.indexOf(root.tagName.toUpperCase()) !== -1) return;
    if (!root.getAttribute('data-editor-id')) {
      root.setAttribute('data-editor-id', generateNodeId());
    }
    for (var i = 0; i < root.children.length; i++) {
      var child = root.children[i];
      if (IGNORED_TAGS.indexOf(child.tagName.toUpperCase()) !== -1) continue;
      assignEditorIds(child);
    }
  }

  function reassignSubtreeIds(root) {
    if (!root || IGNORED_TAGS.indexOf(root.tagName.toUpperCase()) !== -1) return;
    root.setAttribute('data-editor-id', generateNodeId());
    for (var i = 0; i < root.children.length; i++) {
      var child = root.children[i];
      if (IGNORED_TAGS.indexOf(child.tagName.toUpperCase()) !== -1) continue;
      reassignSubtreeIds(child);
    }
  }

  function serializeDomTree(element) {
    var tagName = element.tagName.toLowerCase();
    var id = element.getAttribute('data-editor-id') || '';
    var className = (element.className && typeof element.className === 'string') ? element.className : '';

    var textContent = undefined;
    if (element.children.length === 0) {
      var raw = (element.textContent || '').trim();
      if (raw) {
        textContent = raw.length > 45 ? raw.slice(0, 42) + '...' : raw;
      }
    } else {
      var directText = '';
      for (var j = 0; j < element.childNodes.length; j++) {
        if (element.childNodes[j].nodeType === 3) {
          directText += ' ' + (element.childNodes[j].textContent || '').trim();
        }
      }
      directText = directText.trim();
      if (directText) {
        textContent = directText.length > 40 ? directText.slice(0, 37) + '...' : directText;
      }
    }

    var attributes = {};
    for (var k = 0; k < element.attributes.length; k++) {
      var attr = element.attributes[k];
      if (['id', 'href', 'src', 'alt', 'placeholder', 'type', 'role', 'title', 'aria-label', 'target', 'rel'].indexOf(attr.name) !== -1) {
        attributes[attr.name] = attr.value;
      }
    }

    var isComponentOrSection =
      SEMANTIC_SECTIONS.indexOf(element.tagName.toUpperCase()) !== -1 ||
      element.getAttribute('role') === 'region' ||
      element.getAttribute('role') === 'navigation' ||
      element.hasAttribute('data-component');

    var children = [];
    for (var i = 0; i < element.children.length; i++) {
      var child = element.children[i];
      if (IGNORED_TAGS.indexOf(child.tagName.toUpperCase()) === -1) {
        children.push(serializeDomTree(child));
      }
    }

    var node = {
      id: id,
      tagName: tagName,
      className: className,
      children: children,
      isComponentOrSection: isComponentOrSection
    };
    if (textContent) node.textContent = textContent;
    if (Object.keys(attributes).length > 0) node.attributes = attributes;
    return node;
  }

  function getRect(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      bottom: r.bottom,
      right: r.right
    };
  }

  function getPath(el) {
    var path = [];
    var curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      var id = curr.getAttribute('data-editor-id');
      if (id) path.unshift(id);
      curr = curr.parentElement;
    }
    if (document.body && document.body.getAttribute('data-editor-id')) {
      path.unshift(document.body.getAttribute('data-editor-id'));
    }
    return path;
  }

  function postToParent(type, payload) {
    payload.sessionId = ACTIVE_SESSION_ID;
    window.parent.postMessage({
      source: 'visual-editor-iframe',
      type: type,
      payload: payload
    }, '*');
  }

  function notifyRectsUpdated() {
    var selectedId = selectedElement ? selectedElement.getAttribute('data-editor-id') : null;
    var hoveredId = hoveredElement ? hoveredElement.getAttribute('data-editor-id') : null;
    postToParent('RECTS_UPDATED', {
      selectedId: selectedId,
      selectedRect: getRect(selectedElement),
      hoveredId: hoveredId,
      hoveredRect: getRect(hoveredElement)
    });
  }

  function findClosestEditable(el) {
    var curr = el;
    while (curr && curr !== document.documentElement) {
      if (curr.getAttribute && curr.getAttribute('data-editor-id')) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }

  // Hover detection
  document.addEventListener('mouseover', function(e) {
    if (currentEditorMode === 'preview') return;

    var target = findClosestEditable(e.target);
    if (!target || target === document.body || target === document.documentElement) {
      if (hoveredElement) {
        hoveredElement = null;
        postToParent('NODE_HOVERED', { id: null, rect: null, tagName: null });
      }
      return;
    }
    if (target === hoveredElement) return;
    hoveredElement = target;
    postToParent('NODE_HOVERED', {
      id: target.getAttribute('data-editor-id'),
      rect: getRect(target),
      tagName: target.tagName.toLowerCase()
    });
  }, true);

  document.addEventListener('mouseleave', function(e) {
    if (hoveredElement) {
      hoveredElement = null;
      postToParent('NODE_HOVERED', { id: null, rect: null, tagName: null });
    }
  });

  // Form submission defense
  document.addEventListener('submit', function(e) {
    if (currentEditorMode === 'design') {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ─── Interaction Tracking State (Preview Mode Only) ─────────────────────
  var CTA_TAG_NAMES = ['BUTTON', 'A'];
  var CTA_ROLES = ['button', 'link'];
  var CTA_CLASS_HINTS = ['cta', 'btn', 'button', 'action', 'submit', 'signup', 'sign-up', 'get-started', 'try-free', 'download'];
  var scrollThresholds = { 25: false, 50: false, 75: false, 100: false };
  var interactionEventCount = 0;
  var MAX_INTERACTION_EVENTS = 10000;
  var currentViewport = 'desktop'; // Updated via SET_EDITOR_MODE or inferred

  function getViewportFromWidth() {
    var w = window.innerWidth;
    if (w <= 480) return 'mobile';
    if (w <= 820) return 'tablet';
    return 'desktop';
  }
  currentViewport = getViewportFromWidth();

  function isCTAElement(el) {
    if (!el) return false;
    var tag = el.tagName.toUpperCase();
    if (CTA_TAG_NAMES.indexOf(tag) !== -1) return true;
    var role = (el.getAttribute('role') || '').toLowerCase();
    if (CTA_ROLES.indexOf(role) !== -1) return true;
    var className = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
    for (var i = 0; i < CTA_CLASS_HINTS.length; i++) {
      if (className.indexOf(CTA_CLASS_HINTS[i]) !== -1) return true;
    }
    return false;
  }

  function postInteractionEvent(type, el, metadata) {
    if (interactionEventCount >= MAX_INTERACTION_EVENTS) return;
    interactionEventCount++;
    var editorId = el ? (el.getAttribute('data-editor-id') || '') : '';
    var tagName = el ? el.tagName.toLowerCase() : '';
    postToParent('INTERACTION_EVENT', {
      event: {
        type: type,
        editorId: editorId,
        tagName: tagName,
        timestamp: Date.now(),
        viewport: currentViewport,
        metadata: metadata || undefined
      }
    });
  }

  // Click selection & interaction tracking
  document.addEventListener('click', function(e) {
    if (currentEditorMode === 'preview') {
      // In preview mode, allow normal interaction, but prevent javascript: URLs
      var anchor = e.target && e.target.closest ? e.target.closest('a') : null;
      if (anchor) {
        var href = anchor.getAttribute('href') || '';
        if (href.indexOf('javascript:') === 0) {
          e.preventDefault();
        }
      }

      // Track interaction evidence
      var interactTarget = findClosestEditable(e.target);
      if (interactTarget) {
        var ctaDetected = isCTAElement(interactTarget) || (e.target && isCTAElement(e.target));
        if (ctaDetected) {
          postInteractionEvent('cta_click', interactTarget, { isCta: true });
        } else {
          postInteractionEvent('click', interactTarget);
        }
      }
      return;
    }

    // Design mode: always intercept click and select element
    e.preventDefault();
    e.stopPropagation();

    var target = findClosestEditable(e.target);
    if (!target) return;

    selectedElement = target;
    postToParent('NODE_SELECTED', {
      id: target.getAttribute('data-editor-id'),
      rect: getRect(target),
      tagName: target.tagName.toLowerCase(),
      path: getPath(target)
    });
  }, true);

  // ─── Scroll Depth Tracking (Preview Mode) ─────────────────────────────
  function checkScrollDepth() {
    if (currentEditorMode !== 'preview') return;
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    var docHeight = Math.max(
      document.body.scrollHeight || 0,
      document.documentElement.scrollHeight || 0
    );
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    var scrollableHeight = docHeight - viewportHeight;
    if (scrollableHeight <= 0) return;

    var percent = Math.min(100, Math.round((scrollTop / scrollableHeight) * 100));
    var thresholds = [25, 50, 75, 100];
    for (var i = 0; i < thresholds.length; i++) {
      var t = thresholds[i];
      if (percent >= t && !scrollThresholds[t]) {
        scrollThresholds[t] = true;
        postInteractionEvent('scroll_depth', document.body, { scrollPercent: t });
      }
    }
  }

  window.addEventListener('scroll', function() {
    checkScrollDepth();
  }, { passive: true });

  // ─── Form Interaction Tracking (Preview Mode) ─────────────────────────
  // Track focus on form elements — NEVER capture field values
  document.addEventListener('focusin', function(e) {
    if (currentEditorMode !== 'preview') return;
    var el = e.target;
    if (!el || !el.tagName) return;
    var tag = el.tagName.toUpperCase();
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;

    var closestEditable = findClosestEditable(el);
    if (!closestEditable) return;

    var fieldType = el.getAttribute('type') || tag.toLowerCase();
    postInteractionEvent('form_focus', closestEditable, { formFieldType: fieldType });
  }, true);

  // Track change on form elements — NEVER capture field values
  document.addEventListener('change', function(e) {
    if (currentEditorMode !== 'preview') return;
    var el = e.target;
    if (!el || !el.tagName) return;
    var tag = el.tagName.toUpperCase();
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;

    var closestEditable = findClosestEditable(el);
    if (!closestEditable) return;

    var fieldType = el.getAttribute('type') || tag.toLowerCase();
    postInteractionEvent('form_change', closestEditable, { formFieldType: fieldType });
  }, true);

  // Sync rects on scroll & resize
  window.addEventListener('scroll', notifyRectsUpdated, { passive: true });
  window.addEventListener('resize', notifyRectsUpdated, { passive: true });

  // Handle messages from parent editor
  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || data.source !== 'visual-editor-parent') return;

    if (data.type === 'HANDSHAKE' && data.payload && data.payload.sessionId) {
      ACTIVE_SESSION_ID = data.payload.sessionId;
      init();
      return;
    }

    if (!data.payload || data.payload.sessionId !== ACTIVE_SESSION_ID) {
      return; // Reject messages with mismatched session ID
    }

    if (data.type === 'SET_EDITOR_MODE') {
      currentEditorMode = data.payload.mode;
      if (currentEditorMode === 'preview') {
        hoveredElement = null;
        selectedElement = null;
        postToParent('NODE_HOVERED', { id: null, rect: null, tagName: null });
        postToParent('NODE_SELECTED', { id: null, rect: null, tagName: null, path: [] });
        // Reset interaction tracking for fresh preview session
        scrollThresholds = { 25: false, 50: false, 75: false, 100: false };
        interactionEventCount = 0;
        currentViewport = getViewportFromWidth();
      }
      return;
    }

    if (data.type === 'SELECT_NODE') {
      var id = data.payload ? data.payload.id : null;
      if (!id) {
        selectedElement = null;
        postToParent('NODE_SELECTED', {
          id: null,
          rect: null,
          tagName: null,
          path: []
        });
        return;
      }
      var el = document.querySelector('[data-editor-id="' + id + '"]');
      if (el) {
        selectedElement = el;
        if (data.payload.scrollIntoView) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          setTimeout(function() {
            postToParent('NODE_SELECTED', {
              id: id,
              rect: getRect(el),
              tagName: el.tagName.toLowerCase(),
              path: getPath(el)
            });
          }, 150);
        } else {
          postToParent('NODE_SELECTED', {
            id: id,
            rect: getRect(el),
            tagName: el.tagName.toLowerCase(),
            path: getPath(el)
          });
        }
      }
    } else if (data.type === 'HOVER_NODE') {
      var hoverId = data.payload ? data.payload.id : null;
      if (!hoverId) {
        hoveredElement = null;
        postToParent('NODE_HOVERED', { id: null, rect: null, tagName: null });
        return;
      }
      var hoverEl = document.querySelector('[data-editor-id="' + hoverId + '"]');
      if (hoverEl) {
        hoveredElement = hoverEl;
        postToParent('NODE_HOVERED', {
          id: hoverId,
          rect: getRect(hoverEl),
          tagName: hoverEl.tagName.toLowerCase()
        });
      }
    } else if (data.type === 'SCROLL_INTO_VIEW') {
      var targetId = data.payload ? data.payload.id : null;
      if (targetId) {
        var scrollEl = document.querySelector('[data-editor-id="' + targetId + '"]');
        if (scrollEl) {
          scrollEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    } else if (data.type === 'APPLY_OPERATION') {
      // Ignore stale revisions
      if (typeof data.payload.revision === 'number') {
        if (data.payload.revision < currentRevision) return;
        currentRevision = data.payload.revision;
      }

      var op = data.payload.operation;
      var targetEl = document.querySelector('[data-editor-id="' + op.nodeId + '"]');
      if (!targetEl) return;

      if (op.type === 'update_text') {
        if (targetEl.children.length === 0) {
          targetEl.textContent = op.value;
        }
      } else if (op.type === 'update_classes') {
        var existing = targetEl.className ? targetEl.className.split(/\\s+/).filter(Boolean) : [];
        var removeSet = {};
        for (var r = 0; r < op.remove.length; r++) removeSet[op.remove[r]] = true;
        var remaining = [];
        for (var e = 0; e < existing.length; e++) {
          if (!removeSet[existing[e]]) remaining.push(existing[e]);
        }
        for (var a = 0; a < op.add.length; a++) {
          var toAdd = op.add[a].trim();
          if (toAdd && remaining.indexOf(toAdd) === -1) remaining.push(toAdd);
        }
        targetEl.className = remaining.join(' ');
      } else if (op.type === 'set_attribute') {
        targetEl.setAttribute(op.name, op.value);
        if (op.name === 'target' && op.value === '_blank') {
          var rel = targetEl.getAttribute('rel') || '';
          if (rel.indexOf('noopener') === -1) targetEl.setAttribute('rel', 'noopener noreferrer');
        }
      } else if (op.type === 'remove_attribute') {
        targetEl.removeAttribute(op.name);
      } else if (op.type === 'duplicate_node') {
        var clone = targetEl.cloneNode(true);
        reassignSubtreeIds(clone);
        if (op.newId) {
          clone.setAttribute('data-editor-id', op.newId);
        }
        targetEl.parentNode.insertBefore(clone, targetEl.nextSibling);
        selectedElement = clone;
        var newId = clone.getAttribute('data-editor-id');
        postToParent('NODE_SELECTED', {
          id: newId,
          rect: getRect(clone),
          tagName: clone.tagName.toLowerCase(),
          path: getPath(clone)
        });
      } else if (op.type === 'delete_node') {
        if (selectedElement === targetEl) {
          selectedElement = null;
          postToParent('NODE_SELECTED', { id: null, rect: null, tagName: null, path: [] });
        }
        targetEl.parentNode.removeChild(targetEl);
      }

      // Re-serialize and notify parent
      var updatedTree = serializeDomTree(document.body);
      postToParent('DOCUMENT_MUTATED', {
        documentTree: updatedTree,
        revision: currentRevision
      });
      notifyRectsUpdated();
    } else if (data.type === 'SET_DOCUMENT_SOURCE') {
      if (typeof data.payload.revision === 'number') {
        if (data.payload.revision < currentRevision) return;
        currentRevision = data.payload.revision;
      }
      try {
        var parser = new DOMParser();
        var newDoc = parser.parseFromString(data.payload.source, 'text/html');
        if (newDoc && newDoc.body) {
          document.body.innerHTML = newDoc.body.innerHTML;
          assignEditorIds(document.body);
          if (selectedElement) {
            var currId = selectedElement.getAttribute('data-editor-id');
            selectedElement = currId ? document.querySelector('[data-editor-id="' + currId + '"]') : null;
          }
          var tree = serializeDomTree(document.body);
          postToParent('DOCUMENT_MUTATED', {
            documentTree: tree,
            revision: currentRevision
          });
          notifyRectsUpdated();
        }
      } catch (err) {
        console.warn('Failed to parse full source in iframe:', err);
      }
    } else if (data.type === 'REQUEST_HEATMAP_DATA') {
      collectHeatmapData();
    } else if (data.type === 'SYNC_SCROLL_TO_IFRAME') {
      var pct = data.payload ? data.payload.scrollPercentage : 0;
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      isSyncingScroll = true;
      window.scrollTo({ top: pct * maxScroll, behavior: 'auto' });
      setTimeout(function() { isSyncingScroll = false; }, 60);
    }
  });

  var isSyncingScroll = false;
  var scrollReportTimer = null;
  window.addEventListener('scroll', function() {
    if (isSyncingScroll) return;
    if (scrollReportTimer) clearTimeout(scrollReportTimer);
    scrollReportTimer = setTimeout(function() {
      var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var pct = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      postToParent('IFRAME_SCROLLED', {
        scrollPercentage: pct
      });
    }, 40);
  }, { passive: true });

  function isInteractiveElement(el) {
    if (!el) return false;
    var tag = el.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') return true;
    var role = (el.getAttribute('role') || '').toLowerCase();
    if (role === 'button' || role === 'link' || role === 'tab' || role === 'menuitem') return true;
    var cls = (el.className || '').toLowerCase();
    if (cls.indexOf('cursor-pointer') !== -1 || cls.indexOf('btn') !== -1 || cls.indexOf('button') !== -1) return true;
    if (el.onclick || el.getAttribute('onclick')) return true;
    return false;
  }

  function collectHeatmapData() {
    var nodes = [];
    var all = document.querySelectorAll('[data-editor-id]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el === document.body || el === document.documentElement) continue;
      var rect = getRect(el);
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;

      var isInteractive = isInteractiveElement(el);
      var text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      nodes.push({
        id: el.getAttribute('data-editor-id'),
        tagName: el.tagName.toLowerCase(),
        rect: rect,
        textContent: text || undefined,
        isInteractive: isInteractive,
        classes: el.className || undefined,
        role: el.getAttribute('role') || undefined
      });
    }

    var scrollH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, window.innerHeight);
    var scrollW = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth, window.innerWidth);

    postToParent('HEATMAP_DATA_REPORT', {
      nodes: nodes,
      scrollHeight: scrollH,
      scrollWidth: scrollW,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    });
  }

  function init() {
    assignEditorIds(document.body);
    var tree = serializeDomTree(document.body);
    postToParent('IFRAME_READY', {
      documentTree: tree,
      title: document.title || 'Untitled Landing Page',
      revision: currentRevision
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;
}

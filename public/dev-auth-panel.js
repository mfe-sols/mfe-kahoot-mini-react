/**
 * Dev Auth Panel — Standalone development helper
 * ────────────────────────────────────────────────
 * Inject this script into any module's standalone index.html
 * to get a floating login/logout panel for local development.
 *
 * When `window.__MFE_REQUIRE_AUTH__` is true (default), the module
 * content is hidden behind a blur overlay until the dev signs in.
 *
 * Usage in template index.html:
 *   <script>window.__MFE_REQUIRE_AUTH__ = true;</script>
 *   <script src="/dev-auth-panel.js"></script>
 *
 * Live enable (non-localhost):
 *   - Add `?dev-auth=1` to enable panel
 *   - Add `?dev-auth=0` to disable panel
 *
 * Or copy the contents inline inside a <script> tag.
 */
(function devAuthPanel() {
  'use strict';

  var ENABLE_KEY   = 'mfe-dev-auth-panel-enabled';
  var STORAGE_KEY   = 'mfe-auth-state';
  var SCOPE_KEY     = 'mfe-auth-storage';
  var CHANNEL_NAME  = 'mfe-auth-channel';
  var REQUIRE_AUTH  = window.__MFE_REQUIRE_AUTH__ !== false; // default = true
  var isLocalHost = function (host) {
    return host === 'localhost' || host === '127.0.0.1';
  };

  var params = new URLSearchParams(window.location.search || '');
  var enableFromQuery =
    params.get('dev-auth') === '1' || params.get('devAuth') === '1';
  var disableFromQuery =
    params.get('dev-auth') === '0' || params.get('devAuth') === '0';

  if (enableFromQuery) {
    try { localStorage.setItem(ENABLE_KEY, '1'); } catch (e) {}
  }
  if (disableFromQuery) {
    try { localStorage.removeItem(ENABLE_KEY); } catch (e) {}
  }

  var enabledForLive = false;
  try {
    enabledForLive = localStorage.getItem(ENABLE_KEY) === '1';
  } catch (e) {}

  if (!isLocalHost(window.location.hostname) && !enabledForLive) {
    return;
  }

  var MOCK_USER = {
    id:          'dev-user-001',
    email:       'developer@orchestra.dev',
    name:        'Dev User',
    displayName: 'Dev User',
    photoURL:    '',
    roles:       ['admin']
  };

  var MOCK_TOKENS = {
    accessToken:  'dev-mock-access-token-'  + Date.now(),
    refreshToken: 'dev-mock-refresh-token-' + Date.now(),
    expiresAt:    Date.now() + 86400000
  };

  /* ── helpers ────────────────────────────────────── */

  function readAuth() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return (parsed && parsed.tokens && parsed.tokens.accessToken) ? parsed : null;
    } catch (e) { return null; }
  }

  function writeAuth(state) {
    try {
      if (!state) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SCOPE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        localStorage.setItem(SCOPE_KEY, 'local');
      }
      // Notify via BroadcastChannel (same-tab won't get storage event)
      try {
        var bc = new BroadcastChannel(CHANNEL_NAME);
        bc.postMessage({ type: 'auth:update', state: state });
        setTimeout(function () { bc.close(); }, 100);
      } catch (e) { /* BroadcastChannel not supported */ }
      // Reload to reinitialize framework state cleanly
      window.location.reload();
    } catch (e) {
      console.error('[Dev Auth]', e);
    }
  }

  /* ── auth-gate overlay ─────────────────────────── */

  function createAuthGate(isLoggedIn) {
    if (!REQUIRE_AUTH || isLoggedIn) return;

    var overlay = document.createElement('div');
    overlay.id = 'dev-auth-gate';
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:99998',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'flex-direction:column',
      'gap:16px',
      'backdrop-filter:blur(8px)',
      'background:rgba(15,23,42,0.75)',
      'font-family:ui-sans-serif,system-ui,sans-serif',
      'color:#e2e8f0'
    ].join(';');

    var icon = document.createElement('span');
    icon.textContent = '🔒';
    icon.style.cssText = 'font-size:40px';
    overlay.appendChild(icon);

    var msg = document.createElement('p');
    msg.textContent = 'This module requires authentication';
    msg.style.cssText = 'margin:0;font-size:14px;font-weight:500;color:#94a3b8';
    overlay.appendChild(msg);

    var hint = document.createElement('p');
    hint.textContent = 'Use the Dev Sign In button below to continue';
    hint.style.cssText = 'margin:0;font-size:12px;color:#64748b';
    overlay.appendChild(hint);

    document.body.appendChild(overlay);
  }

  /* ── floating panel ────────────────────────────── */

  function createPanel() {
    var auth = readAuth();
    var isLoggedIn = Boolean(auth);

    // Remove existing panel / gate on re-render
    var old = document.getElementById('dev-auth-panel');
    if (old) old.remove();
    var oldGate = document.getElementById('dev-auth-gate');
    if (oldGate) oldGate.remove();

    // Show auth-gate overlay when required
    createAuthGate(isLoggedIn);

    // Container
    var panel = document.createElement('div');
    panel.id = 'dev-auth-panel';
    panel.style.cssText = [
      'position:fixed',
      'bottom:16px',
      'left:16px',
      'z-index:99999',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'padding:8px 12px',
      'border-radius:12px',
      'font-family:ui-sans-serif,system-ui,sans-serif',
      'font-size:12px',
      'font-weight:500',
      'backdrop-filter:blur(12px)',
      'box-shadow:0 8px 24px rgba(0,0,0,0.12)',
      'border:1px solid rgba(255,255,255,0.15)',
      'background:rgba(15,23,42,0.9)',
      'color:#94a3b8',
      'transition:opacity .2s'
    ].join(';');

    // Status dot
    var dot = document.createElement('span');
    dot.style.cssText = [
      'width:8px',
      'height:8px',
      'border-radius:50%',
      'flex-shrink:0',
      'background:' + (isLoggedIn ? '#34d399' : '#f87171')
    ].join(';');
    panel.appendChild(dot);

    // Label
    var label = document.createElement('span');
    label.style.cssText = 'color:#e2e8f0;white-space:nowrap';
    if (isLoggedIn) {
      var user = auth.user || {};
      label.textContent = user.displayName || user.email || 'Authenticated';
    } else {
      label.textContent = 'Not authenticated';
    }
    panel.appendChild(label);

    // Separator
    var sep = document.createElement('span');
    sep.style.cssText = 'width:1px;height:16px;background:#334155;flex-shrink:0';
    panel.appendChild(sep);

    if (isLoggedIn) {
      // Sign Out button
      var btnOut = document.createElement('button');
      btnOut.textContent = 'Sign Out';
      btnOut.style.cssText = [
        'border:none',
        'background:#dc2626',
        'color:#fff',
        'padding:4px 12px',
        'border-radius:6px',
        'font-size:11px',
        'font-weight:600',
        'cursor:pointer',
        'transition:background .15s',
        'white-space:nowrap'
      ].join(';');
      btnOut.onmouseenter = function () { btnOut.style.background = '#b91c1c'; };
      btnOut.onmouseleave = function () { btnOut.style.background = '#dc2626'; };
      btnOut.onclick = function () { writeAuth(null); };
      panel.appendChild(btnOut);
    } else {
      // Sign In button
      var btnIn = document.createElement('button');
      btnIn.textContent = 'Dev Sign In';
      btnIn.style.cssText = [
        'border:none',
        'background:#3b82f6',
        'color:#fff',
        'padding:4px 12px',
        'border-radius:6px',
        'font-size:11px',
        'font-weight:600',
        'cursor:pointer',
        'transition:background .15s',
        'white-space:nowrap'
      ].join(';');
      btnIn.onmouseenter = function () { btnIn.style.background = '#2563eb'; };
      btnIn.onmouseleave = function () { btnIn.style.background = '#3b82f6'; };
      btnIn.onclick = function () {
        writeAuth({ tokens: MOCK_TOKENS, user: MOCK_USER });
      };
      panel.appendChild(btnIn);
    }

    // DEV badge
    var badge = document.createElement('span');
    badge.textContent = 'DEV';
    badge.style.cssText = [
      'padding:2px 6px',
      'border-radius:4px',
      'font-size:9px',
      'font-weight:700',
      'letter-spacing:0.08em',
      'background:rgba(251,191,36,0.15)',
      'color:#fbbf24',
      'line-height:1.4'
    ].join(';');
    panel.appendChild(badge);

    // Auth requirement indicator
    if (REQUIRE_AUTH) {
      var authBadge = document.createElement('span');
      authBadge.textContent = 'AUTH';
      authBadge.style.cssText = [
        'padding:2px 6px',
        'border-radius:4px',
        'font-size:9px',
        'font-weight:700',
        'letter-spacing:0.08em',
        'background:rgba(139,92,246,0.15)',
        'color:#a78bfa',
        'line-height:1.4'
      ].join(';');
      panel.appendChild(authBadge);
    }

    document.body.appendChild(panel);
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createPanel);
  } else {
    createPanel();
  }
})();

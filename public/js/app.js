// CSS animation injection
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(styleSheet);

document.addEventListener('DOMContentLoaded', () => {
  // --- State elements ---
  const stateRequest   = document.getElementById('state-request');
  const stateScanning  = document.getElementById('state-scanning');
  const stateDenied    = document.getElementById('state-denied');
  const statePassport  = document.getElementById('state-passport');

  // --- Passport display fields ---
  const valIp        = document.getElementById('val-ip');
  const valCoords    = document.getElementById('val-coords');
  const valAccuracy  = document.getElementById('val-accuracy');
  const valLocation  = document.getElementById('val-location');
  const valIsp       = document.getElementById('val-isp');
  const valTimezone  = document.getElementById('val-timezone');
  const valUa        = document.getElementById('val-ua');
  const statusBadge  = document.getElementById('passport-status-badge');

  // --- Buttons ---
  const btnAuthorize = document.getElementById('btn-authorize');
  const btnReScan    = document.getElementById('btn-re-scan');
  const btnRetry     = document.getElementById('btn-retry');

  let ipData = null;

  // ──────────────────────────────────────────────────────────────
  // Show a specific UI state
  // ──────────────────────────────────────────────────────────────
  function showState(id) {
    [stateRequest, stateScanning, stateDenied, statePassport].forEach(el => {
      if (el) el.classList.remove('active');
    });
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
  }

  // ──────────────────────────────────────────────────────────────
  // Fetch IP geolocation from ipapi.co
  // ──────────────────────────────────────────────────────────────
  async function fetchIpDetails() {
    if (ipData) return ipData;
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        ipData = await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch IP info:', e);
    }
    return ipData;
  }

  // ──────────────────────────────────────────────────────────────
  // Core scan – attempt high-accuracy geolocation first
  // ──────────────────────────────────────────────────────────────
  async function startScan() {
    showState('state-scanning');

    // Pre-fetch IP data in parallel while we wait for GPS
    const ipPromise = fetchIpDetails();

    if (!navigator.geolocation) {
      // Browser doesn't support geolocation at all
      await ipPromise;
      await completeScan(null, false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await ipPromise;
        const browserCoords = {
          latitude:  position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy:  position.coords.accuracy
        };
        await completeScan(browserCoords, true);
      },
      async (error) => {
        await ipPromise;
        console.warn('Geolocation error code:', error.code, error.message);

        if (error.code === error.PERMISSION_DENIED) {
          // Show the "how to fix" blocked-permission screen
          showState('state-denied');
        } else {
          // Timeout or position unavailable – fall back to IP
          await completeScan(null, false);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Populate passport UI and send data to server
  // ──────────────────────────────────────────────────────────────
  async function completeScan(browserCoords, hasPrecision) {
    const data = ipData;   // may be null on poor networks

    // ── POST to backend ──
    try {
      await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          browserCoords,
          ipInfo:           data,
          userAgent:        navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          language:         navigator.language || 'Unknown'
        })
      });
    } catch (e) {
      console.error('Error logging visit to server:', e);
    }

    // ── Populate fields ──
    valIp.textContent       = data?.ip || 'Undetected';
    valLocation.textContent = data ? `${data.city || 'Unknown'}, ${data.country_name || 'Unknown'}` : 'Unknown';
    valIsp.textContent      = data?.org || 'Unknown';
    valUa.textContent       = navigator.userAgent;

    // Timezone + local time
    const tz = data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const localTime = new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
      valTimezone.textContent = `${tz} (${localTime})`;
    } catch (_) {
      valTimezone.textContent = tz || 'Unknown';
    }

    // Coordinates + accuracy
    if (hasPrecision && browserCoords) {
      valCoords.textContent   = `${browserCoords.latitude.toFixed(6)}, ${browserCoords.longitude.toFixed(6)}`;
      valAccuracy.textContent = `High-Precision GPS (±${Math.round(browserCoords.accuracy)} m)`;

      statusBadge.textContent  = '✓ High-Precision GPS Scan Complete';
      statusBadge.style.background   = 'rgba(16,185,129,0.15)';
      statusBadge.style.color        = 'var(--accent)';
      statusBadge.style.borderColor  = 'rgba(16,185,129,0.3)';
    } else {
      // IP-based fallback coordinates
      if (data?.latitude && data?.longitude) {
        valCoords.textContent = `${parseFloat(data.latitude).toFixed(4)}, ${parseFloat(data.longitude).toFixed(4)}`;
      } else {
        valCoords.textContent = 'Unavailable';
      }
      valAccuracy.textContent = 'Approximate – IP / City Level Only';

      statusBadge.textContent  = '⚠ Approximate Scan (Location Denied)';
      statusBadge.style.background   = 'rgba(244,63,94,0.15)';
      statusBadge.style.color        = 'var(--danger)';
      statusBadge.style.borderColor  = 'rgba(244,63,94,0.3)';
    }

    showState('state-passport');
  }

  // ──────────────────────────────────────────────────────────────
  // Event listeners
  // ──────────────────────────────────────────────────────────────
  if (btnAuthorize) btnAuthorize.addEventListener('click', startScan);

  if (btnRetry) btnRetry.addEventListener('click', () => {
    // Can't programmatically reset browser permissions, but we can re-attempt
    // (useful if user just went to Settings and enabled it)
    startScan();
  });

  if (btnReScan) btnReScan.addEventListener('click', () => {
    showState('state-request');
  });

  // ──────────────────────────────────────────────────────────────
  // AUTO-REQUEST: Fire geolocation immediately on page load.
  // We show the "Scanning…" overlay right away so the browser
  // permission prompt appears with no extra click needed.
  // ──────────────────────────────────────────────────────────────
  startScan();
});

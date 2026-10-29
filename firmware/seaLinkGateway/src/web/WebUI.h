#pragma once
#include <Arduino.h>

const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>SeaLink Maritime Gateway</title>
<style>
:root {
  --bg: #090e17;
  --surface: #131c2e;
  --surface-2: #1b2840;
  --primary: #0ea5e9;
  --primary-dark: #0284c7;
  --teal: #14b8a6;
  --danger: #ef4444;
  --warning: #f59e0b;
  --success: #10b981;
  --text: #f1f5f9;
  --text-muted: #94a3b8;
  --border: #233554;
}
* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
body { background: var(--bg); color: var(--text); padding-bottom: 20px; }
header { background: var(--surface); padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
.logo-box { display: flex; align-items: center; gap: 8px; }
.logo-icon { font-size: 24px; }
.logo-title { font-size: 17px; font-weight: 700; color: #fff; letter-spacing: 0.5px; }
.vessel-badge { background: var(--teal); color: #042f2e; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 99px; text-transform: uppercase; }
.status-pill { font-size: 12px; padding: 4px 10px; border-radius: 99px; font-weight: 600; display: flex; align-items: center; gap: 5px; }
.pill-ok { background: rgba(16,185,129,0.15); color: var(--success); border: 1px solid rgba(16,185,129,0.3); }
.pill-err { background: rgba(239,68,68,0.15); color: var(--danger); border: 1px solid rgba(239,68,68,0.3); }

.container { max-width: 600px; margin: 0 auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }

/* Grid Cards */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
.card-header { font-size: 12px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
.card-value { font-size: 15px; font-weight: 600; color: #fff; }
.telemetry-sub { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

/* Hazard Badges */
.hazard-ok { color: var(--success); font-weight: 700; }
.hazard-alert { color: var(--danger); font-weight: 800; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0.5; } }

/* Chat Window */
.chat-card { display: flex; flex-direction: column; height: 380px; }
.chat-messages { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; background: rgba(9,14,23,0.5); border-radius: 8px; }
.msg { max-width: 82%; padding: 8px 12px; border-radius: 12px; font-size: 14px; line-height: 1.4; word-break: break-word; }
.msg-in { align-self: flex-start; background: var(--surface-2); border: 1px solid var(--border); border-bottom-left-radius: 2px; }
.msg-out { align-self: flex-end; background: #0369a1; color: #fff; border-bottom-right-radius: 2px; }
.msg-sos { align-self: stretch; max-width: 100%; background: rgba(239,68,68,0.2); border: 1px solid var(--danger); color: #fca5a5; font-weight: 600; }
.msg-meta { font-size: 10px; opacity: 0.75; margin-top: 4px; display: flex; justify-content: space-between; gap: 8px; }

/* Input Toolbar */
.input-toolbar { display: flex; gap: 8px; margin-top: 10px; }
.dest-select { background: var(--surface-2); color: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 8px; font-size: 12px; width: 90px; }
.msg-input { flex: 1; background: var(--surface-2); color: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: 14px; outline: none; }
.msg-input:focus { border-color: var(--primary); }
.btn-send { background: var(--primary-dark); color: #fff; border: none; border-radius: 8px; padding: 0 16px; font-weight: 700; cursor: pointer; }
.btn-send:active { transform: scale(0.96); }

/* SOS Button */
.sos-btn { background: linear-gradient(135deg, #dc2626, #b91c1c); color: #fff; border: none; border-radius: 12px; padding: 14px; font-size: 16px; font-weight: 800; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(220,38,38,0.4); }
.sos-btn:active { transform: scale(0.98); background: #991b1b; }

/* SOS Modal Banner */
#sos-banner { display: none; background: #dc2626; color: #fff; padding: 12px; border-radius: 10px; text-align: center; font-weight: 700; font-size: 14px; animation: pulse 1.2s infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
</style>
</head>
<body>

<header>
  <div class="logo-box">
    <span class="logo-icon">⚓</span>
    <div>
      <div class="logo-title">SeaLink Gateway</div>
      <div id="vessel-badge" class="vessel-badge">NODE: CONNECTING...</div>
    </div>
  </div>
  <div id="radio-pill" class="status-pill pill-ok">LoRa: Ready</div>
</header>

<div class="container">
  <!-- Emergency Banner -->
  <div id="sos-banner">🚨 INCOMING DISTRESS SIGNAL RECEIVED OVER 433 MHz MESH!</div>

  <!-- Hardware Telemetry Cards -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header">GPS Location <span id="gps-sats">0 Sats</span></div>
      <div id="gps-coords" class="card-value">Searching fix...</div>
      <div id="gps-speed" class="telemetry-sub">Speed: 0.0 km/h</div>
    </div>
    <div class="card">
      <div class="card-header">Hazard Sensors</div>
      <div id="gas-status" class="card-value hazard-ok">Gas: Normal</div>
      <div id="motion-tilt" class="telemetry-sub">Tilt: Pitch 0° | Roll 0°</div>
    </div>
  </div>

  <!-- Radio Stats -->
  <div class="card" style="padding: 8px 12px;">
    <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
      <span>TX Packets: <b id="tx-count" style="color:#fff;">0</b></span>
      <span>RX Packets: <b id="rx-count" style="color:#fff;">0</b></span>
      <span>Gateway IP: <b id="gw-ip" style="color:var(--primary);">...</b></span>
    </div>
  </div>

  <!-- Chat Room -->
  <div class="card chat-card">
    <div class="card-header">
      <span>LoRa Mesh Chat</span>
      <span style="font-size:10px; color:var(--teal);">● Live RF Polling</span>
    </div>
    <div id="chat-box" class="chat-messages">
      <div class="msg msg-in" style="font-size:12px; color:var(--text-muted); text-align:center; align-self:center;">
        Connected to SeaLink Gateway. Type a message or tap SOS below.
      </div>
    </div>
    <div class="input-toolbar">
      <select id="dest-id" class="dest-select">
        <option value="ALL">📢 ALL</option>
        <option value="BOAT-001">BOAT-001</option>
        <option value="BOAT-104">BOAT-104</option>
        <option value="BOAT-207">BOAT-207</option>
      </select>
      <input type="text" id="msg-input" class="msg-input" placeholder="Type maritime message..." onkeydown="if(event.key==='Enter')sendMessage()">
      <button class="btn-send" onclick="sendMessage()">Send</button>
    </div>
  </div>

  <!-- Big Red SOS Distress Button -->
  <button class="sos-btn" onclick="sendSos()">
    <span>🚨</span> BROADCAST SOS DISTRESS
  </button>
</div>

<script>
let thisBoatId = "UNKNOWN";
let lastCursor = 0;
let knownMessages = new Set();

async function pollStatus() {
  try {
    const res = await fetch('/api/v1/status');
    if (!res.ok) return;
    const data = await res.json();
    thisBoatId = data.boatId || "BOAT-???";
    document.getElementById('vessel-badge').innerText = 'NODE: ' + thisBoatId;
    document.getElementById('gw-ip').innerText = data.ipAddress || window.location.hostname;
    document.getElementById('tx-count').innerText = data.packetsTransmitted || 0;
    document.getElementById('rx-count').innerText = data.packetsReceived || 0;
    
    const rp = document.getElementById('radio-pill');
    if (data.loraStatus === 'ready') {
      rp.className = 'status-pill pill-ok';
      rp.innerText = 'LoRa 433MHz: OK';
    } else {
      rp.className = 'status-pill pill-err';
      rp.innerText = 'LoRa: Offline';
    }

    if (data.telemetry) updateTelemetryUI(data.telemetry);
  } catch(e) {}
}

async function pollTelemetry() {
  try {
    const res = await fetch('/api/v1/telemetry');
    if (!res.ok) return;
    const t = await res.json();
    updateTelemetryUI(t);
  } catch(e) {}
}

function updateTelemetryUI(t) {
  if (t.gps) {
    document.getElementById('gps-sats').innerText = (t.gps.satellites || 0) + ' Sats';
    if (t.gps.hasFix && t.gps.latitude) {
      document.getElementById('gps-coords').innerText = t.gps.latitude.toFixed(4) + ', ' + t.gps.longitude.toFixed(4);
      document.getElementById('gps-speed').innerText = 'Speed: ' + (t.gps.speedKmph || 0).toFixed(1) + ' km/h';
    } else {
      document.getElementById('gps-coords').innerText = 'Acquiring GPS fix...';
    }
  }
  if (t.gas) {
    const gs = document.getElementById('gas-status');
    if (t.gas.hazardDetected) {
      gs.className = 'card-value hazard-alert';
      gs.innerText = '⚠️ GAS HAZARD!';
    } else {
      gs.className = 'card-value hazard-ok';
      gs.innerText = 'Gas: Normal (Safe)';
    }
  }
  if (t.motion) {
    const mt = document.getElementById('motion-tilt');
    let text = 'Tilt: P ' + (t.motion.pitch || 0).toFixed(0) + '° | R ' + (t.motion.roll || 0).toFixed(0) + '°';
    if (t.motion.capsizingAlert) text += ' ⚠️ CAPSIZING!';
    mt.innerText = text;
  }
}

async function pollMessages() {
  try {
    const res = await fetch('/api/v1/messages?cursor=' + lastCursor);
    if (!res.ok) return;
    const data = await res.json();
    if (data.nextCursor) lastCursor = data.nextCursor;

    if (data.messages && data.messages.length > 0) {
      const box = document.getElementById('chat-box');
      for (const m of data.messages) {
        if (knownMessages.has(m.id)) continue;
        knownMessages.add(m.id);

        const el = document.createElement('div');
        const isOut = (m.sourceBoatId === thisBoatId && !m.isSos);
        const isSos = m.isSos;

        if (isSos) {
          el.className = 'msg msg-sos';
          document.getElementById('sos-banner').style.display = 'block';
          document.getElementById('sos-banner').innerText = '🚨 SOS FROM ' + m.sourceBoatId + ': ' + m.text;
        } else if (isOut) {
          el.className = 'msg msg-out';
        } else {
          el.className = 'msg msg-in';
        }

        let metaText = (isOut ? 'To: ' + m.destinationBoatId : 'From: ' + m.sourceBoatId);
        if (m.rssi) metaText += ' | ' + m.rssi + ' dBm';

        el.innerHTML = '<div>' + escapeHtml(m.text) + '</div>' +
                       '<div class="msg-meta"><span>' + metaText + '</span><span>' + formatTime(m.createdAt) + '</span></div>';
        box.appendChild(el);
      }
      box.scrollTop = box.scrollHeight;
    }
  } catch(e) {}
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;

  const dest = document.getElementById('dest-id').value;
  input.value = '';

  const payload = {
    id: 'msg_' + Date.now(),
    destinationBoatId: dest,
    senderUserId: 'CREW-01',
    recipientUserId: '*',
    senderName: thisBoatId,
    text: text
  };

  try {
    const res = await fetch('/api/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      pollMessages();
    }
  } catch(e) {
    alert('Failed to send message over gateway.');
  }
}

async function sendSos() {
  if (!confirm('🚨 BROADCAST SOS DISTRESS PACKET?\n\nThis will trigger an emergency alarm and flood the 433 MHz LoRa mesh.')) return;

  const payload = {
    id: 'sos_' + Date.now(),
    destinationBoatId: 'ALL',
    senderUserId: 'CREW-01',
    recipientUserId: '*',
    senderName: thisBoatId,
    text: '🚨 EMERGENCY DISTRESS CALL - IMMEDIATE ASSISTANCE REQUIRED',
    isSos: true,
    hopLimit: 7
  };

  try {
    await fetch('/api/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    alert('SOS Distress Broadcast transmitted over LoRa mesh.');
    pollMessages();
  } catch(e) {
    alert('SOS dispatch failed.');
  }
}

function escapeHtml(t) {
  return t.replace(/[&<>"']/g, function(m) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
}
function formatTime(ts) {
  if (!ts) return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  return new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

// Polling Timers
pollStatus();
pollTelemetry();
pollMessages();
setInterval(pollStatus, 3000);
setInterval(pollTelemetry, 2000);
setInterval(pollMessages, 1500);
</script>
</body>
</html>
)rawliteral";

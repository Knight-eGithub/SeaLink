# SeaLink Supabase Cloud Setup Guide

This guide walks you through setting up Supabase PostgreSQL to receive real-time maritime SOS distress alerts relayed by the SeaLink Shore Station (`SHORE-BASE`).

---

## 1. Quick SQL Table Setup

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **SQL Editor** on the left navigation bar.
3. Click **New Query**, paste the SQL script below, and click **Run**:

```sql
-- Create the sos_alerts table for SeaLink emergency alerts
create table if not exists public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  message_id text not null,
  source_boat_id text not null,
  category text not null default 'EMERGENCY_SOS',
  distress_text text not null,
  latitude double precision,
  longitude double precision,
  hop_count integer default 1,
  rssi integer,
  snr double precision,
  received_at timestamp with time zone default now()
);

-- Enable Row Level Security (RLS)
alter table public.sos_alerts enable row level security;

-- Policy 1: Allow Shore Station (using anon/publishable key) to insert alerts
create policy "Allow Shore Station to insert alerts"
on public.sos_alerts
for insert
to anon
with check (true);

-- Policy 2: Allow reading alerts (e.g. for Web Dashboard / Rescue Teams)
create policy "Allow reading alerts"
on public.sos_alerts
for select
to anon
using (true);
```

---

## 2. ESP32 Firmware Configuration

Open [`firmware/seaLinkGateway/src/config/CloudConfig.h`](../firmware/seaLinkGateway/src/config/CloudConfig.h) and paste your credentials:

```cpp
// 1. Shore Station Local Wi-Fi (Phone Hotspot or Port Wi-Fi with internet access)
#define SHORE_WIFI_SSID     "YOUR_PHONE_HOTSPOT_NAME"
#define SHORE_WIFI_PASSWORD "YOUR_HOTSPOT_PASSWORD"

// 2. Supabase Project Credentials (from your environment variables)
#define SUPABASE_URL        "https://uehoua..." // Your NEXT_PUBLIC_SUPABASE_URL
#define SUPABASE_ANON_KEY   "sb_publi..."       // Your NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
#define SUPABASE_TABLE      "sos_alerts"
```

---

## 3. How the Shore Station Syncs

When a vessel at sea triggers an SOS:
1. The SOS floods across the 433 MHz LoRa mesh network (`hopLimit = 7`).
2. The **Shore Station ESP32** receives the packet over LoRa.
3. The Shore Station issues an HTTPS `POST` directly to Supabase PostgREST:
   ```http
   POST https://<YOUR_PROJECT_ID>.supabase.co/rest/v1/sos_alerts
   Content-Type: application/json
   apikey: <YOUR_PUBLISHABLE_KEY>
   Authorization: Bearer <YOUR_PUBLISHABLE_KEY>
   Prefer: return=minimal

   {
     "message_id": "1730000000000",
     "source_boat_id": "BOAT-001",
     "category": "EMERGENCY_SOS",
     "distress_text": "MAYDAY! Vessel taking on water near reef",
     "latitude": 12.9141,
     "longitude": 74.8560,
     "hop_count": 2,
     "rssi": -78,
     "snr": 8.5
   }
   ```
4. Within milliseconds, the alert appears in your Supabase **Table Editor** under `sos_alerts`.

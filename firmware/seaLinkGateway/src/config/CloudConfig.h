#pragma once

/**
 * SeaLink Shore Station Cloud DB Configuration (Supabase)
 *
 * The Shore Station node connects to your local internet (Hotspot / Base Wi-Fi)
 * and dispatches all intercepted LoRa SOS distress alerts directly to your Supabase PostgreSQL DB.
 */

// Local Shore Base Wi-Fi with Internet Access (e.g. your phone hotspot or base router)
#define SHORE_WIFI_SSID     "Shore-Internet-AP"
#define SHORE_WIFI_PASSWORD "maritime123"

// Supabase Project Credentials (from your Supabase Dashboard -> Project Settings -> API)
#define SUPABASE_URL        "https://your-project-id.supabase.co"
#define SUPABASE_ANON_KEY   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here"
#define SUPABASE_TABLE      "sos_alerts"

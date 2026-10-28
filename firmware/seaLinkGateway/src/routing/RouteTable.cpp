#include "RouteTable.h"
#include <cstring>

RouteTable::RouteTable() : _seenHead(0) {
    for (int i = 0; i < MAX_ROUTES; i++) {
        _routes[i].isActive = false;
    }
    for (int i = 0; i < DEDUP_CACHE_SIZE; i++) {
        _seenIds[i][0] = '\0';
    }
}

void RouteTable::updateRoute(const char* dest, const char* nextHop, uint8_t hops, int16_t rssi) {
    if (!dest || !nextHop) return;

    for (int i = 0; i < MAX_ROUTES; i++) {
        if (_routes[i].isActive && strcmp(_routes[i].destinationBoatId, dest) == 0) {
            // Update if better or equal route
            if (hops <= _routes[i].hopCount || (millis() - _routes[i].lastSeen > 300000)) {
                strncpy(_routes[i].nextHopBoatId, nextHop, sizeof(_routes[i].nextHopBoatId));
                _routes[i].hopCount = hops;
                _routes[i].rssi = rssi;
                _routes[i].lastSeen = millis();
            }
            return;
        }
    }

    // Insert new route
    for (int i = 0; i < MAX_ROUTES; i++) {
        if (!_routes[i].isActive) {
            strncpy(_routes[i].destinationBoatId, dest, sizeof(_routes[i].destinationBoatId));
            strncpy(_routes[i].nextHopBoatId, nextHop, sizeof(_routes[i].nextHopBoatId));
            _routes[i].hopCount = hops;
            _routes[i].rssi = rssi;
            _routes[i].lastSeen = millis();
            _routes[i].isActive = true;
            return;
        }
    }
}

bool RouteTable::findRoute(const char* dest, RouteInfo& outRoute) {
    if (!dest) return false;
    for (int i = 0; i < MAX_ROUTES; i++) {
        if (_routes[i].isActive && strcmp(_routes[i].destinationBoatId, dest) == 0) {
            outRoute = _routes[i];
            return true;
        }
    }
    return false;
}

bool RouteTable::isDuplicate(const char* messageId) {
    if (!messageId || messageId[0] == '\0') return false;
    for (int i = 0; i < DEDUP_CACHE_SIZE; i++) {
        if (strcmp(_seenIds[i], messageId) == 0) {
            return true;
        }
    }
    return false;
}

void RouteTable::recordSeen(const char* messageId) {
    if (!messageId || messageId[0] == '\0') return;
    strncpy(_seenIds[_seenHead], messageId, sizeof(_seenIds[_seenHead]));
    _seenIds[_seenHead][sizeof(_seenIds[_seenHead]) - 1] = '\0';
    _seenHead = (_seenHead + 1) % DEDUP_CACHE_SIZE;
}

size_t RouteTable::getActiveRoutes(RouteInfo* outList, size_t maxCount) {
    size_t count = 0;
    for (int i = 0; i < MAX_ROUTES && count < maxCount; i++) {
        if (_routes[i].isActive) {
            outList[count++] = _routes[i];
        }
    }
    return count;
}

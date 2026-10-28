#pragma once
#include <Arduino.h>

#define MAX_ROUTES 24
#define DEDUP_CACHE_SIZE 64

struct RouteInfo {
    char destinationBoatId[16];
    char nextHopBoatId[16];
    uint8_t hopCount;
    int16_t rssi;
    uint32_t lastSeen;
    bool isActive;
};

class RouteTable {
public:
    RouteTable();
    void updateRoute(const char* dest, const char* nextHop, uint8_t hops, int16_t rssi);
    bool findRoute(const char* dest, RouteInfo& outRoute);
    bool isDuplicate(const char* messageId);
    void recordSeen(const char* messageId);
    size_t getActiveRoutes(RouteInfo* outList, size_t maxCount);

private:
    RouteInfo _routes[MAX_ROUTES];
    char _seenIds[DEDUP_CACHE_SIZE][36];
    uint8_t _seenHead;
};

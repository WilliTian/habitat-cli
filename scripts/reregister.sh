#!/usr/bin/env bash
set -euo pipefail

echo "Starting..."

habitat unregister || true
habitat register --name "Cygnus Seven"

habitat inventory add conductive-ore 18
habitat inventory add ferrite 90
habitat inventory add silicate-glass 45
habitat module set-status supply_cache_1 online
habitat construct small-solar-array
habitat construction status
habitat tick 10800
habitat construction status

echo "Complete"

#!/bin/sh
# BusyBox wget ignores no_proxy in this cloud environment.
# Only the exact container-local health probe bypasses the outbound proxy.
if [ "$*" = "-q --spider http://127.0.0.1:9999/health" ]; then
  exec /usr/bin/wget -Y off "$@"
fi
exec /usr/bin/wget "$@"

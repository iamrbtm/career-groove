#!/bin/sh
while [ ! -f /tmp/.cg-ready ]; do
    sleep 1
done
exec "$@"

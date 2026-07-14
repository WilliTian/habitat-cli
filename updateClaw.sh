#!/usr/bin/env bash

set -euo pipefail

cd ~/habitat-cli
git pull
bun install
systemctl --user restart habitat-api.service
systemctl --user --no-pager status habitat-api.service

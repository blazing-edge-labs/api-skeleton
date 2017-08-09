#!/usr/bin/env bash
set -e

buildpack-nodejs-build
buildpack-nodejs-run -e .env npm i

sudo systemctl restart tsn-api
sudo nginx -s reload

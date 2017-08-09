#!/usr/bin/env bash
set -e

buildpack-nodejs-build
buildpack-nodejs-run -e .env npm i --production=false
buildpack-nodejs-run -e .env npm run ci

sudo systemctl restart tsn-api
sudo nginx -s reload

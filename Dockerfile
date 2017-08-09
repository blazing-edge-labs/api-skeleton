FROM buildpack-nodejs:latest

RUN buildpack-nodejs-run npm run lint:check

CMD buildpack-nodejs-run node -r babel-register index.js

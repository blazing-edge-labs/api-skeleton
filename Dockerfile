FROM node:10

EXPOSE 80
ENV \
  PORT=80 \
  NODE_ENV=production

WORKDIR /node
COPY . /node
RUN yarn install

CMD yarn run start

HEALTHCHECK --timeout=3s CMD curl -f http://localhost:$PORT/health || exit 1

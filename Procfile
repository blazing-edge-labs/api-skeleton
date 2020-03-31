release: if [ "$HEROKU_DB_RECREATE" = true ]; then npm run-s db:recreate db:seed; else npm run migrate up; fi
web: NODE_PATH=. node index.js

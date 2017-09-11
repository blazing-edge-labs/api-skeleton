release: if [ "$HEROKU_DB_RECREATE" = true ]; then npm run-s db:recreate db:seed; else npm run migrate up; fi
web: node -r babel-register index.js

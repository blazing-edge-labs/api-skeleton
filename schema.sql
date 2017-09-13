DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE TABLE "user" (
  id SERIAL,
  email VARCHAR(254) NOT NULL,
  password CHAR(60) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (email)
);

CREATE TABLE password_token (
  user_id INTEGER NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  token CHAR(32) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id),
  UNIQUE (token)
);

CREATE TABLE user_role (
  user_id INTEGER NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  role SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id)
);

CREATE TABLE passwordless (
  token_remote UUID NOT NULL,
  token_direct UUID NOT NULL,
  user_id INTEGER NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (token_remote),
  UNIQUE (token_direct)
);

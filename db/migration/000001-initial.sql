-- +migrate Up
CREATE TABLE "user" (
  id SERIAL,
  email VARCHAR(254) NOT NULL,
  password CHAR(60),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (email)
);

CREATE TABLE password_token (
  user_id INTEGER NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  token UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id),
  UNIQUE (token)
);

CREATE TABLE user_role (
  user_id INTEGER NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  role SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id)
);

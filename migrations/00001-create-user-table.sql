-- +migrate Up
CREATE TABLE "user" (
  id SERIAL,
  email CHARACTER VARYING(254) NOT NULL,
  password CHARACTER VARYING(200) NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  first_name CHARACTER VARYING(50),
  last_name CHARACTER VARYING(50),
  bio TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (email)
);

-- +migrate Down
DROP TABLE "user";

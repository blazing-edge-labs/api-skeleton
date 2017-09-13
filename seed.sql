-- superadmin@example.com/superadmin
INSERT INTO
  "user" (email, password)
  VALUES ('superadmin@example.com', '$2a$12$71wzyR81R9wDBSchxS9t/.fMjrsIarJwdHnNZE4dVsPqMudRhfIHa');
INSERT INTO
  user_role (user_id, role)
  VALUES (currval('user_id_seq'), 20);

-- admin@example.com/admin
INSERT INTO
  "user" (email, password)
  VALUES ('admin@example.com', '$2a$12$z2WWkJZP/bcSrGljKRszRuHnfXEBX9KKzbz/RdFIK5g.XY8tLS4s2');
INSERT INTO
  user_role (user_id, role)
  VALUES (currval('user_id_seq'), 10);
INSERT INTO
  passwordless (token_remote, token_direct, user_id, created_at)
  VALUES
  ('11111111-0000-4000-8000-000000000000', '11111111-0000-4000-8000-000000000000', currval('user_id_seq'), now() - interval '1 year'),
  ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', currval('user_id_seq'), now()),
  ('11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', currval('user_id_seq'), now());

-- user1@example.com/user1
INSERT INTO
  "user" (email, password)
  VALUES ('user1@example.com', '$2a$08$UCLZSIyqpBGxOItMM5mSdOptI5BvfxMMp1bql93N6IQdMR5riRgWm');
INSERT INTO
  user_role (user_id, role)
  VALUES (currval('user_id_seq'), 0);

-- user2@example.com/user2
INSERT INTO
  "user" (email, password)
  VALUES ('user2@example.com', '$2a$08$xpRrAnWKV1W7kTXtUErzGOiFv7Mpvi59x30SCnM1rrQph1a05cuBC');
INSERT INTO
  user_role (user_id, role)
  VALUES (currval('user_id_seq'), 0);

-- user3@example.com/user3
INSERT INTO
  "user" (email, password)
  VALUES ('user3@example.com', '$2a$08$fsjARzE2Mb.5pL2K4P97TufUyjazZvJ0HI3V0gF1GCjRx0WdhMlaW');
INSERT INTO
  user_role (user_id, role)
  VALUES (currval('user_id_seq'), 0);

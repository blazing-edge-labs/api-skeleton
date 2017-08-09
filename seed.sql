-- superadmin@mail.com/superadmin
INSERT INTO
  "user" (email, password)
  VALUES ('superadmin@mail.com', '$2a$12$71wzyR81R9wDBSchxS9t/.fMjrsIarJwdHnNZE4dVsPqMudRhfIHa');
INSERT INTO
  user_role (user_id, role)
  VALUES (currval('user_id_seq'), 20);
INSERT INTO
  user_info (user_id, name, zip, phone, photo_permission, birthdate)
  VALUES (currval('user_id_seq'), 'Superadmin User', '12348', '88888888888', true, '1988-08-08');

-- admin@mail.com/admin
INSERT INTO
  "user" (email, password)
  VALUES ('admin@mail.com', '$2a$12$z2WWkJZP/bcSrGljKRszRuHnfXEBX9KKzbz/RdFIK5g.XY8tLS4s2');
INSERT INTO
  user_role (user_id, role)
  VALUES (currval('user_id_seq'), 10);
INSERT INTO
  user_info (user_id, name, zip, phone, photo_permission, birthdate)
  VALUES (currval('user_id_seq'), 'Admin User', '12349', '99999999999', true, '1989-08-08');

-- user1@mail.com/user1
INSERT INTO
  "user" (email, password)
  VALUES ('user1@mail.com', '$2a$08$UCLZSIyqpBGxOItMM5mSdOptI5BvfxMMp1bql93N6IQdMR5riRgWm');
INSERT INTO
  user_role (user_id, role)
  VALUES (currval('user_id_seq'), 0);
INSERT INTO
  user_info (user_id, name, zip, phone, photo_permission, birthdate)
  VALUES (currval('user_id_seq'), 'User Un', '12341', '11111111111', true, '1991-01-01');

-- user2@mail.com/user2
INSERT INTO
  "user" (email, password)
  VALUES ('user2@mail.com', '$2a$08$xpRrAnWKV1W7kTXtUErzGOiFv7Mpvi59x30SCnM1rrQph1a05cuBC');
INSERT INTO
  user_role (user_id, role)
  VALUES (currval('user_id_seq'), 0);
INSERT INTO
  user_info (user_id, name, zip, phone, photo_permission, birthdate)
  VALUES (currval('user_id_seq'), 'User Dos', '12342', '22222222222', true, '1992-02-02');

-- user3@mail.com/user3
INSERT INTO
  "user" (email, password)
  VALUES ('user3@mail.com', '$2a$08$fsjARzE2Mb.5pL2K4P97TufUyjazZvJ0HI3V0gF1GCjRx0WdhMlaW');
INSERT INTO
  user_role (user_id, role)
  VALUES (currval('user_id_seq'), 0);
INSERT INTO
  user_info (user_id, name, zip, phone, photo_permission, birthdate)
  VALUES (currval('user_id_seq'), 'User Tres', '12343', '33333333333', true, '1993-03-03');

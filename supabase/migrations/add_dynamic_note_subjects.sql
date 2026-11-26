-- Leave note subjects empty unless the user chooses or enters a subject.
ALTER TABLE notes
  ALTER COLUMN subject SET DEFAULT '';

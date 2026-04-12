SET search_path TO workspace_2etqbx303w933t2ii8cuwc4kt;

-- 1. MIGRATION DES DONNÉES EXISTANTES
UPDATE "company"
SET "numsociete" = CAST(NULLIF(REGEXP_REPLACE("numeroSociete", '\D', '', 'g'), '') AS INTEGER)
WHERE "numeroSociete" IS NOT NULL AND "numeroSociete" != '';

-- 2. AUTO-INCRÉMENT
DO $$
DECLARE
    max_num INTEGER;
BEGIN
    SELECT COALESCE(MAX("numsociete"), 100000) INTO max_num FROM "company";
    EXECUTE 'CREATE SEQUENCE IF NOT EXISTS company_numsociete_seq START WITH ' || (max_num + 1);
    EXECUTE 'SELECT setval(''company_numsociete_seq'', ' || max_num || ')';
END $$;

CREATE OR REPLACE FUNCTION set_company_numsociete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."numsociete" IS NULL THEN
        NEW."numsociete" := nextval('company_numsociete_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_company_numsociete ON "company";

CREATE TRIGGER trg_set_company_numsociete
BEFORE INSERT ON "company"
FOR EACH ROW
EXECUTE FUNCTION set_company_numsociete();

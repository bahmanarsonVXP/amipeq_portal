SET search_path TO workspace_2etqbx303w933t2ii8cuwc4kt;

-- 1. DROP old trigger and function
DROP TRIGGER IF EXISTS trg_set_company_numsociete ON "company";
DROP FUNCTION IF EXISTS set_company_numsociete();

-- 2. Rename column to match metadata exactly
ALTER TABLE "company" RENAME COLUMN "numsociete" TO "ndegsociete";

-- 3. Recreate function with new column name
CREATE OR REPLACE FUNCTION set_company_ndegsociete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."ndegsociete" IS NULL THEN
        NEW."ndegsociete" := nextval('company_numsociete_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Recreate trigger
CREATE TRIGGER trg_set_company_ndegsociete
BEFORE INSERT ON "company"
FOR EACH ROW
EXECUTE FUNCTION set_company_ndegsociete();

-- Phase 1 · Catalog: full-text + fuzzy search for Product.
-- Strategy (1a): 'simple' (NO language stemming) + unaccent for FTS; pg_trgm for fuzzy.
-- HAND-WRITTEN: Prisma cannot express generated tsvector columns, custom text-search
-- configs, or functional GIN indexes. The scaffolded plain `ADD COLUMN search_tsv tsvector`
-- was replaced by the GENERATED column below.

-- 1) Extension. pg_trgm was created in init; unaccent lives in public, same as pg_trgm.
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 2) VN-friendly config: COPY simple (English stemming would corrupt VN), then fold
--    accents through the unaccent dictionary. NOT 'english'.
CREATE TEXT SEARCH CONFIGURATION product.gub_vn ( COPY = pg_catalog.simple );

ALTER TEXT SEARCH CONFIGURATION product.gub_vn
  ALTER MAPPING FOR
    asciiword, asciihword, hword_asciipart,
    word, hword, hword_part,          -- VN accented chars tokenize as `word`/`hword`
    numword, numhword, hword_numpart
  WITH public.unaccent, pg_catalog.simple;

-- 3) IMMUTABLE unaccent wrapper — ONLY for the pg_trgm functional indexes below.
--    Raw unaccent() is STABLE → illegal in index expressions; the explicit dictionary
--    arg makes it deterministic enough to assert IMMUTABLE.
CREATE OR REPLACE FUNCTION product.f_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, $1);
$$;

-- 4) Generated tsvector. Calls ONLY to_tsvector(regconfig, text) [IMMUTABLE]; unaccent
--    happens inside gub_vn's dictionary → no STABLE call in the expression → GENERATED
--    column is legal with NO trigger. Weighted: name=A, brand=B, description=C.
ALTER TABLE product."Product"
  ADD COLUMN "search_tsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('product.gub_vn',
      coalesce("nameVi", '') || ' ' || coalesce("nameEn", '')), 'A')
    ||
    setweight(to_tsvector('product.gub_vn',
      coalesce("brand", '')), 'B')
    ||
    setweight(to_tsvector('product.gub_vn',
      coalesce("descriptionVi", '') || ' ' || coalesce("descriptionEn", '')), 'C')
  ) STORED;

-- 5) GIN index on the tsvector (FTS).
CREATE INDEX "Product_search_tsv_idx"
  ON product."Product" USING gin ("search_tsv");

-- ... GIN trgm indexes on ACCENT-FOLDED names (typo + accent tolerance, consistent with
--     the unaccented query side).
CREATE INDEX "Product_nameVi_trgm_idx"
  ON product."Product" USING gin (product.f_unaccent("nameVi") gin_trgm_ops);
CREATE INDEX "Product_nameEn_trgm_idx"
  ON product."Product" USING gin (product.f_unaccent("nameEn") gin_trgm_ops);

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE "Product", "ProductVariant", "PersonalizationField", "PersonalizationOption", "ProductCategory", "Category" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  generic_id text;
BEGIN
  SELECT "id" INTO generic_id
  FROM "Product"
  WHERE "slug" = 'cartel-generico' AND "type" = 'GENERIC' AND "category" = 'CARTEL';

  -- En instalaciones nuevas el catálogo de referencia ya nace con esta jerarquía.
  IF generic_id IS NULL THEN RETURN; END IF;

  INSERT INTO "application_metadata" ("key", "value", "updatedAt")
  VALUES (
    'catalog:hierarchy:v2',
    jsonb_build_object(
      'genericProductId', generic_id,
      'disabledVariants', COALESCE((
        SELECT jsonb_agg(to_jsonb(v) ORDER BY v."position")
        FROM "ProductVariant" v
        WHERE v."productId" = generic_id AND v."photoCount" = 3 AND v."active"
      ), '[]'::jsonb),
      'removedFields', COALESCE((
        SELECT jsonb_agg(to_jsonb(f) ORDER BY f."position")
        FROM "PersonalizationField" f
        WHERE f."productId" = generic_id AND f."key" IN ('carrera', 'imagenes')
      ), '[]'::jsonb)
    )::text,
    now()
  )
  ON CONFLICT ("key") DO NOTHING;

  UPDATE "ProductVariant"
  SET "active" = false
  WHERE "productId" = generic_id AND "photoCount" = 3 AND "active";

  DELETE FROM "PersonalizationField"
  WHERE "productId" = generic_id AND "key" IN ('carrera', 'imagenes');

  DELETE FROM "ProductCategory" pc
  USING "Category" c
  WHERE pc."productId" = generic_id
    AND pc."categoryId" = c."id"
    AND c."isOccasion" = true;

  UPDATE "Product" SET "updatedAt" = now() WHERE "id" = generic_id;
END;
$$;

COMMIT;

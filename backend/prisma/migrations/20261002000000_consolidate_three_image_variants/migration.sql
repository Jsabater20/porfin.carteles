BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE "Product", "ProductVariant", "PersonalizationField", "PersonalizationOption", "ProductCategory", "ProductCareer", "ComboComponent", "ProductImage", "FeaturedProduct" IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  old_id text; generic_id text; predefined_id text; target_id text; field_key text;
BEGIN
  SELECT "id" INTO old_id FROM "Product" WHERE "slug" = 'cartel-tres-imagenes';
  -- Fresh installations import the already consolidated reference catalog.
  IF old_id IS NULL THEN RETURN; END IF;
  SELECT "id" INTO generic_id FROM "Product" WHERE "slug" = 'cartel-generico' AND "type" = 'GENERIC' AND "category" = 'CARTEL';
  SELECT "id" INTO predefined_id FROM "Product" WHERE "slug" = 'cartel-predeterminado' AND "type" = 'PREDEFINED' AND "category" = 'CARTEL';
  IF generic_id IS NULL OR predefined_id IS NULL THEN RAISE EXCEPTION 'Consolidation requires both destination products.'; END IF;
  IF EXISTS (SELECT 1 FROM "Product" WHERE "id" IN (old_id,generic_id,predefined_id) AND "status" <> 'PUBLISHED') THEN RAISE EXCEPTION 'Product availability changed; review consolidation.'; END IF;
  IF (SELECT count(*) FROM "ProductVariant" WHERE "productId"=old_id) <> 4 OR
    EXISTS (SELECT 1 FROM "ProductVariant" WHERE "productId"=old_id AND ("key" NOT IN ('generico-rectangular','generico-circular','predeterminado-rectangular','predeterminado-circular') OR "photoCount"<>3 OR NOT "active")) THEN
    RAISE EXCEPTION 'Source variants differ from reviewed inventory.';
  END IF;
  IF EXISTS (SELECT 1 FROM "ProductVariant" WHERE "productId" IN (generic_id,predefined_id) AND "key" IN ('generico-rectangular','generico-circular','predeterminado-rectangular','predeterminado-circular')) THEN RAISE EXCEPTION 'Destination variant key collision.'; END IF;
  IF EXISTS (SELECT 1 FROM "ComboComponent" WHERE "referenceProductId"=old_id OR "comboId"=old_id) OR EXISTS (SELECT 1 FROM "ProductImage" WHERE "productId"=old_id) OR EXISTS (SELECT 1 FROM "FeaturedProduct" WHERE "productId"=old_id) THEN RAISE EXCEPTION 'Source gained image, combo or featured references; explicit review required.'; END IF;
  IF EXISTS (SELECT 1 FROM "ProductCategory" s WHERE s."productId"=old_id AND (NOT EXISTS (SELECT 1 FROM "ProductCategory" d WHERE d."productId"=generic_id AND d."categoryId"=s."categoryId") OR NOT EXISTS (SELECT 1 FROM "ProductCategory" d WHERE d."productId"=predefined_id AND d."categoryId"=s."categoryId"))) OR EXISTS (SELECT 1 FROM "ProductCareer" WHERE "productId"=old_id) THEN RAISE EXCEPTION 'Source taxonomy needs explicit reconciliation.'; END IF;
  IF (SELECT count(*) FROM "PersonalizationField" WHERE "productId"=old_id AND "key" IN ('imagenes','carrera') AND NOT "required" AND "type" IN ('LONG_TEXT','SHORT_TEXT')) <> 2 THEN RAISE EXCEPTION 'Source personalization changed.'; END IF;
  IF EXISTS (SELECT 1 FROM "PersonalizationField" WHERE ("productId"=generic_id AND "key" IN ('imagenes','carrera')) OR ("productId"=predefined_id AND "key"='imagenes')) THEN RAISE EXCEPTION 'Destination personalization collision.'; END IF;
  IF (SELECT count(*) FROM "PersonalizationField" WHERE "productId"=old_id) <> 5 OR EXISTS (
    SELECT 1 FROM "PersonalizationField" f WHERE f."productId"=old_id AND (
      f."key" NOT IN ('texto','color-fondo','color-texto','carrera','imagenes') OR f."componentKey" IS NOT NULL OR
      f."type" <> CASE WHEN f."key"='imagenes' THEN 'LONG_TEXT'::"PersonalizationType" ELSE 'SHORT_TEXT'::"PersonalizationType" END OR
      EXISTS (SELECT 1 FROM "PersonalizationOption" o WHERE o."fieldId"=f."id")
    )
  ) THEN RAISE EXCEPTION 'Source fields need explicit reconciliation.'; END IF;
  IF EXISTS (
    SELECT 1 FROM "PersonalizationField" s CROSS JOIN unnest(ARRAY[generic_id,predefined_id]) AS target(id)
    WHERE s."productId"=old_id AND s."key" IN ('texto','color-fondo','color-texto') AND NOT EXISTS (
      SELECT 1 FROM "PersonalizationField" d WHERE d."productId"=target.id AND d."key"=s."key"
      AND ROW(d."type",d."required",d."minLength",d."maxLength",d."minValue",d."maxValue") IS NOT DISTINCT FROM
          ROW(s."type",s."required",s."minLength",s."maxLength",s."minValue",s."maxValue")
    )
  ) THEN RAISE EXCEPTION 'Shared personalization rules changed.'; END IF;
  INSERT INTO "application_metadata" ("key","value","updatedAt")
  SELECT 'catalog:three-images:v1', jsonb_build_object(
    'sourceId',old_id,'source',to_jsonb(p),
    'variants',(SELECT jsonb_agg(to_jsonb(v) ORDER BY v."position") FROM "ProductVariant" v WHERE v."productId"=old_id),
    'destinations',(SELECT jsonb_agg(jsonb_build_object('id',d."id",'slug',d."slug",'name',d."name") ORDER BY d."slug") FROM "Product" d WHERE d."id" IN (generic_id,predefined_id))
  )::text,now() FROM "Product" p WHERE p."id"=old_id;
  FOREACH target_id IN ARRAY ARRAY[generic_id,predefined_id] LOOP
    FOR field_key IN SELECT unnest(CASE WHEN target_id=generic_id THEN ARRAY['carrera','imagenes'] ELSE ARRAY['imagenes'] END) LOOP
      INSERT INTO "PersonalizationField" ("id","productId","key","label","type","required","position","componentKey","minLength","maxLength","minValue","maxValue")
      SELECT 'c'||substr(md5(target_id||':three-images:'||f."key"),1,24),target_id,f."key",
        CASE WHEN f."key"='imagenes' THEN 'Indicaciones para las imágenes (opción con 3 imágenes)' ELSE 'Temática (opcional)' END,
        f."type",false,(SELECT COALESCE(max("position"),-1)+1 FROM "PersonalizationField" WHERE "productId"=target_id),f."componentKey",f."minLength",f."maxLength",f."minValue",f."maxValue"
      FROM "PersonalizationField" f WHERE f."productId"=old_id AND f."key"=field_key;
    END LOOP;
    UPDATE "ProductVariant" v SET "productId"=target_id,"name"=v."name"||' · con 3 imágenes',
      "position"=(SELECT COALESCE(max(d."position"),-1)+1 FROM "ProductVariant" d WHERE d."productId"=target_id) + CASE WHEN v."key" LIKE '%circular' THEN 1 ELSE 0 END
    WHERE v."productId"=old_id AND v."key" LIKE CASE WHEN target_id=generic_id THEN 'generico-%' ELSE 'predeterminado-%' END;
  END LOOP;
  UPDATE "Product" SET "status"='HIDDEN',"updatedAt"=now() WHERE "id"=old_id;
  UPDATE "Product" SET "updatedAt"=now() WHERE "id" IN (generic_id,predefined_id);
END;
$$;
COMMIT;

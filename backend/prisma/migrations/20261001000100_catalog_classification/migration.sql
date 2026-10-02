BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE "Product", "Category", "ProductCategory" IN SHARE ROW EXCLUSIVE MODE;

-- Require one unambiguous legacy family per existing product.
DO $$
BEGIN
    IF EXISTS (
        SELECT p."id"
        FROM "Product" p
        LEFT JOIN "ProductCategory" pc ON pc."productId" = p."id"
        LEFT JOIN "Category" c ON c."id" = pc."categoryId"
            AND c."slug" IN ('carteles', 'props', 'combos')
        GROUP BY p."id"
        HAVING COUNT(c."id") <> 1
    ) THEN
        RAISE EXCEPTION 'Catalog classification aborted: missing or ambiguous legacy family.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM "Product" p
        JOIN "ProductCategory" pc ON pc."productId" = p."id"
        JOIN "Category" c ON c."id" = pc."categoryId"
        WHERE (c."slug" = 'carteles' AND p."type"::text NOT IN ('GENERIC', 'PREDEFINED', 'CUSTOM'))
           OR (c."slug" = 'props' AND p."type"::text <> 'CUSTOM')
           OR (c."slug" = 'combos' AND p."type"::text <> 'COMBO')
    ) THEN
        RAISE EXCEPTION 'Catalog classification aborted: legacy family and technical type disagree.';
    END IF;
END;
$$;

CREATE TYPE "ProductKind" AS ENUM ('CARTEL', 'PROP', 'COMBO');
-- Nullable without default while legacy writes are still supported.
ALTER TABLE "Product" ADD COLUMN "category" "ProductKind";
ALTER TABLE "Category" ADD COLUMN "isOccasion" BOOLEAN NOT NULL DEFAULT true;
UPDATE "Category" SET "isOccasion" = false WHERE "slug" IN ('carteles', 'props', 'combos');
UPDATE "Product" p
SET "category" = CASE c."slug"
    WHEN 'carteles' THEN 'CARTEL'::"ProductKind"
    WHEN 'props' THEN 'PROP'::"ProductKind"
    WHEN 'combos' THEN 'COMBO'::"ProductKind"
END
FROM "ProductCategory" pc
JOIN "Category" c ON c."id" = pc."categoryId"
WHERE pc."productId" = p."id" AND c."slug" IN ('carteles', 'props', 'combos');
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Product" WHERE "category" IS NULL) THEN
        RAISE EXCEPTION 'Catalog classification incomplete: products without category.';
    END IF;
END;
$$;
COMMIT;

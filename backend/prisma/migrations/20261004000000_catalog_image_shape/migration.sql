CREATE TYPE "CatalogShape" AS ENUM ('RECTANGULAR', 'CIRCULAR', 'XXL');

ALTER TABLE "ProductImage" ADD COLUMN "shape" "CatalogShape";

UPDATE "ProductImage" AS image
SET "shape" = CASE
  WHEN product."slug" IN (
    'cartel-generico-beige',
    'cartel-generico-flores-celestes',
    'cartel-generico-flores-rosadas',
    'cartel-generico-flores-verdes',
    'cartel-generico-flores-verde-musgo',
    'cartel-predeterminado-abogacia-circular',
    'cartel-predeterminado-arquitectura-1',
    'cartel-predeterminado-arquitectura-2',
    'cartel-predeterminado-contadora',
    'cartel-predeterminado-diseno-interiores',
    'cartel-predeterminado-farmacia-2'
  ) THEN 'CIRCULAR'::"CatalogShape"
  WHEN product."slug" IN (
    'cartel-generico-escudo',
    'cartel-generico-futbol',
    'cartel-generico-rectangular-celeste',
    'cartel-generico-rectangular-lila',
    'cartel-generico-rectangular-nude',
    'cartel-generico-rectangular-rosa',
    'cartel-generico-study',
    'cartel-predeterminado-abogacia-clasico',
    'cartel-predeterminado-abogacia-lila',
    'cartel-predeterminado-biodiversidad',
    'cartel-predeterminado-bioquimica',
    'cartel-predeterminado-bioquimica-masculino',
    'cartel-predeterminado-contador',
    'cartel-predeterminado-farmacia-1',
    'cartel-predeterminado-lic-administracion-celeste',
    'cartel-predeterminado-lic-administracion-rosa',
    'cartel-predeterminado-medicina-femenino',
    'cartel-predeterminado-medicina-masculino',
    'cartel-predeterminado-psicologia',
    'cartel-predeterminado-relaciones-internacionales'
  ) THEN 'RECTANGULAR'::"CatalogShape"
  ELSE image."shape"
END
FROM "Product" AS product
WHERE image."productId" = product."id";

CREATE INDEX "ProductImage_productId_shape_position_idx"
ON "ProductImage"("productId", "shape", "position");

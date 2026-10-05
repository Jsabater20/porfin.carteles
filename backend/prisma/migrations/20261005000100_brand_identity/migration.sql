ALTER TABLE "StoreSettings"
  ALTER COLUMN "storeName" SET DEFAULT 'Por fin Carteles';

UPDATE "StoreSettings"
SET "storeName" = 'Por fin Carteles'
WHERE BTRIM("storeName") IN ('Por fin!', 'Por fin', 'Porfin Carteles');

UPDATE "ContentPage"
SET "title" = 'Por fin Carteles'
WHERE BTRIM("title") IN ('Por fin!', 'Por fin', 'Porfin Carteles');

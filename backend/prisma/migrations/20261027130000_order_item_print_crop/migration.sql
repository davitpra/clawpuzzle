-- Encuadre del Print Studio por línea de pedido ({ x, y, zoom }).
ALTER TABLE "order_items" ADD COLUMN "print_crop" JSONB;

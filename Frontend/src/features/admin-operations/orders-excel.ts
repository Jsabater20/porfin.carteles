import type { AdminOrder } from '@/lib/contracts/admin-operations';

const HEADERS = ['Fecha de entrega', 'Referencia', 'Estado', 'Cliente', 'Teléfono', 'Mail', 'Modalidad', 'Productos', 'Observaciones', 'Subtotal conocido', 'Productos a cotizar', 'Origen', 'Fecha de registro'];
const STATUS: Record<string, string> = { PENDING_CONFIRMATION: 'Por confirmar', CONFIRMED: 'Confirmado', IN_PRODUCTION: 'En producción', READY: 'Listo', DELIVERED: 'Entregado', CANCELLED: 'Cancelado' };
const DELIVERY: Record<string, string> = { TO_CONFIRM: 'A coordinar', PICKUP: 'A coordinar en Santa Fe Capital', SHIPPING: 'Envío por correo' };

type Workbook = import('exceljs').Workbook;
type Worksheet = import('exceljs').Worksheet;
type FileHandle = { getFile(): Promise<File>; createWritable(): Promise<{ write(data: BlobPart): Promise<void>; close(): Promise<void> }> };
type PickerWindow = Window & { showOpenFilePicker?: (options: unknown) => Promise<FileHandle[]> };

const safe = (value: string | null | undefined) => {
  const text = value ?? '';
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

function configureSheet(sheet: Worksheet) {
  if (sheet.rowCount === 0) sheet.addRow(HEADERS);
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FF1E314A' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0B8C5' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'M1' };
  const widths = [17, 38, 18, 28, 18, 30, 30, 60, 45, 20, 21, 16, 22];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
}

function ordersSheet(workbook: Workbook) {
  const preferred = workbook.getWorksheet('Pedidos');
  if (!preferred || preferred.rowCount === 0 || String(preferred.getCell('B1').value ?? '') === 'Referencia') return preferred ?? workbook.addWorksheet('Pedidos');
  let name = 'Pedidos Por fin Carteles', suffix = 2;
  while (workbook.getWorksheet(name)) name = `Pedidos Por fin Carteles ${suffix++}`;
  return workbook.addWorksheet(name);
}

function appendRows(sheet: Worksheet, orders: AdminOrder[]) {
  configureSheet(sheet);
  const existing = new Set<string>();
  sheet.getColumn(2).eachCell((cell, row) => { if (row > 1) existing.add(String(cell.value ?? '')); });
  let added = 0;
  for (const order of orders) {
    if (existing.has(order.reference)) continue;
    const products = order.items.map(item => `${item.quantity} × ${item.productName}${item.variantSnapshot?.name ? ` · ${item.variantSnapshot.name}` : ''}`).join('\n');
    sheet.addRow([
      order.scheduledDate.slice(0, 10), safe(order.reference), STATUS[order.status] ?? order.status,
      safe(order.customerName), safe(order.customerPhone), safe(order.customerEmail), DELIVERY[order.deliveryMethod] ?? order.deliveryMethod,
      safe(products), safe(order.notes), order.knownSubtotalCents / 100, order.pendingQuoteCount,
      order.source === 'MANUAL' ? 'Carga manual' : 'Tienda online', new Date(order.createdAt),
    ]);
    existing.add(order.reference); added++;
  }
  sheet.getColumn(10).numFmt = '$ #,##0.00';
  sheet.getColumn(13).numFmt = 'dd/mm/yyyy hh:mm';
  sheet.eachRow({ includeEmpty: false }, row => { row.alignment = { vertical: 'top', wrapText: true }; });
  return added;
}

async function excel() {
  const excelModule = await import('exceljs');
  return excelModule.default;
}

async function bytes(workbook: Workbook): Promise<ArrayBuffer> {
  const output = await workbook.xlsx.writeBuffer();
  const source = new Uint8Array(output as ArrayBufferLike);
  const copy = new ArrayBuffer(source.byteLength);
  new Uint8Array(copy).set(source);
  return copy;
}

function download(data: ArrayBuffer, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function createOrdersExcel(orders: AdminOrder[]) {
  const ExcelJS = await excel(), workbook = new ExcelJS.Workbook();
  appendRows(ordersSheet(workbook), orders);
  download(await bytes(workbook), `pedidos-${new Date().toISOString().slice(0, 10)}.xlsx`);
  return orders.length;
}

export async function appendOrdersToChosenExcel(loadOrders: () => Promise<AdminOrder[]>) {
  const picker = (window as PickerWindow).showOpenFilePicker;
  if (!picker) return null;
  let handle: FileHandle;
  try { [handle] = await picker({ multiple: false, types: [{ description: 'Libro de Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] }); }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return -1; throw error; }
  const orders = await loadOrders(), file = await handle.getFile(), ExcelJS = await excel(), workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const added = appendRows(ordersSheet(workbook), orders);
  const writable = await handle.createWritable(); await writable.write(await bytes(workbook)); await writable.close();
  return added;
}

export async function appendOrdersToUploadedExcel(file: File, orders: AdminOrder[]) {
  const ExcelJS = await excel(), workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const added = appendRows(ordersSheet(workbook), orders);
  download(await bytes(workbook), file.name.replace(/\.xlsx$/i, '') + '-actualizado.xlsx');
  return added;
}

const response = (body: unknown, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'private, no-store'}});
export async function GET() {
  // Owner-private Sites dispatch authenticates browser visitors and service access.
  // No per-visitor records or connected-app credentials are used here.
  try {
    const upstream = await fetch('https://laboratorio-davolio.roberto81.chatgpt.site/api/orders', {cache:'no-store', redirect:'manual', signal:AbortSignal.timeout(15000)});
    if (!upstream.ok) return response({error:'Laboratorio non raggiungibile.',sourceStatus:upstream.status},502);
    const data = await upstream.json();
    if (!Array.isArray(data) || data.length > 20000 || data.some(o => !o || typeof o.status !== 'string' || !Number.isFinite(o.order_number))) throw new Error('Invalid source');
    const orders = data.filter(o => o.status === 'completed').map(o => ({number:o.order_number,customer:String(o.customer_name || 'Cliente non indicato'),category:String(o.category || ''),reference:String(o.management_reference || ''),completedAt:o.completed_at || null,description:String(o.description || ''),material:String(o.material || '')})).sort((a,b)=>String(b.completedAt||'').localeCompare(String(a.completedAt||'')) || b.number-a.number);
    return response({checkedAt:new Date().toISOString(),orders});
  } catch (error) { return response({error:'Laboratorio non raggiungibile. I dati precedenti, se presenti, non sono aggiornati.'},502); }
}

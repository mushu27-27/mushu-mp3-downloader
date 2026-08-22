const form = document.querySelector('#youtube-form');
const youtubeInput = document.querySelector('#youtube-input');
const error = document.querySelector('#input-error');
const queue = JSON.parse(localStorage.getItem('signal-converter-queue') || '[]').map(item => typeof item === 'string' ? { url: item, status: 'Pendiente' } : item);
const queueElement = document.querySelector('#queue');
function renderQueue() { document.querySelector('#queue-count').textContent = `${queue.length} enlace${queue.length === 1 ? '' : 's'}`; document.querySelector('#empty-state')?.remove(); queueElement.innerHTML = queue.length ? queue.map((item, index) => `<div class="queue-item"><span class="queue-number">${String(index + 1).padStart(2, '0')}</span><span class="queue-url" title="${item.url}">${item.url}</span><span class="queue-status">${item.status || 'Pendiente'}</span><button class="queue-action download" data-index="${index}" type="button" aria-label="Descargar enlace">↓</button><button class="queue-action delete" data-index="${index}" type="button" aria-label="Eliminar enlace">×</button></div>`).join('') : '<div class="empty-state" id="empty-state"><span>○</span><p>Aun no hay enlaces en tu biblioteca.</p></div>'; }
async function downloadItem(index) {
  const item = queue[index];
  item.status = 'Descargando...'; renderQueue();
  try {
    const response = await fetch('/api/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: item.url }) });
    if (!response.ok) throw new Error((await response.json()).error || 'No se pudo descargar el enlace.');
    const blob = await response.blob();
    const contentDisposition = response.headers.get('content-disposition') || '';
    const encodedName = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plainName = contentDisposition.match(/filename="([^"]+)"/i)?.[1];
    const filename = encodedName ? decodeURIComponent(encodedName) : plainName || 'audio.mp3';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    item.status = 'Completado';
  } catch (downloadError) { item.status = 'Error'; error.textContent = downloadError.message; }
  localStorage.setItem('signal-converter-queue', JSON.stringify(queue)); renderQueue();
}
form.addEventListener('submit', event => { event.preventDefault(); const value = youtubeInput.value.trim(); const valid = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(value); if (!valid || queue.some(item => item.url === value)) { error.textContent = 'Usa un enlace HTTPS valido de YouTube y no lo repitas.'; return; } queue.unshift({ url: value, status: 'Pendiente' }); localStorage.setItem('signal-converter-queue', JSON.stringify(queue)); youtubeInput.value = ''; error.textContent = ''; renderQueue(); downloadItem(0); });
queueElement.addEventListener('click', event => {
  const button = event.target.closest('.delete, .download');
  if (!button) return;
  const index = Number(button.dataset.index);
  if (button.classList.contains('delete')) { queue.splice(index, 1); localStorage.setItem('signal-converter-queue', JSON.stringify(queue)); renderQueue(); return; }
  downloadItem(index);
});
renderQueue();
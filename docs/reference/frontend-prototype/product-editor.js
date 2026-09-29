const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const newId = () => crypto.randomUUID();

function row(kind, item = {}) {
  const id = item.id || newId();
  const field = (label, key, value, attrs = '') => `<label>${label}<input data-value="${key}" value="${escape(value)}" ${attrs}></label>`;
  const checkbox = (label, key, value) => `<label class="check"><input type="checkbox" data-value="${key}" ${value ? 'checked' : ''}>${label}</label>`;
  let fields;
  if (kind === 'variants') fields = field('Nombre de la opción', 'name', item.name || '', 'required maxlength="120"') + field('Adicional en ARS', 'extra', item.extra ?? 0, 'type="number" min="0" max="100000000" step="1" required') + checkbox('Requiere tres fotos por WhatsApp', 'photos', item.photos);
  if (kind === 'fields') fields = field('Dato que debe completar el cliente', 'label', item.label || '', 'required maxlength="120" placeholder="Ej.: Nombre para el cartel"') + checkbox('Obligatorio', 'required', item.required);
  if (kind === 'components') fields = field('Elemento incluido', 'name', item.name || '', 'required maxlength="120"') + field('Cantidad', 'quantity', item.quantity ?? 1, 'type="number" min="1" max="100" step="1" required');
  return `<div class="editor-row" data-kind="${kind}" data-id="${escape(id)}">${fields}<button type="button" data-row-remove>Quitar</button></div>`;
}

export function configurationEditor(product, categories) {
  return `<fieldset><legend>Ocasiones</legend><p class="muted">Podés elegir más de una. Administralas en Configuración.</p>${categories.map(c => `<label class="check"><input type="checkbox" name="occasion" value="${escape(c)}" ${product.occasions.includes(c) ? 'checked' : ''}>${escape(c)}</label>`).join('')}</fieldset>
    <fieldset><legend>Galería de imágenes</legend><p class="muted">La primera imagen es la portada. Usá las flechas para ordenar la galería.</p><div id="image-list">${product.images.map(imageRow).join('')}</div><label>Subir fotos (PNG, JPG o WebP; hasta 5 MB cada una)<input type="file" id="editor-upload" accept="image/png,image/jpeg,image/webp" multiple></label><p id="upload-status" role="status"></p><label>O agregar una imagen desde una dirección HTTPS<input type="url" id="image-url" placeholder="https://…"></label><button type="button" data-image-add>Agregar imagen por URL</button></fieldset>
    ${[['variants','Variantes','Agregar opción'],['fields','Campos de personalización','Agregar campo'],['components','Componentes del combo','Agregar componente']].map(([kind,title,action]) => `<fieldset ${kind==='components'?'id="combo-components" '+(product.type==='combo'?'':'hidden'):''}><legend>${title}</legend>${kind==='fields'?'<p class="muted">Para un combo, indicá el componente en cada nombre: por ejemplo, “Frase para el cartel” y “Texto para los banderines”.</p>':''}<div data-rows="${kind}">${product[kind].map(item=>row(kind,item)).join('')}</div><button type="button" data-row-add="${kind}">${action}</button></fieldset>`).join('')}`;
}

function imageRow(src) {
  return `<div class="image-row" data-image="${escape(src)}"><img src="${escape(src)}" alt="Imagen de la galería"><div><button type="button" data-image-up aria-label="Mover imagen hacia el inicio">↑</button><button type="button" data-image-down aria-label="Mover imagen hacia el final">↓</button><button type="button" data-image-remove>Quitar</button></div></div>`;
}

export function readConfiguration(form) {
  const result = {occasions: [...form.querySelectorAll('[name="occasion"]:checked')].map(el=>el.value), images: [...form.querySelectorAll('[data-image]')].map(el=>el.dataset.image)};
  for (const kind of ['variants','fields','components']) {
    result[kind] = [...form.querySelectorAll(`[data-kind="${kind}"]`)].map(el => {
      const item = kind==='components' ? {} : {id:el.dataset.id};
      el.querySelectorAll('[data-value]').forEach(input => item[input.dataset.value] = input.type==='checkbox' ? input.checked : input.type==='number' ? Number(input.value) : input.value.trim());
      return item;
    });
  }
  if (form.elements.type.value!=='combo') result.components=[];
  return result;
}

export function bindEditor(api, notify) {
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !button.closest('#product-editor')) return;
    if (button.dataset.rowAdd) {
      const list=document.querySelector(`[data-rows="${button.dataset.rowAdd}"]`);
      if(list.children.length>=30)return notify('Máximo 30 elementos por sección.');
      list.insertAdjacentHTML('beforeend',row(button.dataset.rowAdd));
      list.lastElementChild.querySelector('input').focus();
    }
    if (button.hasAttribute('data-row-remove')) button.closest('.editor-row').remove();
    const image=button.closest('[data-image]');
    if(button.hasAttribute('data-image-remove')) image.remove();
    if(button.hasAttribute('data-image-up') && image.previousElementSibling) image.before(image.previousElementSibling);
    if(button.hasAttribute('data-image-down') && image.nextElementSibling) image.after(image.nextElementSibling);
    if(button.hasAttribute('data-image-add')) {
      const input=document.querySelector('#image-url');
      try { if(new URL(input.value).protocol!=='https:') throw new Error(); } catch { return notify('Ingresá una dirección HTTPS válida.'); }
      const list=document.querySelector('#image-list');
      if(list.children.length>=30)return notify('Máximo 30 imágenes por producto.');
      list.insertAdjacentHTML('beforeend',imageRow(input.value));input.value='';
    }
  });
  document.addEventListener('change', async event => {
    const input=event.target, form=input.closest('#product-editor');
    if(!form)return;
    if(input.name==='type') {
      const components=form.querySelector('#combo-components');
      components.hidden=input.value!=='combo';
      components.querySelectorAll('input').forEach(el=>el.disabled=components.hidden);
    }
    if(input.id!=='editor-upload')return;
    const status=form.querySelector('#upload-status'), save=form.querySelector('[type="submit"]'), list=form.querySelector('#image-list');
    input.disabled=true;save.disabled=true;form.dataset.uploading='true';
    try {
      if(list.children.length+input.files.length>30)throw new Error('Máximo 30 imágenes por producto.');
      for(const file of input.files) {
        if(file.size>5*1024*1024)throw new Error(`${file.name}: el máximo es 5 MB.`);
        status.textContent=`Subiendo ${file.name}…`;
        const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('No se pudo leer la imagen.'));reader.readAsDataURL(file);});
        const result=await api('/admin/upload','POST',{image});
        list.insertAdjacentHTML('beforeend',imageRow(result.url));
      }
      status.textContent='Imágenes subidas. Guardá el producto para conservar los cambios.';
    } catch(error) {status.textContent=error.message;notify(error.message);}
    finally {input.disabled=false;save.disabled=false;delete form.dataset.uploading;input.value='';}
  });
}

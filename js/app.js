import { agregarGasto, obtenerGastos, eliminarGasto } from './db.js';

const CATEGORIAS = ['Comida', 'Transporte', 'Servicios', 'Ocio', 'Otros'];
const MONTO_MAXIMO = 1_000_000_000;

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const formatoHora = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' });
const formatoDia = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const formatoDiaAnio = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
const formatoCompleto = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeStyle: 'short' });

// ---------- Referencias al DOM ----------
const form = document.getElementById('form-gasto');
const campos = {
  concepto: document.getElementById('concepto'),
  monto: document.getElementById('monto'),
  categoria: document.getElementById('categoria'),
};
const btnGuardar = document.getElementById('btn-guardar');
const lista = document.getElementById('lista-gastos');
const vacio = document.getElementById('vacio');
const totalMonto = document.getElementById('total-monto');
const totalConteo = document.getElementById('total-conteo');
const estadoRed = document.getElementById('estado-red');
const btnInstalar = document.getElementById('btn-instalar');
const toast = document.getElementById('toast');
const plantilla = document.getElementById('tpl-gasto');

/** Estado en memoria, siempre ordenado del más reciente al más antiguo. */
let gastos = [];

// ---------- Render ----------

function render(idNuevo = null) {
  // Se suma en centavos para evitar errores de punto flotante (0.1 + 0.2).
  const centavos = gastos.reduce((suma, g) => suma + Math.round(g.monto * 100), 0);
  totalMonto.textContent = moneda.format(centavos / 100);

  const n = gastos.length;
  totalConteo.textContent = n === 0
    ? 'Sin gastos registrados'
    : `${n} ${n === 1 ? 'gasto registrado' : 'gastos registrados'}`;

  const fragmento = document.createDocumentFragment();
  for (const gasto of gastos) {
    const item = crearItem(gasto);
    if (gasto.id === idNuevo) item.classList.add('gasto-nuevo');
    fragmento.append(item);
  }
  lista.replaceChildren(fragmento);
  vacio.hidden = n > 0;
}

function crearItem(gasto) {
  const li = plantilla.content.firstElementChild.cloneNode(true);
  const clave = gasto.categoria.toLowerCase();
  const fecha = new Date(gasto.fecha);

  li.dataset.id = gasto.id;
  li.dataset.cat = clave;
  li.querySelector('.gasto-icono use').setAttribute('href', `#i-${clave}`);
  li.querySelector('.gasto-concepto').textContent = gasto.concepto;
  li.querySelector('.gasto-categoria').textContent = gasto.categoria;
  const time = li.querySelector('time');
  time.dateTime = fecha.toISOString();
  time.textContent = describirFecha(fecha);
  time.title = formatoCompleto.format(fecha);
  li.querySelector('.gasto-monto').textContent = moneda.format(gasto.monto);

  const btn = li.querySelector('.btn-eliminar');
  btn.setAttribute('aria-label', `Eliminar ${gasto.concepto}`);
  btn.title = 'Eliminar';
  return li;
}

/** "Hoy, 5:30 p.m.", "Ayer, 9:10 a.m.", "3 nov, 1:00 p.m." o "3 nov 2025, …". */
function describirFecha(fecha) {
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const inicioFecha = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const diasAtras = Math.round((inicioHoy - inicioFecha) / 86_400_000);
  const hora = formatoHora.format(fecha);

  if (diasAtras === 0) return `Hoy, ${hora}`;
  if (diasAtras === 1) return `Ayer, ${hora}`;
  const formato = fecha.getFullYear() === hoy.getFullYear() ? formatoDia : formatoDiaAnio;
  return `${formato.format(fecha)}, ${hora}`;
}

// ---------- Validación ----------

function mostrarError(nombre, mensaje) {
  const campo = campos[nombre];
  const error = document.getElementById(`${nombre}-error`);
  campo.setAttribute('aria-invalid', 'true');
  error.textContent = mensaje;
  error.hidden = false;
}

function limpiarError(nombre) {
  campos[nombre].removeAttribute('aria-invalid');
  const error = document.getElementById(`${nombre}-error`);
  error.textContent = '';
  error.hidden = true;
}

function leerFormulario() {
  Object.keys(campos).forEach(limpiarError);

  const concepto = campos.concepto.value.trim().replace(/\s+/g, ' ');
  const montoTexto = campos.monto.value.trim();
  const monto = Number(montoTexto);
  const categoria = campos.categoria.value;
  const invalidos = [];

  if (!concepto) {
    mostrarError('concepto', 'Escribe un concepto, por ejemplo "Café".');
    invalidos.push('concepto');
  }

  if (!montoTexto || !Number.isFinite(monto) || monto <= 0) {
    mostrarError('monto', 'Ingresa un monto mayor a 0.');
    invalidos.push('monto');
  } else if (monto >= MONTO_MAXIMO) {
    mostrarError('monto', 'El monto es demasiado grande.');
    invalidos.push('monto');
  } else if (Math.round(monto * 100) === 0) {
    mostrarError('monto', 'El monto mínimo es $0.01.');
    invalidos.push('monto');
  }

  if (!CATEGORIAS.includes(categoria)) {
    mostrarError('categoria', 'Elige una categoría.');
    invalidos.push('categoria');
  }

  if (invalidos.length) {
    campos[invalidos[0]].focus();
    return null;
  }

  return { concepto, monto: Math.round(monto * 100) / 100, categoria };
}

// ---------- Acciones ----------

async function guardar(evento) {
  evento.preventDefault();
  const datos = leerFormulario();
  if (!datos) return;

  const gasto = { ...datos, fecha: Date.now() };
  btnGuardar.disabled = true;
  try {
    const id = await agregarGasto(gasto);
    gastos.unshift({ ...gasto, id });
    render(id);
    form.reset();
    mostrarToast('Gasto guardado');
  } catch (error) {
    console.error('No se pudo guardar el gasto:', error);
    mostrarToast('No se pudo guardar el gasto. Intenta de nuevo.', 'error');
  } finally {
    btnGuardar.disabled = false;
  }
}

async function eliminar(evento) {
  const boton = evento.target.closest('.btn-eliminar');
  if (!boton) return;

  const id = Number(boton.closest('.gasto').dataset.id);
  const gasto = gastos.find((g) => g.id === id);
  if (!gasto) return;
  if (!window.confirm(`¿Eliminar "${gasto.concepto}" por ${moneda.format(gasto.monto)}?`)) return;

  try {
    await eliminarGasto(id);
    gastos = gastos.filter((g) => g.id !== id);
    render();
    mostrarToast('Gasto eliminado');
  } catch (error) {
    console.error('No se pudo eliminar el gasto:', error);
    mostrarToast('No se pudo eliminar el gasto.', 'error');
  }
}

let temporizadorToast;
function mostrarToast(mensaje, tipo = 'ok') {
  toast.textContent = mensaje;
  toast.dataset.tipo = tipo;
  toast.classList.add('is-visible');
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

// ---------- Estado de conexión ----------

function actualizarEstadoRed() {
  const enLinea = navigator.onLine;
  estadoRed.textContent = enLinea ? 'En línea' : 'Sin conexión';
  estadoRed.classList.toggle('is-offline', !enLinea);
}

// ---------- Barra de navegación ----------

// Al desplazar, el título grande sale de vista y aparece el título en la barra.
const nav = document.getElementById('nav');
const tituloGrande = document.getElementById('titulo');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entrada]) => {
    nav.classList.toggle('is-scrolled', !entrada.isIntersecting);
  }, { rootMargin: '-44px 0px 0px 0px' }).observe(tituloGrande);
}

// ---------- Instalación ----------

let eventoInstalacion = null;

window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault();
  eventoInstalacion = evento;
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', async () => {
  if (!eventoInstalacion) return;
  eventoInstalacion.prompt();
  await eventoInstalacion.userChoice;
  eventoInstalacion = null;
  btnInstalar.hidden = true;
});

window.addEventListener('appinstalled', () => {
  eventoInstalacion = null;
  btnInstalar.hidden = true;
  mostrarToast('¡App instalada!');
});

// ---------- Service Worker ----------

if ('serviceWorker' in navigator) {
  // Cuando se activa una versión nueva del SW, recarga una vez para mostrarla.
  // El primer cambio en una visita sin SW es solo la instalación inicial y se ignora.
  let teniaControlador = Boolean(navigator.serviceWorker.controller);
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!teniaControlador) {
      teniaControlador = true;
      return;
    }
    if (recargando) return;
    recargando = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('No se pudo registrar el Service Worker:', error);
    });
  });
}

// ---------- Inicio ----------

form.addEventListener('submit', guardar);
for (const [nombre, campo] of Object.entries(campos)) {
  campo.addEventListener('input', () => limpiarError(nombre));
}
lista.addEventListener('click', eliminar);
window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);

actualizarEstadoRed();

// Pide al navegador que no borre los datos locales cuando falte espacio.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

try {
  gastos = await obtenerGastos();
} catch (error) {
  console.error('No se pudieron cargar los gastos:', error);
  mostrarToast('No se pudieron cargar los gastos guardados.', 'error');
}
render();

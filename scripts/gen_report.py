#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera el reporte PDF de analisis del sistema hotelero."""

import os, sys, hashlib, platform
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, HRFlowable
)

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus.doctemplate import SimpleDocTemplate
from pypdf import PdfReader, PdfWriter

# ============ PATHS ============
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_BODY = os.path.join(SCRIPT_DIR, '_body.pdf')
OUTPUT_COVER = os.path.join(SCRIPT_DIR, '_cover.pdf')
OUTPUT_FINAL = '/home/z/my-project/download/Analisis_Sistema_Hotelero_Recomendaciones.pdf'

PDF_SKILL_DIR = '/home/z/my-project/skills/pdf'

# ============ FONTS ============
_IS_MAC = platform.system() == 'Darwin'
FONT_DIR = os.path.expanduser('~/.openclaw/workspace/fonts') if _IS_MAC else '/usr/share/fonts'

pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ============ PALETTE ============
PAGE_BG       = colors.HexColor('#f2f4f3')
SECTION_BG    = colors.HexColor('#f0f2f1')
CARD_BG       = colors.HexColor('#e3e9e6')
TABLE_STRIPE  = colors.HexColor('#eef0ef')
HEADER_FILL   = colors.HexColor('#3a5346')
COVER_BLOCK   = colors.HexColor('#5f8270')
BORDER        = colors.HexColor('#a8cab9')
ICON          = colors.HexColor('#468d6a')
ACCENT        = colors.HexColor('#2b8659')
ACCENT_2      = colors.HexColor('#4ac24a')
TEXT_PRIMARY   = colors.HexColor('#1a1c1b')
TEXT_MUTED     = colors.HexColor('#848d89')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ============ STYLES ============
styles = getSampleStyleSheet()

s_h1 = ParagraphStyle('H1Custom', parent=styles['Normal'], fontName='FreeSerif-Bold', fontSize=20, leading=26, spaceBefore=18, spaceAfter=10, textColor=TEXT_PRIMARY)
s_h2 = ParagraphStyle('H2Custom', parent=styles['Normal'], fontName='FreeSerif-Bold', fontSize=15, leading=20, spaceBefore=14, spaceAfter=8, textColor=HEADER_FILL)
s_h3 = ParagraphStyle('H3Custom', parent=styles['Normal'], fontName='FreeSerif-Bold', fontSize=12, leading=16, spaceBefore=10, spaceAfter=6, textColor=ICON)
s_body = ParagraphStyle('BodyCustom', parent=styles['Normal'], fontName='FreeSerif', fontSize=10.5, leading=16, spaceAfter=8, textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY)
s_body_left = ParagraphStyle('BodyLeft', parent=s_body, alignment=TA_LEFT)
s_bullet = ParagraphStyle('BulletCustom', parent=s_body, leftIndent=20, bulletIndent=8, spaceAfter=4)
s_code = ParagraphStyle('CodeCustom', parent=styles['Normal'], fontName='DejaVuSans', fontSize=9, leading=13, backColor=colors.HexColor('#f5f5f5'), leftIndent=12, spaceAfter=6, spaceBefore=4, borderColor=BORDER, borderWidth=0.5, borderPadding=6)
s_caption = ParagraphStyle('Caption', parent=styles['Normal'], fontName='FreeSerif-Italic', fontSize=9, leading=13, textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6)
s_toc_h0 = ParagraphStyle('TOCH0', fontName='FreeSerif-Bold', fontSize=12, leading=18, leftIndent=0)
s_toc_h1 = ParagraphStyle('TOCH1', fontName='FreeSerif', fontSize=11, leading=16, leftIndent=20)
s_toc_h2 = ParagraphStyle('TOCH2', fontName='FreeSerif', fontSize=10, leading=15, leftIndent=40)
s_th = ParagraphStyle('TH', fontName='FreeSerif-Bold', fontSize=9.5, leading=13, textColor=colors.white, alignment=TA_CENTER)
s_td = ParagraphStyle('TD', fontName='FreeSerif', fontSize=9.5, leading=13, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
s_td_center = ParagraphStyle('TDCenter', parent=s_td, alignment=TA_CENTER)

# ============ HELPERS ============
def h1(text, level=0):
    key = f'h_{hashlib.md5(text.encode("utf-8", errors="replace")).hexdigest()[:8]}'
    safe_text = text.encode('ascii', errors='replace').decode('ascii')
    p = Paragraph(f'<b>{text}</b>', s_h1)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = safe_text
    p.bookmark_key = key
    return p

def h2(text, level=1):
    key = f'h_{hashlib.md5(text.encode("utf-8", errors="replace")).hexdigest()[:8]}'
    safe_text = text.encode('ascii', errors='replace').decode('ascii')
    p = Paragraph(f'<b>{text}</b>', s_h2)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = safe_text
    p.bookmark_key = key
    return p

def h3(text):
    return Paragraph(f'<b>{text}</b>', s_h3)

def body(text):
    return Paragraph(text, s_body)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet>{text}', s_bullet)

def code(text):
    return Paragraph(text, s_code)

def make_table(headers, rows, col_widths=None):
    avail = A4[0] - 2*inch
    data = [[Paragraph(f'<b>{h}</b>', s_th) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), s_td) if i == 0 else Paragraph(str(c), s_td_center) for i, c in enumerate(row)])
    if col_widths is None:
        n = len(headers)
        col_widths = [avail / n] * n
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

# ============ TOC TEMPLATE ============

# ============ CONTENT ============
story = []

# --- Spacer ---
story.append(Spacer(1, 6))

# ============ CAPITULO 1: RESUMEN EJECUTIVO ============
story.append(h1('1. Resumen Ejecutivo'))
story.append(body('Este documento presenta un analisis exhaustivo del sistema de gestion hotelera "Hospedá", una aplicacion web monolitica construida con HTML, CSS, JavaScript vanilla y Bootstrap 5 como unico framework dependiente. El sistema opera completamente en el navegador del cliente, utilizando localStorage como mecanismo de persistencia de datos y Supabase como backend opcional para sincronizacion en la nube. La aplicacion gestiona once modulos funcionales: Dashboard, Habitaciones, Reservas, Check-In/Out, Facturacion, Limpieza y Mantenimiento, Caja, Clientes, Reportes, Usuarios y Tarifas.'))
story.append(body('El analisis revela una arquitectura que, si bien funciona correctamente para su proposito actual, presenta oportunidades significativas de mejora en tres dimensiones principales: estabilidad del codigo, comunicacion entre modulos, y estructura visual. En cuanto a estabilidad, el sistema depende en gran medida de variables globales compartidas sin mecanismos de proteccion contra condiciones de carrera, lo que podria generar inconsistencias en escenarios de alta concurrencia. La comunicacion entre modulos se realiza a traves de funciones globales acopladas directamente, sin un sistema de eventos formal ni inyeccion de dependencias, lo que dificulta el mantenimiento a medida que el sistema crece. Visualmente, el sistema muestra un diseno coherente con un sistema de variables CSS bien definido y soporte para modo oscuro, pero presentaAreas donde la tipografia, la densidad de informacion y la consistencia de componentes pueden mejorarse.'))
story.append(body('A lo largo de este reporte se detallan hallazgos especificos organizados por categoria, junto con recomendaciones concretas y priorizadas que respetan la funcionalidad existente del sistema. Cada recomendacion incluye una justificacion tecnica clara y, cuando es aplicable, un ejemplo de implementacion para facilitar su adopcion.'))

story.append(Spacer(1, 12))

# ============ CAPITULO 2: ARQUITECTURA Y ESTRUCTURA ============
story.append(h1('2. Arquitectura y Estructura General'))

story.append(h2('2.1 Estructura de Archivos'))
story.append(body('El sistema esta organizado en una estructura de carpetas modular con tres niveles de profundidad. El directorio raiz contiene el archivo index.html principal, la carpeta css con siete hojas de estilos especificos (base, layout, components, login, dashboard, caja, filtros), y la carpeta js que alberga toda la logica de la aplicacion. Dentro de js se encuentran los archivos core (app.js, router.js, datos.js, supabase.js, utilidades.js), el directorio componentes con la barra lateral, y el directorio modulos que contiene cada funcion del sistema.'))
story.append(body('Los modulos mas complejos como Reservas, Tarifas y Reportes implementan un patron de submodulos con un archivo index.js coordinador que gestiona la logica general y delega responsabilidades a archivos especificos. Esta organizacion es acertada y permite mantener el codigo relativamente ordenado a pesar del volumen considerable del proyecto. Sin embargo, la carga de scripts sigue siendo secuencial a traves de etiquetas script en el HTML, lo que podria optimizarse con un sistema de modulos ES6 o un bundler como Vite.'))

story.append(h2('2.2 Patron de Enrutamiento'))
story.append(body('El sistema utiliza un enrutamiento basado en hash (#) implementado en router.js, con un switch statement que mapea cada modulo a su funcion de renderizado correspondiente. El patron hashchange permite navegacion sin recarga de pagina, lo cual es correcto para una SPA sin framework. El router tambien implementa un sistema basico de permisos que verifica si el usuario actual tiene acceso al modulo solicitado antes de renderizarlo. Este enfoque es funcional pero presenta limitaciones: no soporta parametros de ruta, no mantiene un historial de navegacion util, y cualquier cambio en la estructura de modulos requiere actualizar manualmente el switch.'))

story.append(h2('2.3 Persistencia de Datos'))
story.append(body('Toda la persistencia se realiza a traves de localStorage mediante la funcion guardarDatos() que serializa trece colecciones distintas. Este patron simple tiene varias implicaciones: la capacidad maxima de almacenamiento es de aproximadamente 5-10MB dependiendo del navegador, lo cual es limitado para un sistema con auditoria creciente; los datos son vulnerables a limpieza manual del navegador; no hay soporte nativo para operaciones transaccionales donde multiple escrituras deben exitir todas o ninguna; y no existe mecanismo de sincronizacion automatica entre pestanas del navegador. El archivo supabase.js esta incluido en el proyecto y configura un cliente de Supabase, pero actualmente no se utiliza para operaciones CRUD principales, sino como potencial backend futuro.'))

story.append(Spacer(1, 12))

# ============ CAPITULO 3: ESTABILIDAD DEL CODIGO ============
story.append(h1('3. Estabilidad del Codigo'))

story.append(h2('3.1 Variables Globales y Estado Compartido'))
story.append(body('El sistema utiliza mas de quince variables globales (estadoHabitaciones, reservas, clientes, pagos, usuarios, gastos, auditoria, caja, historialMantenimiento, tarifas, tiposTarifa, metodosPago, categoriasGastos, entre otras) que son accesibles y mutables desde cualquier punto del codigo. Este patron crea un acoplamiento extremadamente alto entre todos los modulos: cualquier funcion puede modificar el estado de cualquier coleccion sin pasar por un punto de control centralizado. Ademas, funciones como generarId() y registrarAuditoria() dependen implicitamente de estas variables globales sin recibirlas como parametros, lo que dificulta las pruebas unitarias y el rastreo de efectos secundarios.'))
story.append(body('La recomendacion principal es encapsular el estado en un objeto AppContext o Store centralizado que exponga metodos controlados para lectura y escritura. Cada modulo deberia interactuar con el store a traves de una API definida en lugar de acceder directamente a las variables globales. Esto permitiria agregar validaciones, disparar eventos de cambio y mantener un registro de quien modifica cada pieza de datos.'))

story.append(Spacer(1, 12))

story.append(h2('3.2 Gestion de Errores'))
story.append(body('La gestion de errores en el sistema es predominantemente mediante alert() del navegador. Se encuentran alertas en practicamente todos los modulos: habitaciones, check-in, facturacion, limpieza, caja, reservas y usuarios. Este enfoque tiene multiples desventajas: bloquea el hilo principal del navegador, no permite personalizacion visual, interrumpe la experiencia del usuario en operaciones criticas como check-in o cierre de caja, y no deja rastro alguno en el sistema de auditoria.'))
story.append(body('Se recomienda implementar un sistema de notificaciones toast no intrusivo que reemplace los alert() actuales. Este sistema deberia soportar diferentes niveles de severidad (informacion, advertencia, error, exito), desaparecer automaticamente despues de un tiempo configurable, y opcionalmente registrar los errores criticos en el log de auditoria. Adicionalmente, las funciones que realizan operaciones criticas deberian implementar un patron de promesas o async/await para manejar errores de forma mas elegante, especialmente en las interacciones con Supabase.'))

story.append(Spacer(1, 12))

story.append(h2('3.3 Seguro contra Condicion de Carrera'))
story.append(body('Dado que el sistema opera en un entorno de navegador con un solo hilo de ejecucion, las condiciones de carrera tradicionales no son un problema inmediato. Sin embargo, existen escenarios donde la falta de proteccion puede causar problemas: la funcion guardarDatos() es llamada despues de cada mutacion, pero si dos operaciones se ejecutan rapidamente en sucesion (por ejemplo, doble clic en un boton), ambas pueden leer el mismo estado anterior y la ultima escritura podria sobreescribir la primera. Esto es especialmente peligroso en operaciones financieras como el registro de pagos o los movimientos de caja.'))
story.append(body('Para mitigar este riesgo, se recomienda implementar un mecanismo de debounce en los botones de accion critica, deshabilitar los botones durante el procesamiento de una operacion, y considerar un patron de cola de operaciones para asegurar que los cambios de estado se procesen de forma secuencial y predecible.'))

story.append(Spacer(1, 12))

story.append(h2('3.4 Rendimiento y Renderizado'))
story.append(body('El renderizado actual reemplaza completamente el innerHTML del contenedor principal cada vez que se navega a un modulo. Para modulos con mucho contenido como el Dashboard o las Reservas, esto implica que se reconstruye todo el HTML de la vista completa en cada navegacion, incluyendo tablas, graficos y modales. Si bien esto funciona correctamente en el estado actual, a medida que los datos crecen (especialmente el historial de auditoria y las reservas), el rendimiento podria degradarse perceptiblemente.'))
story.append(body('Se recomienda evaluar la implementacion de un patron de renderizado mas inteligente que solo actualice las partes de la vista que han cambiado, en lugar de reconstruir todo el HTML. Tambien seria beneficioso diferir la renderizacion de secciones que no son visibles inmediatamente, como las pestanas inactivas en el modulo de Reportes o las secciones de pagos en el formulario de reservas. La paginacion del historial de mantenimiento es un buen ejemplo de optimizacion que ya se ha implementado correctamente y deberia extenderse a otros listados largos como los reportes de auditoria y el historial de caja.'))

story.append(Spacer(1, 12))

# ============ CAPITULO 4: COMUNICACION ENTRE MODULOS ============
story.append(h1('4. Comunicacion entre Modulos'))

story.append(h2('4.1 Acoplamiento Actual'))
story.append(body('La comunicacion entre modulos se realiza exclusivamente a traves de funciones globales. Por ejemplo, cuando se realiza un check-in, el modulo checkin.js modifica directamente estadoHabitaciones (perteneciente al ambito de datos.js), invoca cambiarEstadoReserva() (definida en reservas/utilidades.js), y llama a registrarAuditoria() (definida en utilidades.js). Este acoplamiento directo funciona pero crea una red de dependencias implicitas que es dificil de rastrear y mantener. La eliminacion de una funcion global o el cambio de su firma podria romper multiples modulos sin que los errores sean evidentes inmediatamente.'))

story.append(Spacer(1, 12))

story.append(h2('4.2 Flujo de Datos Criticos'))
story.append(body('Los flujos de datos mas criticos del sistema son los que involucran transacciones financieras y cambios de estado de habitaciones. El flujo de reserva a facturacion, por ejemplo, pasa por crearReserva() que genera un total, luego registrarPago() que actualiza el estado de pago, y finalmente realizarCheckOut() que calcula el saldo final y libera la habitacion. Cada una de estas funciones accede y modifica multiples colecciones globales (reservas, pagos, estadoHabitaciones, caja), y la falla de cualquier paso intermedio podria dejar el sistema en un estado inconsistente.'))
story.append(body('El flujo entre Caja y Facturacion es otro ejemplo critico: cuando se registra un pago en efectivo, facturacion.js invoca automaticamente registrarMovimientoCaja() para incluirlo en los movimientos del turno actual. Esta comunicacion directa es funcional pero no esta documentada formalmente, lo que facilita la introduccion de bugs durante el mantenimiento. Se recomienda implementar un sistema de eventos o un middleware de comunicacion que centralice estos flujos criticos y permita auditarlos facilmente.'))

story.append(Spacer(1, 12))

story.append(h2('4.3 Recomendaciones de Comunicacion'))
story.append(body('Se propone implementar un Event Bus ligero como capa intermedia entre modulos. Este Event Bus permitiria que los modulos publiquen eventos (reserva_creada, pago_registrado, checkin_realizado, habitacion_limpia) sin conocer directamente los consumidores. De esta forma, el modulo de auditoria se suscribiria a todos los eventos relevantes, el modulo de caja reaccionaria a los pagos en efectivo, y el modulo de dashboard podria actualizar sus KPIs en tiempo real sin necesidad de polling.'))
story.append(body('Adicionalmente, se recomienda crear un archivo de constantes compartidas (por ejemplo, estados.js) que defina de forma centralizada todos los estados posibles de reservas, habitaciones, pagos y otros tipos enumerados. Actualmente, estos estados se utilizan como cadenas literales dispersas por todo el codigo (por ejemplo, "Confirmada", "Check-In realizado", "Ocupada"), lo que facilita errores tipograficos y hace imposible la validacion estatica en tiempo de desarrollo.'))

story.append(Spacer(1, 12))

# ============ CAPITULO 5: SEGURIDAD ============
story.append(h1('5. Seguridad'))

story.append(h2('5.1 Autenticacion y Contraseñas'))
story.append(body('El sistema actual almacena las contraseñas de usuario en texto plano dentro del array de usuarios que se persiste en localStorage. Esto representa un riesgo de seguridad significativo: cualquier persona con acceso al navegador puede leer las contraseñas desde las herramientas de desarrollo, y si los datos se sincronizan con Supabase, las contraseñas estarian expuestas en la base de datos. El formulario de login compara directamente la contrasena ingresada con la almacenada sin ningun tipo de hash o salt. Se recomienda implementar al menos un hash SHA-256 con salt para las contraseñas, aunque lo ideal seria migrar completamente a un sistema de autenticacion basado en Supabase Auth que maneje sesiones, tokens JWT y politicas de seguridad de forma nativa.'))
story.append(body('El inicio de sesion actual usa sessionStorage para mantener la sesion activa, lo cual es correcto para una sesion de navegador, pero la sesion se pierde completamente al cerrar el navegador, obligando al usuario a autenticarse nuevamente cada vez. La implementacion de un mecanismo de "recordarme" con localStorage seria una mejora de usabilidad valiosa que no compromete la seguridad si se implementa correctamente con tokens de actualizacion.'))

story.append(h2('5.2 Proteccion de Datos Sensibles'))
story.append(body('El archivo supabase.js contiene la URL del proyecto y la clave anon (anon key) de Supabase en texto plano. Aunque las claves anon estan disenadas para ser publicas (se usan en el frontend y tienen permisos limitados por RLS), es una buena practica moverlas a variables de entorno o a un archivo de configuracion que no se incluya en el repositorio. Ademas, las credenciales del administrador (admin/admin123) estan codificadas como datos iniciales en datos.js, lo que significa que cualquier persona que conozca el sistema tiene acceso inmediato con credenciales de administrador.'))

story.append(Spacer(1, 12))

# ============ CAPITULO 6: ESTRUCTURA VISUAL Y ESTETICA ============
story.append(h1('6. Estructura Visual y Estetica'))

story.append(h2('6.1 Sistema de Diseno Actual'))
story.append(body('El sistema implementa un diseno visual coherente con un enfoque minimalista profesional. El archivo base.css define un sistema completo de variables CSS personalizadas que cubren colores, sombras, bordes, radio de esquinas, tipografia y transiciones. La paleta de colores utiliza tonos teal/esmeralda como acento principal sobre un fondo claro, con soporte completo para modo oscuro a traves de la clase .dark-mode en el elemento html. Las fuentes se limitan a Inter cargada desde Google Fonts, lo cual es una buena eleccion para interfaces de administracion. El sistema de sombras esta bien calibrado con tres niveles (sm, md, lg) que proporcionan profundidad sin ser excesivos.'))
story.append(body('La barra lateral implementa un patron colapsable elegante que se expande al pasar el cursor (hover) mostrando los textos de los enlaces, y en movil se transforma en un panel off-canvas con boton hamburguesa. La transicion de expansion utiliza una curva cubica-bezier que proporciona una sensacion fluida. El contenido principal se ajusta automaticamente con margin-left variable, lo cual es una solucion practica aunque podria mejorarse con CSS calc() o flexbox para mayor robustez.'))

story.append(Spacer(1, 12))

story.append(h2('6.2 Tipografia y Legibilidad'))
story.append(body('La tipografia del sistema presenta varias areas de mejora. El tamano base del html esta configurado a 13.71px en base.css, y el body tiene un font-size de 12px, lo cual es considerablemente pequeno para una aplicacion de escritorio. Los h2 estan configurados a solo 14.5px, apenas 2.5px mas grandes que el texto del cuerpo, lo que reduce la jerarquia visual. Los textos dentro de las tablas usan 12px, y los badges 10px, lo cual puede resultar dificil de leer en pantallas de baja resolucion. El interlineado (line-height) del cuerpo es de 1.5, que es adecuado, pero en modulos con mucha informacion densa como el dashboard o los reportes, podria beneficiarse de un interlineado ligeramente mayor (1.6-1.7) para mejorar la legibilidad.'))
story.append(body('Se recomienda aumentar el tamano base del cuerpo a 14px, los h2 a 18-20px, y los h3 a 15-16px para establecer una jerarquia tipografica mas clara. Los textos de tabla podrian aumentar a 13px, y los badges a 11px. Estos cambios proporcionarian una lectura mas comoda sin afectar significativamente la densidad de informacion en la pantalla.'))

story.append(Spacer(1, 12))

story.append(h2('6.3 Consistencia de Componentes'))
story.append(body('La aplicacion muestra una buena consistencia general en el uso de componentes: las tablas utilizan la clase table-modern, los botones siguen el sistema de colores del palette, y las tarjetas usan el sistema de sombras y bordes definido. Sin embargo, se observan algunas inconsistencias: el modulo de facturacion usa un emoji en el titulo (el simbolo de billete), mientras que otros modulos usan iconos de Font Awesome, lo cual rompe la coherencia visual. Los modales no tienen un patron completamente uniforme: algunos usan data-bs-dismiss para cerrar, otros usan funciones JavaScript personalizadas, y el tamano varia entre modal-dialog-centered y modal-dialog-centered modal-lg sin una justificacion visual clara en todos los casos.'))
story.append(body('Se recomienda estandarizar todos los iconos decorativos en el sistema para usar exclusivamente Font Awesome, eliminar los emojis de los titulos de secciones, y crear una convencion de tamanos de modales basada en su contenido: pequeno para formularios simples (como eliminar), mediano para formularios de edicion, y grande solo para vistas con tablas o contenido extenso como la cotizacion de facturacion.'))

story.append(Spacer(1, 12))

story.append(h2('6.4 Modo Oscuro y Accesibilidad'))
story.append(body('El modo oscuro esta implementado de forma correcta a traves de la clase .dark-mode en el elemento html, que redefinie todas las variables CSS correspondientes. Sin embargo, se detectan algunos problemas: los colores de las barras del calendario de ocupacion en dashboard.css usan selectores muy especificos con atributos de estilo inline (div[style*="background:#6b8f71"]) que son frágiles y dependen de que el dashboard no cambie su implementacion interna. La tarjeta de habitacion en disponibilidad.js usa colores codificados directamente (#28a745 para el borde de seleccion, #dee2e6 para el borde por defecto) en lugar de las variables CSS del sistema. En cuanto a accesibilidad, los formularios usan required en los campos obligatorios, pero no hay mensajes de error personalizados, no hay indicadores de foco visibles para navegacion por teclado, y las tablas de datos carecen de atributos aria-label en los botones de accion.'))

story.append(Spacer(1, 12))

# ============ CAPITULO 7: TABLA RESUMEN DE HALLAZGOS ============
story.append(h1('7. Tabla Resumen de Hallazgos y Recomendaciones'))

story.append(Spacer(1, 18))

avail_w = A4[0] - 2*inch
col_w = [avail_w*0.06, avail_w*0.20, avail_w*0.30, avail_w*0.22, avail_w*0.22]

t = make_table(
    ['N', 'Area', 'Hallazgo', 'Impacto', 'Prioridad'],
    [
        ['1', 'Estabilidad', 'Variables globales sin encapsulacion', 'Alto', 'Alta'],
        ['2', 'Estabilidad', 'Uso extensivo de alert() nativo', 'Medio', 'Alta'],
        ['3', 'Estabilidad', 'Ausencia de debounce en botones criticos', 'Alto', 'Media'],
        ['4', 'Estabilidad', 'Renderizado completo por navegacion', 'Medio', 'Baja'],
        ['5', 'Comunicacion', 'Acoplamiento directo entre modulos', 'Alto', 'Alta'],
        ['6', 'Comunicacion', 'Estados como cadenas dispersas', 'Medio', 'Alta'],
        ['7', 'Comunicacion', 'Flujos criticos sin transacciones', 'Alto', 'Alta'],
        ['8', 'Seguridad', 'Contrasenas en texto plano', 'Critico', 'Critica'],
        ['9', 'Seguridad', 'Credenciales admin por defecto', 'Alto', 'Alta'],
        ['10', 'Seguridad', 'Clave Supabase en codigo fuente', 'Medio', 'Media'],
        ['11', 'Visual', 'Tipografia base muy pequena (12px)', 'Medio', 'Media'],
        ['12', 'Visual', 'Inconsistencia iconos (emoji vs FA)', 'Bajo', 'Baja'],
        ['13', 'Visual', 'Colores hardcodeados en algunos modulos', 'Bajo', 'Media'],
        ['14', 'Visual', 'Falta de indicadores de accesibilidad', 'Medio', 'Media'],
    ],
    col_w
)
story.append(t)
story.append(Paragraph('Tabla 1: Resumen de hallazgos priorizados por area e impacto.', s_caption))

story.append(Spacer(1, 24))

# ============ CAPITULO 8: ROADMAP SUGERIDA ============
story.append(h1('8. Roadmap de Implementacion Sugerida'))

story.append(body('A continuacion se presenta una hoja de ruta recomendada para implementar las mejoras de forma incremental, organizada en cuatro fases de prioridad creciente. Cada fase esta disenada para ser implementada de forma independiente sin romper la funcionalidad existente, lo que permite entregar valor de forma continua.'))

story.append(Spacer(1, 12))
story.append(h2('8.1 Fase 1 - Mejoras Inmediatas (Semanas 1-2)'))

story.append(h3('Refactorizar colores hardcodeados'))
story.append(body('Reemplazar todos los colores hexadecimales directamente escritos en el codigo JavaScript (como #28a745, #dee2e6, #3b82f6) con referencias a las variables CSS existentes o a un archivo JS de constantes de diseno. Esto incluye las tarjetas de habitacion en disponibilidad.js, los colores del calendario Gantt en dashboard.css, y los colores de los selectores especificos de estilo inline. Esta tarea es de baja complejidad y alto impacto visual, ya que unificara la paleta completa del sistema.'))

story.append(h3('Reemplazar alert() por notificaciones toast'))
story.append(body('Crear un componente de notificaciones no intrusivas que reemplace los mas de treinta alert() presentes en el sistema. Las notificaciones deberian aparecer en la esquina superior derecha, soportar niveles (exito, error, advertencia, informacion), auto-eliminarse despues de 3-5 segundos, y permitir cierre manual. Se puede implementar como un div posicionado de forma fija que se actualiza dinamicamente, sin necesidad de librerias externas. Cada alert() deberia reemplazarse por una llamada a notificar(mensaje, tipo), manteniendo la funcionalidad existente pero con una experiencia de usuario significativamente mejor.'))

story.append(h3('Aumentar tamanos tipograficos base'))
story.append(body('Ajustar el font-size base del body de 12px a 14px, los h2 de 14.5px a 18px, los th de tablas de 10.5px a 11.5px, y los badges de 10px a 11px. Este cambio requiere verificar que los modales, tablas y cards sigan luciendo correctos con los nuevos tamanos, pero es una tarea de bajo riesgo que mejora inmediatamente la legibilidad.'))

story.append(Spacer(1, 12))
story.append(h2('8.2 Fase 2 - Refactor Estructural (Semanas 3-5)'))

story.append(h3('Crear archivo de constantes de estados'))
story.append(body('Centralizar todos los estados de reservas, habitaciones, metodos de pago y otros enumerados en un archivo estados.js. Cada modulo deberia importar y usar estas constantes en lugar de cadenas literales. Esto previene errores tipograficos (como "Check-In" vs "Check-In" con diferentes guiones) y permite validacion estatica. Tambien habilitaria la verificacion automatica de que solo se asignan estados validos en cada transicion.'))

story.append(h3('Implementar debounce en botones de accion'))
story.append(body('Agregar un mecanismo que deshabilite los botones de accion critica (guardar reserva, confirmar check-in, cerrar caja, eliminar registros) durante 500-1000ms despues del primer clic, y que los vuelva a habilitar una vez completada la operacion. Esto previene duplicaciones causadas por doble clic y es una mejora de estabilidad simple pero efectiva.'))

story.append(h3('Encapsular estado en modulo centralizado'))
story.append(body('Crear un patron de Store o AppContext que centralice el acceso a todas las colecciones de datos. En lugar de variables globales directas, los modulos accederian a los datos a traves de metodos como Store.getReservas(), Store.actualizarHabitacion(numero, cambios), etc. Este cambio puede hacerse de forma gradual, migrando un modulo a la vez sin afectar los demas, y proporciona un punto unico para agregar validaciones, logging y disparar eventos.'))

story.append(Spacer(1, 12))
story.append(h2('8.3 Fase 3 - Mejoras de Comunicacion (Semanas 6-8)'))

story.append(h3('Implementar Event Bus ligero'))
story.append(body('Desarrollar un sistema de publicacion/suscripcion de eventos que permita a los modulos comunicarse sin acoplamiento directo. El Event Bus deberia soportar eventos como: reserva.creada, reserva.cancelada, checkin.realizado, checkout.realizado, pago.registrado, habitacion.limpia, habitacion.mantenimiento, caja.abierta, caja.cerrada. Cada modulo publicaria eventos relevantes a sus operaciones y se suscribiria a los eventos de otros modulos que necesita monitorear. Esto desacopla completamente los modulos y facilita la adicion de nuevas funcionalidades como notificaciones push o actualizaciones en tiempo real.'))

story.append(h3('Migrar a modulos ES6'))
story.append(body('Convertir la carga de scripts secuencial a modulos ES6 con import/export. Cada modulo exportaria solo las funciones que otros necesitan, y sus funciones internas permanecerian privadas. Esto resuelve implicitamente gran parte del problema de variables globales, ya que cada modulo tendria su propio ambito. Para mantener la compatibilidad con el navegador sin bundler, se puede usar importmaps o un script type="module" en el HTML. Esta refactorizacion puede hacerse de forma incremental, comenzando por los modulos mas independientes (clientes, usuarios) y avanzando hacia los mas interconectados (reservas, facturacion).'))

story.append(Spacer(1, 12))
story.append(h2('8.4 Fase 4 - Seguridad y Robustez (Semanas 9-12)'))

story.append(h3('Implementar hash de contrasenas'))
story.append(body('Migrar el almacenamiento de contrasenas de texto plano a hash SHA-256 con salt. La funcion de login deberia comparar el hash de la contrasena ingresada con el almacenado, en lugar de hacer una comparacion directa. Se recomienda mantener compatibilidad con las contrasenas existentes durante un periodo de transicion, hasheando las contrasenas antiguas en el primer inicio de sesion exitoso.'))

story.append(h3('Integrar autenticacion con Supabase Auth'))
story.append(body('Dado que el proyecto ya incluye un cliente de Supabase configurado, la migracion a Supabase Auth para la autenticacion es el siguiente logico natural. Esto proporcionaria sesiones seguras con JWT, recuperacion de contrasenas, verificacion de email, y potencialmente autenticacion con proveedores externos (Google, Facebook). Los permisos del sistema actual podrian mapearse a roles de Supabase, simplificando significativamente la logica de autorizacion.'))

story.append(h3('Mover credenciales a variables de entorno'))
story.append(body('Externalizar la URL de Supabase y la clave anon a un archivo .env que no se incluya en el control de versiones. Las credenciales por defecto del administrador deberian eliminarse del codigo fuente y requerir configuracion obligatoria en el primer despliegue. Se puede agregar una pantalla de configuracion inicial que obligue a crear el primer usuario administrador con credenciales seguras cuando el sistema se inicia por primera vez.'))

# ============ BUILD ============
doc = SimpleDocTemplate(
    OUTPUT_BODY,
    pagesize=A4,
    leftMargin=inch,
    rightMargin=inch,
    topMargin=inch,
    bottomMargin=inch,
    title='Analisis del Sistema Hotelero - Recomendaciones de Mejora',
    author='Z.ai',
    subject='Analisis tecnico del sistema de gestion hotelera Hospedá'
)
doc.build(story)
print(f'Body PDF generated: {OUTPUT_BODY}')

# ============ COVER HTML ============
cover_html = '''<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 794px; height: 1123px; overflow: hidden; background: #ffffff; font-family: 'Inter', sans-serif; }
    .cover-page { position: relative; width: 794px; height: 1123px; }
    /* Layer 1 - Background */
    .cover-layer-1 { position: absolute; inset: 0; overflow: hidden; z-index: 1; }
    .grid-bg {
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(58,83,70,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(58,83,70,0.03) 1px, transparent 1px);
      background-size: 50px 50px;
    }
    .accent-bar { position: absolute; left: 0; top: 0; width: 8px; height: 100%; background: #3a5346; }
    /* Layer 2 - Structure */
    .cover-layer-2 { position: absolute; inset: 0; z-index: 2; }
    .divider-line { position: absolute; left: 100px; top: 15%; width: 1px; height: 70%; background: #a8cab9; opacity: 0.4; }
    /* Layer 3 - Content */
    .cover-layer-3 { position: absolute; inset: 0; z-index: 3; padding: 100px 60px 60px 130px; }
    .kicker { position: absolute; top: 16%; left: 130px; font-size: 13px; font-weight: 400; letter-spacing: 3px; text-transform: uppercase; color: #848d89; opacity: 0.7; }
    .title { position: absolute; top: 28%; left: 130px; font-size: 42px; font-weight: 800; color: #1a1c1b; line-height: 1.15; max-width: 520px; }
    .summary { position: absolute; top: 52%; left: 130px; font-size: 15px; font-weight: 300; color: #848d89; line-height: 1.6; max-width: 500px; opacity: 0.85; }
    .meta { position: absolute; bottom: 14%; left: 130px; font-size: 13px; font-weight: 400; color: #848d89; }
    .meta-item { margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
    .meta-dot { width: 5px; height: 5px; border-radius: 50%; background: #2b8659; }
    .footer-tag { position: absolute; bottom: 8%; right: 60px; font-size: 11px; font-weight: 400; letter-spacing: 1.5px; color: #a8cab9; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="cover-page">
    <div class="cover-layer-1">
      <div class="grid-bg"></div>
      <div class="accent-bar"></div>
    </div>
    <div class="cover-layer-2">
      <div class="divider-line"></div>
    </div>
    <div class="cover-layer-3">
      <div class="kicker">Analisis Tecnico</div>
      <div class="title">Sistema Hotelero<br>Hospedá</div>
      <div class="summary">Informe de analisis de arquitectura, estabilidad, comunicacion entre modulos y estructura visual. Incluye recomendaciones priorizadas y hoja de ruta de implementacion.</div>
      <div class="meta">
        <div class="meta-item"><div class="meta-dot"></div>Hospedá - Argentina</div>
        <div class="meta-item"><div class="meta-dot"></div>Junio 2026</div>
        <div class="meta-item"><div class="meta-dot"></div>Versión de analisis: 1.0</div>
      </div>
    </div>
    <div class="footer-tag">Documento Confidencial</div>
  </div>
</body>
</html>'''

cover_path = os.path.join(SCRIPT_DIR, '_cover.html')
with open(cover_path, 'w') as f:
    f.write(cover_html)
# Render cover HTML to PDF
import subprocess
subprocess.run([
    'node', os.path.join(PDF_SKILL_DIR, 'scripts', 'html2poster.js'),
    cover_path, '--output', OUTPUT_COVER, '--width', '794px'
], check=True, capture_output=True)
print(f'Cover PDF generated: {OUTPUT_COVER}')

# ============ MERGE ============
A4_W, A4_H = 595.28, 841.89

def normalize_page(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 2 or abs(h - A4_H) > 2:
        page.scale_to(A4_W, A4_H)
    return page

writer = PdfWriter()
cover_reader = PdfReader(OUTPUT_COVER)
writer.add_page(normalize_page(cover_reader.pages[0]))
body_reader = PdfReader(OUTPUT_BODY)
for page in body_reader.pages:
    writer.add_page(normalize_page(page))
writer.add_metadata({'/Title': 'Analisis del Sistema Hotelero - Recomendaciones', '/Author': 'Z.ai', '/Creator': 'Z.ai'})
with open(OUTPUT_FINAL, 'wb') as f:
    writer.write(f)

print(f'Final PDF generated: {OUTPUT_FINAL}')